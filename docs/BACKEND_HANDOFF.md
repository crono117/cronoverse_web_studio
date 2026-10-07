# Backend handoff

The inquiry milestone is implemented in the Django backend. Read
[DJANGO_BACKEND.md](DJANGO_BACKEND.md) for setup, SMTP settings, admin access,
delivery retries, production service commands, and frontend activation.

Preserve the approved frontend artwork and English/Spanish behavior. Work on
`feat/django-inquiry-emails`; main is the review baseline. No deployment is
performed by a GitHub push.

## Request contract

The browser continues to submit `POST /api/inquiries` with JSON:

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
| `id` | UUID, reused for identical retries |
| `name` | Trimmed single line, 2–100 characters |
| `email` | Valid email, at most 254 characters; normalized to lowercase |
| `business` | Optional, trimmed, at most 160 characters |
| `service` | `new`, `redesign`, `app`, or `unsure` |
| `message` | Trimmed, 10–4000 characters |
| `language` | `en` or `es` |
| `website` | Honeypot; empty or omitted |

Creation returns `201 {"ok":true}` after inquiry and email-job storage commits.
An identical retry returns `200 {"ok":true}`. A changed payload using an existing
UUID returns 409. Other responses: 400 invalid data, 403 unexpected Origin,
413 body exceeds 24,000 bytes, 415 wrong content type, 429 email quota with
Retry-After, and 503 unavailable backend/storage. Responses reveal no records.

The frontend-to-Django hop uses a server-only shared key. Direct Django intake
requires that key in production and when configured locally. Django rejects
unapproved callers with 403; the frontend turns backend authentication/config
errors into a generic 503.

The legacy D1 files remain for historical data; the new intake does not dual-write
or silently fall back. Do not delete production D1 records. Inventory, appointments,
orders, and charts in the carousel are still isolated samples.

## Before activation

The selected SMTP provider is Mailjet: `in-v3.mailjet.com:587` with STARTTLS.
Both messages come from `Cronoverse Web Studio <info@cronoverse.online>`; owner
alerts go to `lh@cronoverse.online`, and welcome replies go to `info@cronoverse.online`.

The implementation is testable locally. Live activation needs a Python host,
Mailjet API/Secret keys in server secret storage, sender/domain verification in
Mailjet, a working `info` mailbox or alias for replies, a running email worker,
and the Site's backend runtime configuration. Keep all credentials and inquiry
records out of Git. Run checks/builds, then test both messages using the owner's
own email address before inviting real submissions.
