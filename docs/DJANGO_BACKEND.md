# Django inquiry backend

A visitor submits the existing English/Spanish form. The same-origin Worker
endpoint validates and forwards it to Django with a server-only shared key.
Django commits the inquiry and two email jobs together, then returns success.
A separate worker sends the welcome and owner notification through Django SMTP.
The visitor never receives the backend key, admin credentials, or stored records.

The backend uses Django 5.2, Django REST Framework, Jazzmin over Django's admin,
and a database outbox. It needs a Python service separate from the Cloudflare
frontend: the current Sites Worker cannot host this Django process or its SMTP
connection.

## Run locally

Python 3.12+, Node 22.13+, and the repository's pinned pnpm are required. From the
repository root:

```sh
corepack enable
corepack pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
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

In a third terminal:

```sh
corepack pnpm dev
```

Open the frontend's printed URL and submit the form. The development email
backend prints both complete messages to the worker terminal; it does not send
external email. Log into `http://127.0.0.1:8000/admin/` with the superuser you
created. SQLite records live in ignored `backend/data/`. No default admin
password is included.

Local Worker settings belong in `.dev.vars`; backend settings belong in
`backend/.env`. Both files are ignored. The shared key must match on both sides.
Do not put it in a `NEXT_PUBLIC_*` or `VITE_*` variable. Copying `.env.example`
alone does not configure Wrangler's local Worker bindings.

## SMTP and owner mailbox

Configure these in the backend environment before sending real mail:

| Setting | Purpose |
| --- | --- |
| `EMAIL_BACKEND` | Set `django.core.mail.backends.smtp.EmailBackend` |
| `EMAIL_HOST`, `EMAIL_PORT` | Your provider's SMTP endpoint and port |
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | SMTP credentials, supplied through secret storage |
| `EMAIL_USE_TLS`, `EMAIL_USE_SSL` | STARTTLS is normally TLS=1/SSL=0; implicit TLS is TLS=0/SSL=1. Use your provider's settings. |
| `DEFAULT_FROM_EMAIL` | Approved sender, such as `Cronoverse Web Studio <your-sender@example.com>` |
| `INQUIRY_NOTIFICATION_EMAIL` | the owner's exact mailbox for new-inquiry alerts |
| `INQUIRY_REPLY_TO_EMAIL` | Address customers reach when replying to the welcome message |
| `STUDIO_URL` | Public frontend origin used in welcome emails |
| `DJANGO_PUBLIC_BASE_URL` | Public HTTPS backend origin used in the owner email's admin link |

All example mailboxes are placeholders. No real sender or recipient has been
selected. Use the SMTP provider's app password or SMTP credential where required,
and configure its verified sender/domain. Credentials belong in the host's
secret settings; do not commit them or paste them into a PR.

The visitor gets a plain-text and HTML welcome in their selected language saying
someone will contact them. The owner's email contains their name, email, business,
requested service, preferred language, project message, and an admin link. Replying
to the owner's notification addresses the visitor. Internal staff notes never
appear in these messages.

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
- HTTPS `DJANGO_PUBLIC_BASE_URL`, the actual owner/reply mailboxes, and SMTP settings.
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

Publish the frontend source only after those settings are available. Missing or
unreachable Django returns 503 and keeps the visitor's form available for retry;
there is no silent D1 fallback that would bypass admin storage and email jobs.
A GitHub push or PR does not deploy the Site or start the Python host.

The previous D1 binding/schema/migrations remain in the repository to preserve
historical data. New inquiries use Django only. Existing D1 records are not
migrated automatically, and nothing here deletes them or sends old inquiries new
welcome emails. Domain and mail DNS records are not changed by this branch.

## Verification

```sh
DJANGO_DEBUG=1 backend/.venv/bin/python backend/manage.py test inquiries
DJANGO_DEBUG=1 backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
corepack pnpm test:inquiries
backend/.venv/bin/python scripts/smoke-inquiries.py
corepack pnpm typecheck
corepack pnpm build
```

The tests use local in-memory email and test databases. The SMTP smoke uses
a temporary database and a loopback SMTP receiver, exercising real Django SMTP
without contacting an external mailbox. PostgreSQL concurrency tests run in
the backend CI job; they are skipped on local SQLite. To verify real delivery,
configure the provider and submit a test using your own address, then confirm the
two inbox messages and their admin delivery states. Do not use a prospective
customer's address for deployment tests.
