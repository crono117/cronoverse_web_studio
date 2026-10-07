import logging
import secrets

from django.conf import settings
from django.core.exceptions import RequestDataTooBig
from django.db import DatabaseError, connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from rest_framework.exceptions import ParseError
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .intake import InquiryConflict, InquiryRateLimited, accept_inquiry
from .serializers import InquirySerializer

logger = logging.getLogger(__name__)


class IntakePermission(BasePermission):
    def has_permission(self, request, view):
        expected = settings.INQUIRY_API_KEY
        if expected:
            supplied = request.headers.get("X-Inquiry-Api-Key", "")
            return secrets.compare_digest(supplied.encode(), expected.encode())
        return settings.INQUIRY_ALLOW_LOCAL_SUBMISSIONS


class InquiryIntakeView(APIView):
    authentication_classes = []
    permission_classes = [IntakePermission]
    http_method_names = ["post"]

    def post(self, request):
        headers = {"Cache-Control": "no-store"}
        if request.content_type.partition(";")[0].strip().lower() != "application/json":
            return Response({"error": "Expected JSON"}, status=415, headers=headers)
        try:
            if len(request.body) > settings.DATA_UPLOAD_MAX_MEMORY_SIZE:
                raise RequestDataTooBig
            serializer = InquirySerializer(data=request.data)
            if not serializer.is_valid():
                return Response({"error": "Please check your details"}, status=400, headers=headers)
        except RequestDataTooBig:
            return Response({"error": "Too large"}, status=413, headers=headers)
        except ParseError:
            return Response({"error": "Invalid request"}, status=400, headers=headers)
        try:
            _, created = accept_inquiry(serializer.validated_data)
        except InquiryConflict:
            return Response({"error": "Invalid inquiry ID"}, status=409, headers=headers)
        except InquiryRateLimited:
            return Response(
                {"error": "Please try again later"}, status=429,
                headers={**headers, "Retry-After": "3600"},
            )
        except DatabaseError as error:
            logger.error("inquiry_save_failed error_type=%s", type(error).__name__)
            return Response(
                {"error": "Your inquiry could not be saved. Please try again."}, status=503, headers=headers,
            )
        return Response({"ok": True}, status=201 if created else 200, headers=headers)


@require_GET
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return JsonResponse({"ok": False}, status=503, headers={"Cache-Control": "no-store"})
    return JsonResponse({"ok": True}, headers={"Cache-Control": "no-store"})
