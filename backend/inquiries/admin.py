from django.contrib import admin, messages
from django.utils import timezone

from .models import EmailDelivery, Inquiry


class EmailDeliveryInline(admin.TabularInline):
    model = EmailDelivery
    fields = ["kind", "recipient", "state", "attempts", "last_error", "sent_at"]
    readonly_fields = fields
    extra = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Inquiry)
class InquiryAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "business", "service", "language", "status", "created_at"]
    list_filter = ["status", "service", "language", "created_at"]
    search_fields = ["name", "email", "business", "message"]
    readonly_fields = ["id", "name", "email", "business", "service", "message", "language", "created_at", "updated_at"]
    fields = readonly_fields + ["status", "notes"]
    inlines = [EmailDeliveryInline]
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False


@admin.register(EmailDelivery)
class EmailDeliveryAdmin(admin.ModelAdmin):
    list_display = ["inquiry", "kind", "recipient", "state", "attempts", "sent_at"]
    list_filter = ["state", "kind"]
    search_fields = ["recipient", "inquiry__email", "inquiry__name"]
    readonly_fields = [
        "id", "inquiry", "kind", "recipient", "state", "attempts", "next_attempt_at",
        "last_error", "created_at", "sent_at", "lease_token", "locked_until",
    ]
    fields = readonly_fields
    actions = ["retry_unsent"]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.action(description="Retry selected failed emails", permissions=["change"])
    def retry_unsent(self, request, queryset):
        count = queryset.filter(state__in=[EmailDelivery.State.FAILED, EmailDelivery.State.RETRY]).update(
            state=EmailDelivery.State.PENDING, attempts=0, next_attempt_at=timezone.now(),
            last_error="", lease_token=None, locked_until=None,
        )
        self.message_user(request, f"{count} unsent email(s) queued for retry.", messages.SUCCESS)
