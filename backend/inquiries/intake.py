import hashlib
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import EmailDelivery, Inquiry, IntakeGuard


class InquiryConflict(Exception):
    pass


class InquiryRateLimited(Exception):
    pass


def same_submission(inquiry, data):
    return all(getattr(inquiry, field) == value for field, value in data.items())


def accept_inquiry(validated_data):
    data = {field: value for field, value in validated_data.items() if field != "website"}
    key = hashlib.sha256(data["email"].encode()).hexdigest()
    try:
        with transaction.atomic():
            IntakeGuard.objects.get_or_create(key=key)
            IntakeGuard.objects.select_for_update().get(key=key)
            existing = Inquiry.objects.filter(pk=data["id"]).first()
            if existing:
                if not same_submission(existing, data):
                    raise InquiryConflict
                return existing, False
            since = timezone.now() - timedelta(hours=1)
            if Inquiry.objects.filter(email=data["email"], created_at__gt=since).count() >= settings.INQUIRY_MAX_PER_HOUR:
                raise InquiryRateLimited
            inquiry = Inquiry.objects.create(**data)
            EmailDelivery.objects.bulk_create([
                EmailDelivery(inquiry=inquiry, kind=EmailDelivery.Kind.WELCOME, recipient=inquiry.email),
                EmailDelivery(
                    inquiry=inquiry, kind=EmailDelivery.Kind.NOTIFICATION,
                    recipient=settings.INQUIRY_NOTIFICATION_EMAIL,
                ),
            ])
            return inquiry, True
    except IntegrityError:
        # A UUID shared by two different email guards may race on its unique key.
        existing = Inquiry.objects.filter(pk=data["id"]).first()
        if existing:
            if same_submission(existing, data):
                return existing, False
            raise InquiryConflict from None
        raise
