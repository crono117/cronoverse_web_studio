from django.contrib import admin

from .models import Lead


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "business", "service", "status", "source", "created_at")
    list_display_links = ("name", "email")
    list_editable = ("status",)
    list_filter = ("status", "service", "source", "language", "created_at")
    search_fields = ("name", "email", "business", "message")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Contact", {"fields": ("name", "email", "business")}),
        ("Project", {"fields": ("service", "message", "language")}),
        ("Workflow", {"fields": ("status", "source")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )
