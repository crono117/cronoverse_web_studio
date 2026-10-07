# Website analytics and Django admin reports

This branch includes Django's **Website analytics** reporting page. It reads
real reports from Google's Analytics Data API. The frontend on this dedicated
backend branch is unchanged and does not contain the GA4 tracking integration.
Use [HOME_MACHINE_HANDOFF.md](HOME_MACHINE_HANDOFF.md) to bring the existing
tracking code into the updated animated frontend, then follow the setup below.

## Connect website tracking

1. Create or select a GA4 property for Cronoverse and a **Web** data stream for
   `https://cronoverse.online`.
2. In Google Analytics, open **Admin → Data streams → your Web stream**. Copy its
   **Measurement ID**, which starts with `G-`.
3. Set the frontend's **runtime** environment variable `GA4_MEASUREMENT_ID` to
   that ID. For local Wrangler development, use ignored `.dev.vars`; hosted
   Sites use the production runtime environment settings. The Measurement ID
   is public, not a reporting password. Empty or invalid IDs disable analytics.
4. Turn off **Enhanced measurement** for this stream. The Google tag still sends
   its initial pageview; the application sends successful inquiry events itself.
   This avoids extra automatic form/history events and keeps language switches
   from being counted as new page visits. There must be only one installed
   Google tag; do not also install a duplicate tag through Tag Manager.
5. Publish the frontend with the runtime setting and verify a visit in GA4's
   **Realtime** report after choosing **Allow analytics** on the website.

Visitors can allow or decline analytics in English or Spanish and reopen their
choice from **Analytics cookie settings** at the bottom of the page. Before
consent, no Google script is loaded. Withdrawal disables further events and
clears first-party GA cookies. The preference uses local storage; when storage
is unavailable, a choice applies to the current page only.

The tag sends an initial `page_view`. An accepted, non-honeypot inquiry sends
`generate_lead` with only `form_name`, a fixed service category, and `en`/`es`.
Repeated acknowledgements of the same inquiry do not produce another event in
that tab. Names, email addresses, business names, project messages, and inquiry
IDs are not sent as analytics parameters. Page/referrer URLs have their query
strings and fragments removed. Advertising signals and personalization are off.
Campaign query tags are also removed, so traffic attribution uses the available
referrer rather than relying on UTM parameters.

## Connect the Django reporting panel

The dashboard lives at **`/admin/analytics/`** and appears as **Website analytics**
in the Jazzmin sidebar. It requires Django staff login and
`inquiries.view_inquiry` permission; superusers have access. It has no public
reporting endpoint and never sends reporting credentials to the browser.

Tracking and reporting use two different identifiers:

| Setting | Where | Value |
| --- | --- | --- |
| `GA4_MEASUREMENT_ID` | Frontend runtime | Web stream ID, such as `G-…` |
| `GA4_PROPERTY_ID` | Django environment | Numeric **Property ID** from GA4 property details |
| `GOOGLE_APPLICATION_CREDENTIALS` | Django environment | Absolute path to a private service-account JSON file |

Only the latter two settings are consumed by this backend branch. The public
Measurement ID and visitor consent controls belong to the frontend integration.

1. Use the same GA4 property that owns the website's Web stream. A dedicated
   Cronoverse property keeps the dashboard focused on this website; reports
   include all activity in the configured property.
2. In Google Cloud, create/select a project, enable **Google Analytics Data API**,
   and create a service account for reporting.
3. In GA4 **Admin → Property access management**, add the service account's email
   address with **Viewer** access to this property. A Google Cloud IAM role
   alone does not grant GA4 report access.
4. Provide its JSON credential through server secret storage or a private file
   outside the repository and set `GOOGLE_APPLICATION_CREDENTIALS` to the mounted
   file path. Do not paste the private key into chat, Git, or a frontend setting.
5. Set `GA4_PROPERTY_ID` to the property's numeric ID and restart Django. Open
   **Website analytics** and select a reporting period.

The application uses Google's official Python client with REST transport and
only the `analytics.readonly` OAuth scope. OAuth HTTP calls have a five-second
timeout; report calls have eight-second timeouts with retries disabled.

### Compose credential mount

Keep the JSON outside the checkout and set in `backend/.env`:

```dotenv
GA4_PROPERTY_ID=YOUR_NUMERIC_PROPERTY_ID
GA4_CREDENTIALS_SOURCE_FILE=/private/cronoverse/analytics-service-account.json
```

Start with the optional secret-mount overlay:

```sh
cd backend
docker compose -f compose.yaml -f compose.analytics.yaml up -d --build
```

Only the web service receives the reporting credential, mounted read-only at
`/run/secrets/google_analytics_credentials`. The overlay supplies
`GOOGLE_APPLICATION_CREDENTIALS` inside the container. Native deployments use
`GOOGLE_APPLICATION_CREDENTIALS` directly instead. The file must be readable
by the Django service account.

## What the dashboard shows

- Active users, sessions, page views, and `generate_lead` inquiry-event counts
  for the last **7, 28, or 90 days**, including today.
- A daily active-user chart with an accessible table of users and page views.
- Top ten traffic sources by sessions and device categories by active users.
- Active users from the last **30 minutes**. This is recent activity, not a count
  of browsers that are necessarily still open right now.

Five historical reports use one batch API call, plus one realtime call. Results
are cached on the Django server for 60 seconds; refreshing inside that interval
reuses the report. Response headers prohibit browser/shared caching. Django's
local-memory cache is per worker; a shared cache can be configured separately
if the reporting traffic needs it.

The date range follows the GA4 property's time zone. Daily rows without activity
are filled with zeros after a successful report. Missing setup, permission
errors, quota errors, and connection failures show explicit states without fake
metrics. A realtime failure preserves successful historical reports and shows
an unavailable value. Google thresholding is flagged when the API reports it.

GA4 measures visitors who allow tracking. Ad blockers and consent choices can
reduce counts. Historical reports take time to process and today's values can
change. Inquiry events in GA4 can be fewer than stored inquiries; the Django
inquiry inbox remains the record of submissions. These metrics start when
tracking is activated; installation does not recreate past traffic.

## Verify

```sh
DJANGO_DEBUG=1 backend/.venv/bin/python backend/manage.py test inquiries
```

Backend tests cover admin permissions, reporting requests, caching, empty/error
states, and escaped external labels using Google's actual response types with
mocked API calls. Real GA4 retrieval needs the configured property and credential.

The eight consent/tracking tests live in `tests/analytics.test.mjs` on
`feat/django-inquiry-emails`. Bring them over with the frontend integration,
then run its `test:analytics`, type check, and build. They cover consent, tag
initialization, sanitized URLs, and inquiry-event allowlists/deduplication.

Google references: [Measurement ID](https://support.google.com/analytics/answer/12270356),
[Data API setup](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart),
[Python service-account example](https://github.com/googleanalytics/python-docs-samples/blob/main/google-analytics-data/quickstart_json_credentials.py),
[batch reports](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/batchRunReports),
and [realtime reporting](https://developers.google.com/analytics/devguides/reporting/data/v1/realtime-basics).
