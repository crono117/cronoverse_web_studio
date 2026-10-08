import uuid

from django.db import models
from django.utils import timezone


class Inquiry(models.Model):
    class Service(models.TextChoices):
        NEW = "new", "New website"
        REDESIGN = "redesign", "Website redesign"
        APP = "app", "Web app or integration"
        UNSURE = "unsure", "Let's figure it out together"

    class Status(models.TextChoices):
        NEW = "new", "New"
        CONTACTED = "contacted", "Contacted"
        QUALIFIED = "qualified", "Qualified"
        CLOSED = "closed", "Closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    email = models.EmailField(max_length=254)
    business = models.CharField(max_length=160, blank=True)
    service = models.CharField(max_length=16, choices=Service.choices)
    message = models.TextField(max_length=4000)
    language = models.CharField(max_length=2, choices=[("en", "English"), ("es", "Spanish")])
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    notes = models.TextField(blank=True, help_text="Internal notes; never included in customer emails.")
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email", "created_at"], name="inquiry_email_created"),
            models.Index(fields=["status", "created_at"], name="inquiry_status_created"),
        ]
        verbose_name_plural = "Project inquiries"

    def __str__(self):
        return f"{self.name} — {self.get_service_display()}"


class IntakeGuard(models.Model):
    """Serializes rate-limit checks per address on PostgreSQL."""

    key = models.CharField(max_length=64, primary_key=True)


class EmailDelivery(models.Model):
    class Kind(models.TextChoices):
        WELCOME = "welcome", "Customer welcome"
        NOTIFICATION = "notification", "Owner notification"

    class State(models.TextChoices):
        PENDING = "pending", "Pending"
        SENDING = "sending", "Sending"
        RETRY = "retry", "Waiting to retry"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inquiry = models.ForeignKey(Inquiry, on_delete=models.CASCADE, related_name="email_deliveries")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    recipient = models.EmailField(max_length=254, blank=True)
    state = models.CharField(max_length=16, choices=State.choices, default=State.PENDING)
    attempts = models.PositiveIntegerField(default=0)
    next_attempt_at = models.DateTimeField(default=timezone.now)
    lease_token = models.UUIDField(null=True, editable=False)
    locked_until = models.DateTimeField(null=True, editable=False)
    last_error = models.CharField(max_length=100, blank=True, help_text="Error type only; no email contents or credentials.")
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    sent_at = models.DateTimeField(null=True, editable=False)

    class Meta:
        ordering = ["created_at", "id"]
        constraints = [models.UniqueConstraint(fields=["inquiry", "kind"], name="one_email_per_inquiry_kind")]
        indexes = [models.Index(fields=["state", "next_attempt_at"], name="email_ready")]

    def __str__(self):
        return f"{self.get_kind_display()} — {self.inquiry_id}"
