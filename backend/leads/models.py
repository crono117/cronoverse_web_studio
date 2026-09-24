from django.db import models


class Lead(models.Model):
    class Service(models.TextChoices):
        NEW = "new", "New website"
        REDESIGN = "redesign", "Website redesign"
        APP = "app", "Web app / integration"
        UNSURE = "unsure", "Not sure yet"

    class Language(models.TextChoices):
        EN = "en", "English"
        ES = "es", "Español"

    class Status(models.TextChoices):
        NEW = "NEW", "New"
        CONTACTED = "CONTACTED", "Contacted"
        QUALIFIED = "QUALIFIED", "Qualified"
        WON = "WON", "Won"
        LOST = "LOST", "Lost"
        SPAM = "SPAM", "Spam"

    name = models.CharField(max_length=100)
    email = models.EmailField(max_length=254)
    business = models.CharField(max_length=160, blank=True, default="")
    service = models.CharField(max_length=20, choices=Service.choices, default=Service.UNSURE)
    message = models.TextField(max_length=4000)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.EN)
    source = models.CharField(
        max_length=40,
        default="contact_section",
        help_text="Internal tag for which page/section this lead came from.",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email", "created_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.name} <{self.email}>"
