import logging
import uuid
from datetime import timedelta
from email.utils import parseaddr

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db.models import F, Q
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils import timezone

from .models import EmailDelivery

logger = logging.getLogger(__name__)


class MailNotAccepted(Exception):
    pass


def available(now):
    return (
        Q(state__in=[EmailDelivery.State.PENDING, EmailDelivery.State.RETRY], next_attempt_at__lte=now)
        | Q(state=EmailDelivery.State.SENDING, locked_until__lte=now)
    )


def claim_delivery():
    now = timezone.now()
    candidates = EmailDelivery.objects.filter(available(now)).values_list("id", flat=True)[:20]
    for delivery_id in list(candidates):
        token = uuid.uuid4()
        claimed = EmailDelivery.objects.filter(pk=delivery_id).filter(available(now)).update(
            state=EmailDelivery.State.SENDING, lease_token=token,
            locked_until=now + timedelta(seconds=settings.EMAIL_LEASE_SECONDS),
            attempts=F("attempts") + 1,
        )
        if claimed:
            return EmailDelivery.objects.select_related("inquiry").get(pk=delivery_id)
    return None


def build_message(delivery):
    inquiry = delivery.inquiry
    context = {
        "inquiry": inquiry, "studio_url": settings.STUDIO_URL,
        "admin_url": settings.PUBLIC_BASE_URL + reverse("admin:inquiries_inquiry_change", args=[inquiry.pk]),
    }
    if delivery.kind == EmailDelivery.Kind.WELCOME:
        template = "inquiries/email/welcome_" + inquiry.language
        subject = "Welcome to Cronoverse — we received your inquiry"
        if inquiry.language == "es":
            subject = "Bienvenido a Cronoverse — recibimos tu consulta"
        reply_to = [settings.INQUIRY_REPLY_TO_EMAIL] if settings.INQUIRY_REPLY_TO_EMAIL else []
    else:
        template = "inquiries/email/notification"
        subject = "New Cronoverse project inquiry"
        reply_to = [inquiry.email]
    recipient = delivery.recipient
    if not recipient and delivery.kind == EmailDelivery.Kind.NOTIFICATION:
        recipient = settings.INQUIRY_NOTIFICATION_EMAIL
        EmailDelivery.objects.filter(pk=delivery.pk, lease_token=delivery.lease_token).update(recipient=recipient)
    if not recipient or not settings.DEFAULT_FROM_EMAIL:
        raise MailNotAccepted("Configure the recipient and sender before sending.")
    sender_domain = parseaddr(settings.DEFAULT_FROM_EMAIL)[1].split("@")[-1]
    message = EmailMultiAlternatives(
        subject=subject,
        body=render_to_string(template + ".txt", context),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient],
        reply_to=reply_to,
        headers={"Message-ID": f"<cronoverse-{delivery.pk}@{sender_domain}>"},
    )
    message.attach_alternative(render_to_string(template + ".html", context), "text/html")
    return message


def deliver(delivery):
    owned = EmailDelivery.objects.filter(
        pk=delivery.pk, state=EmailDelivery.State.SENDING, lease_token=delivery.lease_token,
    )
    if not owned.filter(locked_until__gt=timezone.now()).exists():
        return False
    try:
        if delivery.attempts > settings.EMAIL_MAX_ATTEMPTS:
            raise MailNotAccepted("Retry limit reached.")
        if build_message(delivery).send(fail_silently=False) != 1:
            raise MailNotAccepted("Email backend did not accept the message.")
    except Exception as error:
        # Store only the error class: SMTP exceptions can contain addresses and credentials.
        exhausted = delivery.attempts >= settings.EMAIL_MAX_ATTEMPTS
        owned.update(
            state=EmailDelivery.State.FAILED if exhausted else EmailDelivery.State.RETRY,
            next_attempt_at=timezone.now() + timedelta(seconds=min(3600, 60 * 2 ** min(delivery.attempts - 1, 6))),
            last_error=type(error).__name__, lease_token=None, locked_until=None,
        )
        logger.warning("inquiry_email_failed delivery_id=%s error_type=%s", delivery.pk, type(error).__name__)
        return False
    owned.update(state=EmailDelivery.State.SENT, sent_at=timezone.now(), last_error="", lease_token=None, locked_until=None)
    return True
