from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.cache import cache
from django.test import TestCase, override_settings
from google.analytics.data_v1beta.types import (
    BatchRunReportsResponse, DimensionValue, MetricValue, ResponseMetaData,
    Row, RunRealtimeReportResponse, RunReportResponse,
)
from google.api_core.exceptions import PermissionDenied, ResourceExhausted, ServiceUnavailable

from .analytics import dashboard_report, reporting_client


def report(rows=(), time_zone='America/Los_Angeles'):
    return RunReportResponse(
        rows=[Row(
            dimension_values=[DimensionValue(value=value) for value in dimensions],
            metric_values=[MetricValue(value=str(value)) for value in metrics],
        ) for dimensions, metrics in rows],
        metadata=ResponseMetaData(time_zone=time_zone),
    )


def google_client(empty=False):
    today = datetime.now(ZoneInfo('America/Los_Angeles')).strftime('%Y%m%d')
    reports = [report() for _ in range(5)] if empty else [
        report([((), (120, 155, 270))]),
        report([((today,), (7, 8))]),
        report([(('google / organic',), (100,)), (('<script>private</script>',), (5,))]),
        report([(('mobile',), (60,)), (('desktop',), (45,))]),
        report([((), (3,))]),
    ]
    client = MagicMock()
    client.__enter__.return_value = client
    client.batch_run_reports.return_value = BatchRunReportsResponse(reports=reports)
    client.run_realtime_report.return_value = RunRealtimeReportResponse(
        rows=[] if empty else [Row(metric_values=[MetricValue(value='2')])],
    )
    return client


@override_settings(
    GA4_PROPERTY_ID='123456789',
    STORAGES={
        'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
        'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
    },
)
class AnalyticsAdminTests(TestCase):
    def setUp(self):
        cache.clear()
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        path = Path(self.temp.name) / 'reporting.json'
        path.write_text('{}')
        self.settings_override = override_settings(GA4_CREDENTIALS_FILE=str(path))
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.user = get_user_model().objects.create_user('viewer', password='test-only', is_staff=True)
        self.user.user_permissions.add(Permission.objects.get(codename='view_inquiry'))
        self.client.force_login(self.user)
        self.google = google_client()
        self.provider = patch('inquiries.analytics.reporting_client', return_value=self.google)
        self.provider_mock = self.provider.start()
        self.addCleanup(self.provider.stop)

    def test_anonymous_and_nonstaff_users_cannot_access_reports(self):
        self.client.logout()
        response = self.client.get('/admin/analytics/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/admin/login/', response['Location'])
        user = get_user_model().objects.create_user('visitor', password='test-only')
        self.client.force_login(user)
        self.assertEqual(self.client.get('/admin/analytics/').status_code, 302)
        self.provider_mock.assert_not_called()

    def test_staff_without_inquiry_view_permission_gets_403(self):
        staff = get_user_model().objects.create_user('limited', password='test-only', is_staff=True)
        self.client.force_login(staff)
        self.assertEqual(self.client.get('/admin/analytics/').status_code, 403)
        self.provider_mock.assert_not_called()

    def test_unconfigured_dashboard_has_setup_state_without_fake_numbers(self):
        with override_settings(GA4_PROPERTY_ID='', GA4_CREDENTIALS_FILE=''):
            response = self.client.get('/admin/analytics/')
        self.assertContains(response, 'Connect your Google Analytics property')
        self.assertNotContains(response, 'analytics-metrics')
        self.provider_mock.assert_not_called()

    def test_dashboard_renders_google_values_and_escapes_external_labels(self):
        response = self.client.get('/admin/analytics/?days=7&property=999999')
        self.assertEqual(response.status_code, 200)
        data = response.context['report']
        self.assertEqual((data['users'], data['sessions'], data['views'], data['leads']), (120, 155, 270, 3))
        self.assertEqual(data['realtime_users'], 2)
        self.assertEqual(len(data['daily']), 7)
        self.assertEqual(data['daily'][-1]['users'], 7)
        self.assertEqual(data['daily'][0]['users'], 0)
        self.assertContains(response, '&lt;script&gt;private&lt;/script&gt;')
        self.assertNotContains(response, '<script>private</script>')
        self.assertIn('no-store', response['Cache-Control'])
        request = self.google.batch_run_reports.call_args.kwargs['request']
        self.assertEqual(request.property, 'properties/123456789')
        self.assertEqual(len(request.requests), 5)
        self.assertEqual(request.requests[0].date_ranges[0].start_date, '6daysAgo')
        self.assertEqual(request.requests[4].dimension_filter.filter.string_filter.value, 'generate_lead')
        self.assertEqual(self.google.batch_run_reports.call_args.kwargs['timeout'], 8)
        self.assertIsNone(self.google.batch_run_reports.call_args.kwargs['retry'])
        recent = self.google.run_realtime_report.call_args.kwargs['request']
        self.assertEqual(recent.minute_ranges[0].start_minutes_ago, 29)

    def test_date_ranges_are_bounded_and_defaults_are_safe(self):
        with patch('inquiries.analytics_views.dashboard_report', return_value={'state': 'setup'}) as load:
            for value in ['999999', '-7', 'invalid']:
                self.client.get('/admin/analytics/?days=' + value)
                self.assertEqual(load.call_args.args, (28,))
            self.client.get('/admin/analytics/?days=90')
            self.assertEqual(load.call_args.args, (90,))
        with self.assertRaises(ValueError):
            dashboard_report(1000)

    def test_cached_reports_avoid_repeated_api_requests(self):
        first = dashboard_report(28)
        second = dashboard_report(28)
        self.assertEqual(first, second)
        self.assertEqual(self.google.batch_run_reports.call_count, 1)
        self.assertEqual(self.google.run_realtime_report.call_count, 1)

    def test_zero_activity_is_distinct_from_connection_failure(self):
        self.provider_mock.return_value = google_client(empty=True)
        response = self.client.get('/admin/analytics/')
        self.assertContains(response, 'Google returned no visitor activity')
        self.assertEqual(response.context['report']['realtime_users'], 0)
        self.assertEqual(response.context['report']['state'], 'connected')

    def test_google_permission_error_does_not_expose_private_exception_details(self):
        self.google.batch_run_reports.side_effect = PermissionDenied('private credential detail')
        with self.assertLogs('inquiries', level='WARNING') as captured:
            response = self.client.get('/admin/analytics/')
        self.assertContains(response, 'Google denied reporting access')
        self.assertNotContains(response, 'private credential detail')
        self.assertNotIn('private credential detail', str(captured.output))
        self.assertNotContains(response, 'analytics-metrics')

    def test_quota_failure_is_displayed_and_cached(self):
        self.google.batch_run_reports.side_effect = ResourceExhausted('private detail')
        response = self.client.get('/admin/analytics/')
        self.assertContains(response, 'reporting limit was reached')
        self.client.get('/admin/analytics/')
        self.assertEqual(self.google.batch_run_reports.call_count, 1)

    def test_realtime_failure_preserves_historical_data_without_a_fake_zero(self):
        self.google.run_realtime_report.side_effect = ServiceUnavailable('private detail')
        with self.assertLogs('inquiries', level='WARNING'):
            response = self.client.get('/admin/analytics/')
        self.assertEqual(response.context['report']['users'], 120)
        self.assertIsNone(response.context['report']['realtime_users'])
        self.assertContains(response, 'Temporarily unavailable')
        self.assertNotContains(response, 'private detail')

    def test_invalid_property_or_missing_credential_does_not_contact_google(self):
        with override_settings(GA4_PROPERTY_ID='G-TEST123456'):
            self.assertEqual(dashboard_report(28)['state'], 'error')
        with override_settings(GA4_CREDENTIALS_FILE=str(Path(self.temp.name) / 'missing.json')):
            self.assertEqual(dashboard_report(28)['state'], 'error')
        self.provider_mock.assert_not_called()

    def test_dashboard_only_accepts_get(self):
        self.assertEqual(self.client.post('/admin/analytics/').status_code, 405)
        self.provider_mock.assert_not_called()


@override_settings(GA4_CREDENTIALS_FILE='/private/reporting.json')
class ReportingCredentialTests(TestCase):
    def test_reporting_credentials_use_readonly_scope_and_bounded_auth(self):
        with patch('inquiries.analytics.Credentials.from_service_account_file') as load, \
             patch('inquiries.analytics.Request') as request, \
             patch('inquiries.analytics.BetaAnalyticsDataClient') as client:
            load.return_value.refresh.side_effect = lambda callback: callback('https://oauth2.googleapis.com/token', timeout=120)
            reporting_client()
            load.assert_called_once_with('/private/reporting.json', scopes=['https://www.googleapis.com/auth/analytics.readonly'])
            self.assertEqual(request.return_value.call_args.kwargs['timeout'], 5)
            client.assert_called_once_with(credentials=load.return_value, transport='rest')
