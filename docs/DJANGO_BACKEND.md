# Django inquiry backend

The Python service lives in `backend/` and runs independently of the frontend.
On `feat/frontend-django-integration` the animated frontend's `/api/inquiries`
server route is connected to it; see
[FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md). (`feat/django-backend` itself
keeps the original D1 route.)

Once connected, the visitor's English/Spanish form submits to a same-origin
server endpoint that validates and forwards to Django with a server-only shared
key. Django commits the inquiry and two email jobs together, then returns success.
A separate worker sends the welcome and owner notification through Django SMTP.
The browser never receives the backend key, admin credentials, or stored records.

The backend uses Django 5.2, Django REST Framework, Jazzmin over Django's admin,
and a database outbox. It needs a Python service separate from the Cloudflare
frontend: the current Sites Worker cannot host this Django process or its SMTP
connection.

## Run locally

Python 3.12+ is required for the backend. From the repository root, copy the
example only when `backend/.env` does not already exist:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.lock.txt
cp backend/.env.example backend/.env
backend/.venv/bin/python backend/manage.py migrate
backend/.venv/bin/python backend/manage.py createsuperuser
backend/.venv/bin/python backend/manage.py runserver 127.0.0.1:8000
```

In a second terminal, start email delivery:

```sh
backend/.venv/bin/python backend/manage.py process_inquiry_emails
```

Log into `http://127.0.0.1:8000/admin/` with the superuser you created. SQLite
records live in ignored `backend/data/`. No default admin password is included.
The development email backend prints both messages to the worker terminal;
it does not send external email.

You can test the backend directly without installing frontend dependencies.
Use an HTTP client to POST the JSON in [BACKEND_HANDOFF.md](BACKEND_HANDOFF.md)
to `http://127.0.0.1:8000/api/inquiries`, with `Content-Type: application/json`
and an `X-Inquiry-Api-Key` matching your local `INQUIRY_API_KEY`. A successful
request saves one inquiry and two delivery jobs visible in admin.

After frontend integration, local Worker settings belong in ignored `.dev.vars`;
backend settings belong in ignored `backend/.env`. The shared key must match
on both servers. Do not put it in a `NEXT_PUBLIC_*` or `VITE_*` variable. `.dev.vars.example`
and `.env.example` list the frontend runtime keys; `pnpm start` needs a copy of
`.dev.vars` beside the built Worker config (see FRONTEND_INTEGRATION.md).

## Mailjet SMTP and owner mailbox

Configure these in the backend environment before sending real mail:

| Setting | Purpose |
| --- | --- |
| `EMAIL_BACKEND` | Set `django.core.mail.backends.smtp.EmailBackend` |
| `EMAIL_HOST`, `EMAIL_PORT` | `in-v3.mailjet.com`, port `587` |
| `EMAIL_HOST_USER` | Mailjet API Key (SMTP username), supplied through secret storage |
| `EMAIL_HOST_PASSWORD` | Mailjet Secret Key (SMTP password), supplied through secret storage |
| `EMAIL_USE_TLS`, `EMAIL_USE_SSL` | `1`, `0` for STARTTLS on port 587 |
| `DEFAULT_FROM_EMAIL` | `Cronoverse Web Studio <info@cronoverse.online>` for both outgoing messages |
| `INQUIRY_NOTIFICATION_EMAIL` | `lh@cronoverse.online` for new-inquiry alerts |
| `INQUIRY_REPLY_TO_EMAIL` | `info@cronoverse.online` for replies to the welcome message |
| `STUDIO_URL` | Public frontend origin used in welcome emails |
| `DJANGO_PUBLIC_BASE_URL` | Public HTTPS backend origin used in the owner email's admin link |

The sender and welcome reply address default to `info@cronoverse.online` in Django.
The environment example selects the existing `lh@cronoverse.online` mailbox for
owner alerts. Enable `info@cronoverse.online` as a mailbox or receiving alias
with the existing mailbox provider so customer replies reach you. Verify the
sender address or `cronoverse.online` domain in Mailjet to authorize sending.
Setting a From header in Django does not create a mailbox or verify a sender.

