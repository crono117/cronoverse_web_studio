from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Lead

VALID_PAYLOAD = {
    "name": "Alex Rivera",
    "email": "Alex@Example.com",
    "business": "Rivera Tacos",
    "service": "new",
    "message": "I would like a website for my taco truck business, please.",
    "language": "en",
    "website": "",
    "source": "contact_section",
}


class LeadCreateAPITests(APITestCase):
    def setUp(self):
        # Throttle history lives in the default cache, not the test database,
        # so it survives across test methods unless cleared explicitly.
        cache.clear()
        self.url = reverse("lead-create")

    def test_valid_submission_creates_lead(self):
        response = self.client.post(self.url, VALID_PAYLOAD, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Lead.objects.count(), 1)
        lead = Lead.objects.get()
        self.assertEqual(lead.name, "Alex Rivera")
        self.assertEqual(lead.email, "alex@example.com")
        self.assertEqual(lead.business, "Rivera Tacos")
        self.assertEqual(lead.service, "new")
        self.assertEqual(lead.language, "en")
        self.assertEqual(lead.source, "contact_section")

    def test_response_body_is_minimal(self):
        response = self.client.post(self.url, VALID_PAYLOAD, format="json")
        self.assertEqual(response.data, {"ok": True})

    def test_invalid_email_rejected(self):
        payload = {**VALID_PAYLOAD, "email": "not-an-email"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Lead.objects.count(), 0)

    def test_missing_required_field_rejected(self):
        payload = {**VALID_PAYLOAD}
        del payload["name"]
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Lead.objects.count(), 0)

    def test_message_too_short_rejected(self):
        payload = {**VALID_PAYLOAD, "message": "short"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Lead.objects.count(), 0)

    def test_whitespace_padded_name_is_rejected_after_trim(self):
        payload = {**VALID_PAYLOAD, "name": "  a  "}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Lead.objects.count(), 0)

    def test_honeypot_filled_rejected(self):
        payload = {**VALID_PAYLOAD, "website": "http://spam.example"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Lead.objects.count(), 0)

    def test_unknown_fields_are_ignored_not_persisted(self):
        payload = {**VALID_PAYLOAD, "status": "WON", "is_superuser": True}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        lead = Lead.objects.get()
        self.assertEqual(lead.status, Lead.Status.NEW)

    def test_default_status_is_new(self):
        self.client.post(self.url, VALID_PAYLOAD, format="json")
        lead = Lead.objects.get()
        self.assertEqual(lead.status, Lead.Status.NEW)

    def test_default_service_when_omitted(self):
        payload = {**VALID_PAYLOAD}
        del payload["service"]
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        lead = Lead.objects.get()
        self.assertEqual(lead.service, Lead.Service.UNSURE)

    def test_source_attribution_stored(self):
        self.client.post(self.url, VALID_PAYLOAD, format="json")
        lead = Lead.objects.get()
        self.assertEqual(lead.source, "contact_section")

    def test_anonymous_cannot_list_leads(self):
        Lead.objects.create(
            name="Existing", email="existing@example.com",
            message="A message that is long enough to be valid.",
        )
        response = self.client.get(self.url)
        self.assertNotEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(b"existing@example.com", response.content)

    def test_anonymous_cannot_retrieve_single_lead(self):
        lead = Lead.objects.create(
            name="Existing", email="existing@example.com",
            message="A message that is long enough to be valid.",
        )
        response = self.client.get(f"{self.url}{lead.pk}/")
        self.assertIn(
            response.status_code,
            (status.HTTP_404_NOT_FOUND, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_throttle_limits_rapid_submissions(self):
        for _ in range(5):
            response = self.client.post(self.url, VALID_PAYLOAD, format="json")
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        response = self.client.post(self.url, VALID_PAYLOAD, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class LeadModelTests(TestCase):
    def test_str_representation(self):
        lead = Lead.objects.create(
            name="Jamie", email="jamie@example.com",
            message="A message that is long enough to be valid.",
        )
        self.assertIn("Jamie", str(lead))
        self.assertIn("jamie@example.com", str(lead))

    def test_status_defaults_to_new(self):
        lead = Lead.objects.create(
            name="Jamie", email="jamie@example.com",
            message="A message that is long enough to be valid.",
        )
        self.assertEqual(lead.status, Lead.Status.NEW)


class LeadAdminTests(TestCase):
    def test_lead_registered_in_admin(self):
        self.assertIn(Lead, admin.site._registry)

    def test_anonymous_redirected_to_login(self):
        response = self.client.get("/admin/leads/lead/")
        self.assertEqual(response.status_code, 302)

    def test_staff_can_view_lead_list(self):
        get_user_model().objects.create_superuser(
            "staffadmin", "staff@example.com", "testpass12345"
        )
        self.client.login(username="staffadmin", password="testpass12345")
        response = self.client.get("/admin/leads/lead/")
        self.assertEqual(response.status_code, 200)
