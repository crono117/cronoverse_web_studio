from django.contrib.admin import AdminSite
from django.urls import path


class CronoverseAdminSite(AdminSite):
    def get_urls(self):
        from inquiries.analytics_views import analytics_dashboard

        return [
            path("analytics/", self.admin_view(analytics_dashboard), name="analytics"),
        ] + super().get_urls()
