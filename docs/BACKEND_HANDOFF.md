# Backend handoff

`feat/django-backend` contains the standalone Django implementation: inquiry
storage, Jazzmin admin, the Mailjet SMTP worker, and the GA4 reporting panel.
It branches from the original `main` and leaves frontend files unchanged.
The landing page on this branch still saves to D1 until its server route is
connected to Django.

Run the Python service with [DJANGO_BACKEND.md](DJANGO_BACKEND.md). To combine it
with the updated animated frontend, give your home agent
[HOME_MACHINE_HANDOFF.md](HOME_MACHINE_HANDOFF.md). The full prior integration
on `feat/django-inquiry-emails` is a reference for the proxy and tracking code.

## Django request contract

The backend accepts `POST /api/inquiries`, without a trailing slash, with
`Content-Type: application/json` and a server-only `X-Inquiry-Api-Key` header.
The header must match `INQUIRY_API_KEY` in Django. Example JSON:

```json
{
  "id": "f2489d29-7570-4f76-aa28-352b22f856ef",
  "name": "Example Customer",
  "email": "customer@example.com",
  "business": "Example Studio",
  "service": "new",
  "message": "I would like a website for my local business.",
  "language": "en",
  "website": ""
}
```

| Field | Validation |
| --- | --- |
| `id` | UUID, reused for identical retries; new UUID when contents change |
| `name` | Trimmed single line, 2–100 characters |
| `email` | Valid email, at most 254 characters; normalized to lowercase |
| `business` | Optional, trimmed, at most 160 characters |
| `service` | `new`, `redesign`, `app`, or `unsure` |
| `message` | Trimmed, 10–4000 characters |
| `language` | `en` or `es` |
| `website` | Honeypot; empty or omitted |

Creation returns `201 {"ok":true}` after inquiry and email-job storage commits.
An identical retry returns `200 {"ok":true}`; changed data with the same UUID
returns 409. Invalid data returns 400, a wrong/missing configured key returns
403, a body above 24,000 bytes returns 413, a wrong content type returns 415,
an email quota violation returns 429 with Retry-After, and a storage outage
returns 503. Responses reveal no saved inquiry records.

Browsers must submit to a same-origin frontend server route. That server
validates Origin and adds the backend key itself, then forwards to Django.
The reference proxy converts backend auth/config failures to a generic 503.
Never put the key in browser JavaScript or a public environment variable.
The Django API has no public inquiry-list or detail endpoint.

## Email and admin

Both messages use `Cronoverse Web Studio <info@cronoverse.online>` through
Mailjet `in-v3.mailjet.com:587` with STARTTLS. Welcome messages are English or
Spanish and say someone will contact the visitor. Owner alerts go to
`lh@cronoverse.online`; replies to the welcome go to `info@cronoverse.online`.

The web server stores inquiries and queues email jobs. Keep the separate
`process_inquiry_emails` worker running to send and retry them. Local settings
use console mail; Mailjet credentials and sender verification are needed for
live delivery. See the setup guide for the inbox/alias and DNS steps.

## Analytics

`/admin/analytics/` reads Google's reports with staff permission and read-only
service-account credentials. Configure numeric `GA4_PROPERTY_ID` and a private
credential path on the backend. The frontend integration must separately use
the same property's Web-stream `GA4_MEASUREMENT_ID` and consent controls.
Missing analytics configuration shows setup guidance without blocking inquiries.
See [GOOGLE_ANALYTICS.md](GOOGLE_ANALYTICS.md).

## Branch boundaries

The new branch changes only `backend/`, backend documentation, ignore rules,
the README, and a backend CI workflow. It does not replace the hero, install a
frontend proxy, modify D1 records, deploy a Python host, configure secrets, or
publish the Site. Preserve historical D1 data during the eventual cutover.

`feat/animated-palm-hero` already contains an independent `backend/config`
and `backend/leads` scaffold. Import its frontend changes selectively. Use the
`backend/cronoverse` and `backend/inquiries` implementation from this branch
for Mailjet and analytics; inspect and migrate any existing local lead data
before retiring a different backend.
