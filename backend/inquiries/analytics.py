"""Read-only GA4 reports. Credentials and API responses stay on the server."""
import logging
import re
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    BatchRunReportsRequest, DateRange, Dimension, Filter, FilterExpression,
    Metric, MinuteRange, OrderBy, RunRealtimeReportRequest, RunReportRequest,
)
from google.api_core.exceptions import PermissionDenied, ResourceExhausted, Unauthenticated
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials

logger = logging.getLogger("inquiries")
READ_SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
ALLOWED_DAYS = (7, 28, 90)
CACHE_SECONDS = 60


def reporting_client():
    credentials = Credentials.from_service_account_file(
        settings.GA4_CREDENTIALS_FILE, scopes=[READ_SCOPE],
    )
    auth_request = Request()

    def bounded_auth(*args, **kwargs):
        kwargs["timeout"] = 5
        return auth_request(*args, **kwargs)

    credentials.refresh(bounded_auth)
    return BetaAnalyticsDataClient(credentials=credentials, transport="rest")


def report_requests(property_name, days):
    date_range = [DateRange(start_date=f"{days - 1}daysAgo", end_date="today")]

    def report(metrics, dimension=None, **extra):
        return RunReportRequest(
            property=property_name, date_ranges=date_range,
            metrics=[Metric(name=name) for name in metrics],
            dimensions=[Dimension(name=dimension)] if dimension else [],
            **extra,
        )

    return [
        report(["activeUsers", "sessions", "screenPageViews"]),
        report(["activeUsers", "screenPageViews"], "date", limit=days),
        report(["sessions"], "sessionSourceMedium", limit=10, order_bys=[
            OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True),
        ]),
        report(["activeUsers"], "deviceCategory", limit=10, order_bys=[
            OrderBy(metric=OrderBy.MetricOrderBy(metric_name="activeUsers"), desc=True),
        ]),
        report(["eventCount"], dimension_filter=FilterExpression(filter=Filter(
            field_name="eventName",
            string_filter=Filter.StringFilter(value="generate_lead", match_type=Filter.StringFilter.MatchType.EXACT),
        ))),
    ]


def values(report, count):
    if not report.rows:
        return [0] * count
    return [max(0, int(report.rows[0].metric_values[index].value)) for index in range(count)]


def breakdown(report):
    rows = [{
        "label": row.dimension_values[0].value or "(not set)",
        "value": max(0, int(row.metric_values[0].value)),
    } for row in report.rows]
    largest = max((row["value"] for row in rows), default=0)
    for row in rows:
        row["width"] = round(100 * row["value"] / largest, 1) if largest else 0
    return rows


def fetch_dashboard(property_id, days):
    property_name = "properties/" + property_id
    with reporting_client() as client:
        batch = client.batch_run_reports(
            request=BatchRunReportsRequest(property=property_name, requests=report_requests(property_name, days)),
            timeout=8, retry=None,
        )
        if len(batch.reports) != 5:
            raise ValueError("Incomplete Google report response.")
        summary, timeline, sources, devices, leads = batch.reports
        users, sessions, views = values(summary, 3)
        property_timezone = summary.metadata.time_zone or settings.TIME_ZONE
        try:
            today = datetime.now(ZoneInfo(property_timezone)).date()
        except ZoneInfoNotFoundError:
            today = timezone.localdate()
        start = today - timedelta(days=days - 1)
        daily_values = {
            row.dimension_values[0].value: [max(0, int(value.value)) for value in row.metric_values]
            for row in timeline.rows
        }
        daily = []
        for offset in range(days):
            day = start + timedelta(days=offset)
            daily_users, daily_views = daily_values.get(day.strftime("%Y%m%d"), [0, 0])
            daily.append({"date": day, "users": daily_users, "views": daily_views})
        highest = max((row["users"] for row in daily), default=0)
        points = " ".join(
            f"{round(20 + index * 860 / (days - 1), 2)},{round(190 - row['users'] * 160 / max(1, highest), 2)}"
            for index, row in enumerate(daily)
        )
        # A temporary realtime failure must not hide a successful historical report.
        realtime_users = None
        realtime_unavailable = False
        try:
            realtime = client.run_realtime_report(
                request=RunRealtimeReportRequest(
                    property=property_name, metrics=[Metric(name="activeUsers")],
                    minute_ranges=[MinuteRange(start_minutes_ago=29, end_minutes_ago=0)],
                ),
                timeout=8, retry=None,
            )
            realtime_users = values(realtime, 1)[0]
        except Exception as error:
            realtime_unavailable = True
            logger.warning("analytics_realtime_unavailable error_type=%s", type(error).__name__)
    return {
        "state": "connected", "users": users, "sessions": sessions, "views": views,
        "leads": values(leads, 1)[0], "realtime_users": realtime_users,
        "realtime_unavailable": realtime_unavailable,
        "daily": daily, "chart_points": points, "chart_max": highest,
        "sources": breakdown(sources), "devices": breakdown(devices),
        "start_date": start, "end_date": today, "property_timezone": property_timezone,
        "thresholded": any(report.metadata.subject_to_thresholding for report in batch.reports),
        "updated_at": timezone.now(),
    }


def dashboard_report(days):
    if days not in ALLOWED_DAYS:
        raise ValueError("Unsupported date range.")
    property_id = settings.GA4_PROPERTY_ID
    if not property_id or not settings.GA4_CREDENTIALS_FILE:
        return {"state": "setup"}
    if not re.fullmatch(r"[0-9]{1,20}", property_id):
        return {"state": "error", "message": "The reporting property ID must be the numeric GA4 Property ID."}
    if not Path(settings.GA4_CREDENTIALS_FILE).is_file():
        return {"state": "error", "message": "The Google reporting credential is not available on this server."}
    key = f"cronoverse-ga4-v1:{property_id}:{days}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    try:
        report = fetch_dashboard(property_id, days)
    except (PermissionDenied, Unauthenticated) as error:
        logger.warning("analytics_report_unavailable error_type=%s", type(error).__name__)
        report = {"state": "error", "message": "Google denied reporting access. Check the service account's Viewer access and enable the Analytics Data API."}
    except ResourceExhausted:
        report = {"state": "error", "message": "Google's reporting limit was reached. Please try again shortly."}
    except Exception as error:
        logger.warning("analytics_report_unavailable error_type=%s", type(error).__name__)
        report = {"state": "error", "message": "Google Analytics is unavailable. Check the reporting connection and try again."}
    cache.set(key, report, CACHE_SECONDS)
    return report
