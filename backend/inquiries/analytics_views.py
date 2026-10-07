from django.contrib import admin
from django.core.exceptions import PermissionDenied
from django.template.response import TemplateResponse
from django.views.decorators.http import require_GET

from .analytics import ALLOWED_DAYS, dashboard_report


@require_GET
def analytics_dashboard(request):
    if not request.user.has_perm("inquiries.view_inquiry"):
        raise PermissionDenied
    try:
        days = int(request.GET.get("days", "28"))
    except ValueError:
        days = 28
    if days not in ALLOWED_DAYS:
        days = 28
    context = {
        **admin.site.each_context(request),
        "title": "Website analytics",
        "days": days, "ranges": ALLOWED_DAYS,
        "report": dashboard_report(days),
    }
    response = TemplateResponse(request, "admin/analytics_dashboard.html", context)
    response["Cache-Control"] = "private, no-store"
    return response
