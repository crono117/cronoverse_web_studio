from rest_framework.throttling import AnonRateThrottle


class LeadCreateThrottle(AnonRateThrottle):
    """Conservative per-IP limit on public lead submissions.

    Rate is configurable via DJANGO_LEAD_THROTTLE_RATE (see settings.py),
    default 5/hour: enough for a genuine visitor retrying a typo, not enough
    for scripted abuse.
    """

    scope = "lead_create"