Django creates and sends these messages on the backend server through its SMTP
backend, connecting to Mailjet over STARTTLS. No Mailjet SDK or browser-side email
credentials are needed. Credentials belong in the host's secret settings; do not
commit them or paste them into a PR. Local development stays on the console
backend until SMTP is explicitly selected.

### Activate Mailjet delivery

1. In Mailjet, add and validate `cronoverse.online` under the API key used for this
   backend, or verify `info@cronoverse.online` as a sender address. Domain validation
   by DNS uses the TXT value shown in your Mailjet account.
2. Add the SPF and DKIM records shown by Mailjet to the domain's DNS and confirm
   their status in Mailjet. If the domain already has SPF for its mailbox
   provider, merge Mailjet's authorization into that record rather than adding
   a second SPF record. Keep the existing mailbox MX records.
3. In **Account settings → SMTP and SEND API settings**, obtain the API Key and
   Secret Key. The SMTP login is these keys, not an email address or the password
   used to log into Mailjet or the existing mailbox.
4. Configure the backend environment as follows and keep the email worker running:

```dotenv
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=in-v3.mailjet.com
EMAIL_PORT=587
EMAIL_USE_TLS=1
EMAIL_USE_SSL=0
DEFAULT_FROM_EMAIL=Cronoverse Web Studio <info@cronoverse.online>
INQUIRY_NOTIFICATION_EMAIL=lh@cronoverse.online
INQUIRY_REPLY_TO_EMAIL=info@cronoverse.online
```

