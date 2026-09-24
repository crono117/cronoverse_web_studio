from django.utils.html import strip_tags
from rest_framework import serializers

from .models import Lead


class LeadCreateSerializer(serializers.ModelSerializer):
    """Public-facing serializer for landing-page lead submissions.

    Unknown/unrecognized input keys are simply ignored by ModelSerializer
    (never persisted) rather than rejected outright, so a stray extra field
    never blocks a legitimate visitor from reaching the business.
    """

    website = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        write_only=True,
        help_text="Honeypot. Must stay empty; a filled value marks the submission as spam.",
    )

    class Meta:
        model = Lead
        fields = ["name", "email", "business", "service", "message", "language", "website", "source"]
        extra_kwargs = {
            "name": {"min_length": 2},
            "message": {"min_length": 10},
        }

    def validate_name(self, value):
        value = strip_tags(value).strip()
        if not (2 <= len(value) <= 100):
            raise serializers.ValidationError("Name must be between 2 and 100 characters.")
        return value

    def validate_email(self, value):
        return value.strip().lower()

    def validate_business(self, value):
        return strip_tags(value).strip()

    def validate_message(self, value):
        value = strip_tags(value).strip()
        if not (10 <= len(value) <= 4000):
            raise serializers.ValidationError("Message must be between 10 and 4000 characters.")
        return value

    def validate_website(self, value):
        if value.strip():
            raise serializers.ValidationError("Submission rejected.")
        return value

    def create(self, validated_data):
        validated_data.pop("website", None)
        return Lead.objects.create(**validated_data)
