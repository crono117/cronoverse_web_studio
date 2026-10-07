from django.contrib import admin
from django.urls import path

from inquiries.views import InquiryIntakeView, health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/inquiries", InquiryIntakeView.as_view(), name="inquiry-intake"),
    path("health/", health, name="health"),
]
