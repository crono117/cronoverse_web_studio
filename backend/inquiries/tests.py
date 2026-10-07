import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest import skipUnless
from datetime import timedelta
from io import StringIO
from smtplib import SMTPException
from unittest.mock import patch

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.messages.storage.fallback import FallbackStorage
from django.core import mail
from django.core.management import call_command
from django.db import DatabaseError, connection, connections
from django.test import RequestFactory, TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .intake import InquiryRateLimited, accept_inquiry
from .mail import claim_delivery, deliver
from .models import EmailDelivery, Inquiry
from .serializers import InquirySerializer


def payload(**changes):
    return {
        "id": str(uuid.uuid4()), "name": "Alex Rivera", "email": "alex@example.com",
        "business": "Alex Studio", "message": "I would like a website for my business.",
        "service": "new", "language": "en", "website": "", **changes,
    }


def create_inquiry(**changes):
    serializer = InquirySerializer(data=payload(**changes))
    serializer.is_valid(raise_exception=True)
    return accept_inquiry(serializer.validated_data)[0]


@override_settings(
    INQUIRY_API_KEY="test-shared-key",
    INQUIRY_NOTIFICATION_EMAIL="owner@example.com",
    INQUIRY_REPLY_TO_EMAIL="owner@example.com",
    DEFAULT_FROM_EMAIL="Cronoverse <studio@example.com>",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    PUBLIC_BASE_URL="https://backend.example.com",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    },
)
class InquiryFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.client.credentials(HTTP_X_INQUIRY_API_KEY="test-shared-key")

    def submit(self, data):
        return self.client.post("/api/inquiries", data, format="json")

    def drain(self):
        call_command("process_inquiry_emails", once=True, stdout=StringIO())

    def test_submission_is_saved_before_two_messages_are_sent(self):
        response = self.submit(payload(email=" ALEX@EXAMPLE.COM "))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json(), {"ok": True})
        self.assertEqual(response["Cache-Control"], "no-store")
        inquiry = Inquiry.objects.get()
        self.assertEqual(inquiry.email, "alex@example.com")
        self.assertEqual(inquiry.status, Inquiry.Status.NEW)
        self.assertEqual(inquiry.email_deliveries.count(), 2)
        self.assertEqual(len(mail.outbox), 0)
        self.drain()
        self.assertEqual(len(mail.outbox), 2)
        welcome = next(message for message in mail.outbox if message.to == ["alex@example.com"])
        alert = next(message for message in mail.outbox if message.to == ["owner@example.com"])
        self.assertIn("someone from our team will contact you", welcome.body)
        self.assertEqual(welcome.reply_to, ["owner@example.com"])
        self.assertIn(inquiry.message, alert.body)
        self.assertIn("/admin/inquiries/inquiry/" + str(inquiry.id) + "/change/", alert.body)
        self.assertEqual(alert.reply_to, ["alex@example.com"])
        self.assertTrue(all(message.alternatives[0].mimetype == "text/html" for message in mail.outbox))
        self.assertEqual(EmailDelivery.objects.filter(state=EmailDelivery.State.SENT).count(), 2)

    def test_spanish_visitor_gets_spanish_welcome(self):
        self.submit(payload(language="es", name="Lucía"))
        self.drain()
        welcome = next(message for message in mail.outbox if message.to == ["alex@example.com"])
        self.assertIn("Bienvenido", welcome.subject)
        self.assertIn("alguien de nuestro equipo te contactará", welcome.body)

    def test_unchanged_retry_does_not_duplicate_inquiry_or_emails(self):
        data = payload()
        self.assertEqual(self.submit(data).status_code, 201)
        self.drain()
        self.assertEqual(self.submit(data).status_code, 200)
        self.drain()
        self.assertEqual(Inquiry.objects.count(), 1)
        self.assertEqual(EmailDelivery.objects.count(), 2)
        self.assertEqual(len(mail.outbox), 2)

    def test_changed_payload_cannot_reuse_an_existing_uuid(self):
        data = payload()
        self.submit(data)
        for changes in [{"email": "someone@example.com"}, {"message": "Another project description."}]:
            with self.subTest(changes=changes):
                self.assertEqual(self.submit({**data, **changes}).status_code, 409)
        self.assertEqual(Inquiry.objects.count(), 1)

    def test_quota_and_duplicate_retry_at_quota(self):
        data = payload()
        self.submit(data)
        self.submit(payload())
        self.submit(payload())
        response = self.submit(payload())
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response["Retry-After"], "3600")
        self.assertEqual(self.submit(data).status_code, 200)
        self.assertEqual(self.submit(payload(email="other@example.com")).status_code, 201)

    def test_validation_and_honeypot_do_not_save_records(self):
        invalid = [
            {"email": "invalid"}, {"name": "A"}, {"message": "short"},
            {"website": "spam.example"}, {"service": "other"}, {"language": "fr"},
            {"name": "Header\nInjection"}, {"id": "not-a-uuid"}, {"unexpected": True},
        ]
        for changes in invalid:
            with self.subTest(changes=changes):
                self.assertEqual(self.submit(payload(**changes)).status_code, 400)
        self.assertEqual(Inquiry.objects.count(), 0)
        self.assertEqual(EmailDelivery.objects.count(), 0)

    def test_service_key_required_and_no_public_read_or_edit(self):
        self.client.credentials()
        self.assertEqual(self.submit(payload()).status_code, 403)
        self.client.credentials(HTTP_X_INQUIRY_API_KEY="wrong")
        self.assertEqual(self.submit(payload()).status_code, 403)
        self.client.credentials(HTTP_X_INQUIRY_API_KEY="test-shared-key")
        for method in ("get", "put", "delete"):
            self.assertEqual(getattr(self.client, method)("/api/inquiries").status_code, 405)

    def test_invalid_json_media_and_byte_limit(self):
        self.assertEqual(self.client.post("/api/inquiries", "{", content_type="application/json").status_code, 400)
        self.assertEqual(self.client.post("/api/inquiries", "hello", content_type="text/plain").status_code, 415)
        self.assertEqual(self.client.post("/api/inquiries", '"' + "é" * 12_001 + '"', content_type="application/json").status_code, 413)
        self.assertEqual(Inquiry.objects.count(), 0)

    def test_outbox_creation_failure_rolls_back_the_inquiry(self):
        with patch("inquiries.intake.EmailDelivery.objects.bulk_create", side_effect=DatabaseError):
            self.assertEqual(self.submit(payload()).status_code, 503)
        self.assertEqual(Inquiry.objects.count(), 0)

    def test_smtp_failure_keeps_saved_inquiry_and_retries_only_failed_message(self):
        inquiry = create_inquiry()
        first = claim_delivery()
        with patch("inquiries.mail.EmailMultiAlternatives.send", side_effect=SMTPException("private details")):
            self.assertFalse(deliver(first))
        second = claim_delivery()
        self.assertTrue(deliver(second))
        first.refresh_from_db()
        self.assertEqual(first.state, EmailDelivery.State.RETRY)
        self.assertEqual(first.last_error, "SMTPException")
        self.assertEqual(inquiry.email_deliveries.count(), 2)
        self.assertEqual(Inquiry.objects.count(), 1)
        self.drain()  # Backoff hasn't elapsed, and the sent sibling isn't retried.
        self.assertEqual(len(mail.outbox), 1)
        EmailDelivery.objects.filter(pk=first.pk).update(next_attempt_at=timezone.now())
        self.drain()
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(EmailDelivery.objects.filter(state=EmailDelivery.State.SENT).count(), 2)

    def test_zero_accepted_messages_is_a_delivery_failure(self):
        create_inquiry()
        delivery = claim_delivery()
        with patch("inquiries.mail.EmailMultiAlternatives.send", return_value=0):
            self.assertFalse(deliver(delivery))
        delivery.refresh_from_db()
        self.assertEqual(delivery.state, EmailDelivery.State.RETRY)

    def test_claim_is_exclusive_and_sent_email_cannot_be_delivered_again(self):
        create_inquiry()
        first = claim_delivery()
        second = claim_delivery()
        self.assertNotEqual(first.pk, second.pk)
        self.assertIsNone(claim_delivery())
        self.assertTrue(deliver(first))
        self.assertFalse(deliver(first))
        self.assertEqual(len(mail.outbox), 1)

    def test_expired_lease_can_be_reclaimed_and_stale_sender_cannot_send(self):
        create_inquiry()
        first = claim_delivery()
        EmailDelivery.objects.filter(pk=first.pk).update(locked_until=timezone.now() - timedelta(seconds=1))
        reclaimed = claim_delivery()
        self.assertEqual(reclaimed.pk, first.pk)
        self.assertNotEqual(reclaimed.lease_token, first.lease_token)
        self.assertFalse(deliver(first))
        self.assertTrue(deliver(reclaimed))
        self.assertEqual(len(mail.outbox), 1)

    def test_html_escapes_visitor_content_and_internal_notes_are_omitted(self):
        inquiry = create_inquiry(name='<img src=x onerror="alert(1)">', message="<script>alert(1)</script> and a project")
        inquiry.notes = "PRIVATE STAFF NOTES"
        inquiry.save()
        self.drain()
        for message in mail.outbox:
            html = message.alternatives[0].content
            self.assertNotIn("<script>", html)
            self.assertNotIn("<img src=x", html)
            self.assertNotIn(inquiry.notes, message.body)
            self.assertNotIn(inquiry.notes, html)

    def test_retry_limit_and_admin_retry_do_not_resend_sent_siblings(self):
        create_inquiry()
        first = claim_delivery()
        first.attempts = 8
        EmailDelivery.objects.filter(pk=first.pk).update(attempts=8)
        with patch("inquiries.mail.EmailMultiAlternatives.send", side_effect=SMTPException):
            deliver(first)
        first.refresh_from_db()
        self.assertEqual(first.state, EmailDelivery.State.FAILED)
        deliver(claim_delivery())
        user = get_user_model().objects.create_superuser("admin", "admin@example.com", "test-only-password")
        request = RequestFactory().post("/admin/")
        request.user = user
        request.session = {}
        request._messages = FallbackStorage(request)
        model_admin = admin.site._registry[EmailDelivery]
        model_admin.retry_unsent(request, EmailDelivery.objects.all())
        self.drain()
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(EmailDelivery.objects.filter(state=EmailDelivery.State.SENT).count(), 2)

    def test_admin_requires_staff_and_has_search_status_and_delivery_controls(self):
        inquiry = create_inquiry()
        response = self.client.get("/admin/inquiries/inquiry/")
        self.assertEqual(response.status_code, 302)
        user = get_user_model().objects.create_user("regular", password="test-only-password")
        self.client.force_login(user)
        self.assertEqual(self.client.get("/admin/inquiries/inquiry/").status_code, 302)
        owner = get_user_model().objects.create_superuser("owner", "owner@example.com", "test-only-password")
        self.client.force_login(owner)
        self.assertEqual(self.client.get("/admin/inquiries/inquiry/?q=Alex").status_code, 200)
        detail = self.client.get(f"/admin/inquiries/inquiry/{inquiry.pk}/change/")
        self.assertEqual(detail.status_code, 200)
        self.assertContains(detail, "Customer welcome")
        self.assertContains(detail, "Owner notification")
        self.assertContains(detail, "Internal notes")
        self.assertEqual(self.client.get("/admin/inquiries/emaildelivery/").status_code, 200)

    def test_health_checks_database_without_exposing_records(self):
        create_inquiry()
        response = self.client.get("/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})
        with patch("inquiries.views.connection.cursor", side_effect=DatabaseError):
            self.assertEqual(self.client.get("/health/").status_code, 503)


# Run these with PostgreSQL (the CI service uses it). SQLite has no row-level locks.
@skipUnless(connection.vendor == 'postgresql', 'PostgreSQL row-lock verification')
@override_settings(INQUIRY_NOTIFICATION_EMAIL='owner@example.com')
class PostgreSQLConcurrencyTests(TransactionTestCase):
    def parallel_submit(self, requests):
        barrier = Barrier(len(requests))

        def submit(data):
            connections.close_all()
            serializer = InquirySerializer(data=data)
            serializer.is_valid(raise_exception=True)
            barrier.wait(timeout=10)
            try:
                _, created = accept_inquiry(serializer.validated_data)
                return 'created' if created else 'duplicate'
            except InquiryRateLimited:
                return 'limited'
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=len(requests)) as executor:
            return list(executor.map(submit, requests))

    def test_simultaneous_identical_retries_create_one_inquiry_and_two_jobs(self):
        data = payload()
        results = self.parallel_submit([data] * 4)
        self.assertEqual(results.count('created'), 1)
        self.assertEqual(results.count('duplicate'), 3)
        self.assertEqual(Inquiry.objects.count(), 1)
        self.assertEqual(EmailDelivery.objects.count(), 2)

    def test_simultaneous_distinct_submissions_obey_email_quota(self):
        results = self.parallel_submit([payload() for _ in range(4)])
        self.assertEqual(results.count('created'), 3)
        self.assertEqual(results.count('limited'), 1)
        self.assertEqual(Inquiry.objects.count(), 3)
        self.assertEqual(EmailDelivery.objects.count(), 6)
