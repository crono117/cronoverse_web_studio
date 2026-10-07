# Home-machine integration prompt

Give the following instructions to the agent on the home PC. This is a source
integration and local verification task; publication and real email activation
depend on the owner's configured host and credentials.

## Goal

Connect the updated animated Cronoverse landing page to the tested Django
backend, retaining the latest hero animation, approved artwork, colors, and
English/Spanish behavior.

Repository: https://github.com/crono117/cronoverse_web_studio

| Branch | Use |
| --- | --- |
| `feat/django-backend` | Django/Jazzmin, inquiry storage, Mailjet worker, GA4 admin reports; frontend remains the original baseline |
| `feat/animated-palm-hero` | Existing animated frontend reference, plus a separate older backend scaffold |
| `feat/django-inquiry-emails` | Previously tested frontend proxy and GA4 consent/tracking reference |
| New `feat/frontend-django-integration` | Combine the current local animated frontend with the dedicated backend |

The reference proxy/tracking revision is
`92fd91102b9beea73d3df088e4369842986766fc`. Fetch current branches and inspect
any later changes before selecting code.

## 1. Inspect and preserve the local project

Locate the owner's checkout and hero ZIP; a previously mentioned location is
`/home/crono/dev/crono_web_studio/`. Verify the remote and current branch.
Read the ZIP's `CLAUDE_CODE_PROMPT.md` and any applicable project instructions.
Compare the home frontend to `origin/feat/animated-palm-hero` and use the newer
approved version.

Inspect `git status` first. Preserve uncommitted frontend changes and local
assets. Keep private env files and database contents out of Git. Avoid replacing
the owner's working checkout or copying an entire old backend directory from
the ZIP.

Start an isolated integration worktree from the new backend branch:

```sh
git fetch origin
git worktree add -b feat/frontend-django-integration ../cronoverse_frontend_integration origin/feat/django-backend
```

If that branch/worktree already exists, inspect and reuse it instead of
resetting it. Copy approved local frontend changes into this worktree after
comparison, retaining their original checkout as a recovery copy.

## 2. Select the frontend, retain this backend

Preserve the animated hero, scene images, responsive behavior, reduced-motion
support, translations, logo, and showcase. The existing hero branch adds
`components/hero-scenes.tsx`, `lib/cronoverse-fumes.ts`, five hero scene images,
and changes to `app/page.tsx` and `app/globals.css`; the local ZIP may be newer.

Retain the complete `backend/` from `feat/django-backend`.
The hero branch contains an independent `backend/config` and `backend/leads`
implementation. Do not combine both settings packages, replace the inquiry
models, or discard existing local lead databases. If a previous backend has
records, inventory the schema/data and prepare an explicit migration separately.

Do not blindly merge the complete older integration branch over the hero.
Bring over its server proxy and tracking components selectively.

## 3. Connect the form through a server route

Use these files from the reference integration as the starting point:

- `lib/inquiry-intake.ts`: bounded validation, same-origin checks, backend
  URL validation, timeout, and server-key forwarding.
- `app/api/inquiries/route.ts`: same-origin server route.
- `tests/inquiry-proxy.test.mjs`: proxy contract and failure tests.
- `cloudflare-env.d.ts`: only the necessary optional runtime bindings.
- `.dev.vars.example` and `.env.example`: adapt public examples without
  overwriting actual env files.
- `scripts/smoke-inquiries.py`: loopback SMTP smoke after adapting the build.

In the current Vinext/Cloudflare stack, the server uses
`INQUIRY_BACKEND_URL` and secret `INQUIRY_API_KEY` runtime bindings. If the
updated frontend uses a different server runtime, adapt those reads to that
runtime while keeping the shared key server-only. Use the same key in Django.

The browser calls its own `/api/inquiries` route, not Django directly. Match
[BACKEND_HANDOFF.md](BACKEND_HANDOFF.md), including the UUID, optional business,
fixed service values, `en`/`es`, and honeypot. Reuse the UUID for unchanged
retries and generate a new one when form contents change.

Keep bilingual pending/error/success states. Show success only after a
200/201 response with `ok: true`. Preserve the form for retry on backend
outages. After activation, save new inquiries to Django rather than silently
falling back or dual-writing to D1. Retain historical D1 records and migrations.

## 4. Add GA4 tracking without replacing the hero layout

Reuse `lib/analytics.ts`, `components/google-analytics.tsx`, and
`tests/analytics.test.mjs` from the reference integration. Adapt the layout
hook, runtime `GA4_MEASUREMENT_ID` binding, bilingual consent UI, and CSS to
the updated frontend. Merge the layout/form changes without replacing the
hero markup.

No Google script before consent. Keep advertising consent denied. Strip
query strings/fragments, send only approved categories, and never include
names, email addresses, business names, messages, or inquiry UUIDs in Google
events. Trigger `generate_lead` only after a successful non-honeypot inquiry;
deduplicate successful retries. Set up one tag and turn off Enhanced measurement
as described in [GOOGLE_ANALYTICS.md](GOOGLE_ANALYTICS.md).

The dashboard's numeric `GA4_PROPERTY_ID` and private Google credential remain
on Django. Without the owner's IDs/credentials, test setup/error states and
mocked reports; do not invent traffic or insert placeholder production IDs.

## 5. Verify locally

Use the pinned Python dependencies and run:

```sh
DJANGO_DEBUG=1 backend/.venv/bin/python backend/manage.py check
DJANGO_DEBUG=1 backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
DJANGO_DEBUG=1 backend/.venv/bin/python backend/manage.py test inquiries
```

Run the imported eight proxy tests and eight analytics tests, plus frontend
type checking/build for the actual stack. Add the corresponding package
scripts and workflow steps as part of integration. The new backend workflow
already tests all 32 Django tests against PostgreSQL.

Use console mail or the loopback SMTP smoke initially. Confirm one inquiry,
two queued jobs, English/Spanish welcomes, the correct sender/owner address,
and idempotent retries. Test the admin login/permissions and reporting setup
state. Inspect the animated hero at mobile and desktop sizes and with reduced
motion enabled.

Real Mailjet delivery requires server credentials and sender/domain verification.
Use only the owner's chosen test address for an explicitly authorized live test.
Report which live integrations remain unconfigured.

## 6. Deliver the integration

Commit and push the new integration branch, then create/update a draft PR.
Include the final branch/commit, commands and results, screenshots of the hero,
and the remaining host/SMTP/GA4 configuration. Preserve the existing backend
and hero branches. Keep the live Site and DNS unchanged during this local
integration task; GitHub pushes do not deploy the Python service or Site.