Set `EMAIL_HOST_USER` to the API Key and `EMAIL_HOST_PASSWORD` to the Secret Key
separately in server secret storage. These public settings alone do not activate
delivery. Domain verification is specific to the API key: use the key whose
sender/domain you verified. See Mailjet's [SMTP configuration](https://documentation.mailjet.com/hc/en-us/articles/360043229473-How-can-I-configure-my-SMTP-parameters),
[domain validation](https://documentation.mailjet.com/hc/en-us/articles/360042561594-How-to-validate-an-entire-sending-domain),
and [SPF/DKIM guide](https://documentation.mailjet.com/hc/en-us/articles/360049641733-Authenticating-Domains-with-SPF-and-DKIM-A-Complete-Guide).

If the existing mailbox in the screenshot is Namecheap Private Email, create
the receiving alias via the dropdown next to `lh@cronoverse.online`:
**Manage Aliases → Add Alias → info → Save Changes**. Mail to the alias reaches
that mailbox; Django still sends through Mailjet. See Namecheap's
[alias instructions](https://www.namecheap.com/support/knowledgebase/article.aspx/10791/2215/how-to-create-an-alias-for-namecheap-private-email/).

The visitor gets a plain-text and HTML welcome in their selected language saying
someone will contact them. The owner's email contains their name, email, business,
requested service, preferred language, project message, and an admin link. Replying
to the owner's notification addresses the visitor. Internal staff notes never
appear in these messages.

## Website analytics in admin

The Jazzmin sidebar includes **Website analytics** at `/admin/analytics/`.
It reads GA4 reports using Google's official Data API client with read-only
authorization. See [GOOGLE_ANALYTICS.md](GOOGLE_ANALYTICS.md) for the frontend
Measurement ID, numeric reporting Property ID, server credential, and optional
Compose secret mount. Missing reporting configuration does not stop inquiry
storage or email delivery.

## Admin and delivery controls

`/admin/` uses Django staff authentication and its normal session/CSRF protection.
The public API has no inquiry list, detail, or mutation endpoint. A Sites sign-in
header does not grant Django admin access.

Project inquiries support search, filters, internal notes, and statuses:
New → Contacted → Qualified → Closed. Each detail includes both email deliveries,
with pending/sent/retry/failed state, attempts, and the last error type. The
Email deliveries list has **Retry selected failed emails**. It queues only
unsent failed/retry records and leaves successfully sent emails alone.

The worker polls every five seconds by default, claims jobs with an exclusive
expiring lease, and retries failures with increasing delays, up to eight attempts.
You must keep it running alongside the web service. Alternatively, invoke
`process_inquiry_emails --once` regularly from a scheduler. Email failure never
rolls back a committed inquiry.

Repeated submissions with the same UUID and identical normalized fields reuse
the existing inquiry and jobs. The form creates a new UUID when its contents
change. Three inquiries per normalized email are allowed per rolling hour;
PostgreSQL row locks serialize concurrent quota checks. This is basic abuse
protection; addresses can be rotated. Add host-level traffic controls if needed.
SQLite is intended for local use, where competing writers may return a retryable
503. There is no claim of a global submission limit.

SMTP cannot guarantee exactly-once delivery: if the provider accepts a message
and the process stops before recording success, a recovery retry can deliver it
again. Stable Message-ID values and tracked sent states reduce ordinary duplicate
sends; they do not eliminate this crash/timeout window. “Sent” means the email
backend accepted the message, not proof of inbox delivery or a read receipt.

## Production service

Use an HTTPS Python host, a persistent PostgreSQL database, and both the web and
email-worker processes. `backend/Dockerfile` and `backend/compose.yaml` provide
Gunicorn, PostgreSQL, a migration job, and the worker. Docker was not available
in the development workspace; the Python application and SMTP path were tested
directly. The Compose setup binds Django to localhost; put your HTTPS reverse
proxy in front of it.

In `backend/.env`, set:

- `DJANGO_DEBUG=0` and a random `DJANGO_SECRET_KEY` of at least 50 characters.
- A random `INQUIRY_API_KEY` of at least 32 characters.
- Explicit `DJANGO_ALLOWED_HOSTS` and HTTPS `DJANGO_CSRF_TRUSTED_ORIGINS`.
- HTTPS `DJANGO_PUBLIC_BASE_URL`, the selected Cronoverse mailboxes, and SMTP settings.
- A generated `POSTGRES_PASSWORD`; use hexadecimal characters for the Compose
  database URL, or URL-encode special characters in a separately configured URL.

Set `DJANGO_TRUST_PROXY=1` only behind a proxy that overwrites the forwarded
protocol header. Keep Django inaccessible to untrusted direct traffic. Set the
reverse proxy's request body limit to 24 KB. Production settings reject debug
secrets, missing mailboxes, an empty SMTP host, and console-only mail delivery.

```sh
cd backend
docker compose up -d --build
docker compose exec web python manage.py createsuperuser
docker compose exec web python manage.py check --deploy
docker compose logs -f email-worker
```

The deployment check reports optional HSTS subdomain/preload warnings. Choose
those policies once HTTPS coverage for the backend domain is known.

Admin assets are collected into the image and served with WhiteNoise. Back up
the PostgreSQL volume. Do not mount development database files into the frontend
or include them in Git.

## Connect the hosted frontend

After the HTTPS backend and worker are working, set these **server runtime** keys
on the existing Site, keeping its audience unchanged:

- `INQUIRY_BACKEND_URL`: the HTTPS backend origin, without `/api/inquiries`.
- `INQUIRY_API_KEY`: the same backend secret, marked as a secret.

The proxy and form changes are integrated on `feat/frontend-django-integration`.
Publish that frontend source only after those settings are available. The
proxy returns 503 for missing or unreachable Django and keeps the form
available for retry; it has no silent D1 fallback that would bypass admin storage
and email jobs. (`feat/django-backend` still uses D1.)
A GitHub push or PR does not deploy the Site or start the Python host.

The previous D1 binding/schema/migrations remain in the repository to preserve
historical data. After frontend integration, new inquiries use Django only. Existing D1 records are not
migrated automatically, and nothing here deletes them or sends old inquiries new
welcome emails. Domain and mail DNS records are not changed by this branch.

## Verification

```sh
DJANGO_DEBUG=1 backend/.venv/bin/python backend/manage.py test inquiries
DJANGO_DEBUG=1 backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
```

The tests use in-memory email, test databases, and mocked Google reports. All 32
Django tests ran successfully on PostgreSQL for the original implementation;
the same backend is checked independently on this branch. The two concurrency
tests are skipped on local SQLite. The frontend proxy tests (`pnpm test:inquiries`),
analytics tests (`pnpm test:analytics`), and the loopback SMTP smoke
(`scripts/smoke-inquiries.py`) are included; run them with `pnpm typecheck`
and `pnpm build`.
To verify real delivery,
configure the provider and submit a test using your own address, then confirm the
two inbox messages and their admin delivery states. Do not use a prospective
customer's address for deployment tests.
