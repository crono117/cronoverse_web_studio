# Backend handoff

## Baseline

Preserve the approved frontend, English/Spanish behavior, and navy-ring Saturn-eye
icon. Use a feature branch for backend work; GitHub main is the handoff baseline.

The current server uses Vinext on Cloudflare Workers and D1. No separate Django,
Python, or Express service has been introduced. The existing backend is inquiry
intake, not a completed CRM.

## Existing API

`POST /api/inquiries` with `Content-Type: application/json`:

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
| `id` | Client-generated UUID; reuse for ordinary retries |
| `name` | Trimmed, 2–100 characters |
| `email` | Valid email, at most 254 characters; normalized to lowercase |
| `business` | Optional, trimmed, at most 160 characters |
| `service` | `new`, `redesign`, `app`, or `unsure` |
| `message` | Trimmed, 10–4000 characters |
| `language` | `en` or `es` |
| `website` | Honeypot; empty or omitted |

Successful creation returns `201 {"ok":true}`. An existing UUID belonging to the
same email returns `200 {"ok":true}`. Validation and honeypot failures return 400;
unexpected Origin returns 403; ID/email conflict returns 409; oversize text returns
413; unsupported content type returns 415; the email limit returns 429 with
`Retry-After`; unavailable storage returns 503.

The `inquiries` table has an index on `(email, created_at)`. A maximum of three
submissions per email in a rolling hour is allowed. This is basic protection:
email addresses can be rotated and requests without Origin are allowed. The size
check currently occurs after reading the request body.

Review idempotency concurrency before claiming stronger guarantees: simultaneous
requests can miss the initial SELECT, and a losing insert can currently receive
429 even when it was a duplicate retry.

## Local database

```sh
corepack pnpm db:migrate:local
corepack pnpm dev
```

`wrangler.local.jsonc` matches the `DB` binding and placeholder database ID in
`vite.config.ts`. Both use `.wrangler/state`. The migration command includes
`--local` and does not target the live Site database.

After schema changes, run `corepack pnpm db:generate`, inspect the new migration,
and apply it locally. Do not edit already-applied migrations.

## Proposed first milestone: inquiry management

1. Choose production admin authentication for the intended host. Require explicit
   owner authorization for every inquiry read or mutation.
2. Add an authenticated inbox with pagination, search, and inquiry detail views.
3. Add status changes (new, contacted, qualified, closed) through a new migration,
   with timestamps and an audit trail.
4. Add email notifications through a chosen provider and verified recipient.
   Separate delivery from saving inquiries; retry without sending duplicates or
   losing successfully saved records when mail fails.
5. Add endpoint tests for validation, authorization, rate limits, concurrent
   requests, storage failures, and notification retries.

No provider, mailbox, staff account, or new auth service was configured by this
export. Choose those before implementing the corresponding integration.

## Boundaries

- Do not expose customer inquiries through a public read endpoint.
- The Sites identity helper trusts proxy-provided headers. Outside that hosting
  path, client-supplied identity headers must not grant admin access.
- Inventory, appointments, orders, and charts in the carousel remain isolated
  samples until a real workflow and data model are requested.
- Keep credentials in environment/secret storage and customer records out of Git.
- GitHub stores source; it does not automatically update the live Site.

## Before merging

Run `corepack pnpm typecheck` and `corepack pnpm build`, apply migrations to a fresh
local database, and exercise inquiry submission plus new authenticated flows.
Recheck English/Spanish labels and form error/success states. Add CI when the
backend test runner and deployment target are settled.
