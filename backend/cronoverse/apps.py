from django.contrib.admin.apps import AdminConfig


class CronoverseAdminConfig(AdminConfig):
    default_site = "cronoverse.admin_site.CronoverseAdminSite"
