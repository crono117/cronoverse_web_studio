from rest_framework import serializers

from .models import Inquiry


class InquirySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(min_length=2, max_length=100)
    email = serializers.EmailField(max_length=254)
    business = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")
    service = serializers.ChoiceField(choices=Inquiry.Service.choices)
    message = serializers.CharField(min_length=10, max_length=4000)
    language = serializers.ChoiceField(choices=["en", "es"])
    website = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")

    def validate_name(self, value):
        if "\r" in value or "\n" in value:
            raise serializers.ValidationError("Enter your name on one line.")
        return value

    def validate_email(self, value):
        return value.lower()

    def validate_website(self, value):
        if value:
            raise serializers.ValidationError("Please leave this field empty.")
        return value

    def to_internal_value(self, data):
        if not isinstance(data, dict) or set(data) - set(self.fields):
            raise serializers.ValidationError("Invalid inquiry fields.")
        return super().to_internal_value(data)
