# Deploying the website with Docker

This runs the whole site (frontend, Django, email worker, PostgreSQL) as four containers
that sit **beside** another stack on the same server. The existing reverse proxy keeps
ports 80 and 443 and routes the new hostnames to them. Nothing here publishes a host port.

```
                        ┌──────────────── existing Caddy (80/443, TLS) ────────────────┐
 cronoverse.online ───▶ │  cronoverse-frontend:8787                                    │
 www. (redirects)       │                                                              │
 admin.cronoverse.online│  cronoverse-backend:8000     ◀── frontend, over `http://backend:8000`
                        └──────────────────────────────────────────────────────────────┘
        frontend ──▶ backend (Django, gunicorn) ──▶ db (PostgreSQL)      email-worker ──▶ Mailjet :2525
```

| File | Purpose |
| --- | --- |
| `../Dockerfile` | Frontend image: the Worker build on Wrangler's local runtime |
| `../backend/Dockerfile` | Django image (unchanged from the backend branch) |
| `compose.yaml` | The four services, memory limits, networks, no published ports |
| `.env.example` | Every setting; copy to `.env` on the server |
| `ship.sh` | Build images here, stream them to the server over SSH, optionally start |
| `caddy/` | Routes for the existing Caddy, plus a Compose override that attaches it |
| `compose.local.yaml` | Local testing only: publishes loopback ports |
| `compose.analytics.yaml` | Optional mount for the GA4 reporting credential |

## Sizing: read this before deploying to a small server

Measured on the running stack (production Django settings, after traffic), in MiB:

| Container | Memory |
| --- | --- |
| frontend (Worker on workerd) | 233 |
| backend (gunicorn, 1 worker, 4 threads) | 83 |
| email-worker | 63 |
| db (PostgreSQL, tuned small) | 21 |
| **Total** | **about 400** |

The frontend is the heavy part, because it runs a full Workers runtime, and it spikes
well above its resting size (about 310 MiB under a small burst on the live server, so it
is capped at 512 MiB; a 320 MiB cap was hit 137 times and stalled requests). A server that is
already using most of a 1 GB machine cannot take another 400 MiB without pushing the
other service into swap or out-of-memory kills. As of the review that led to this
setup, the Xenos droplet (1 vCPU, 1 GB) had about 347 MiB available and was already
using 268 MiB of swap, so **resize it to 2 GB before deploying**, or keep the frontend
elsewhere and run only Django, its worker, and the database here (about 170 MiB).

Images are built on a workstation and streamed to the server. **Never build on a 1 GB
server**: a build can exhaust memory and take the neighbouring service down with it.

## One-time setup

Commands run on your workstation unless marked *(server)*. These are the steps that
were run to deploy to the Xenos droplet on 2026-10-07 (resized to 2 GB first). The
stack and Caddy routing were also tested locally before that.

1. **Resize and snapshot.** In the DigitalOcean console, take a snapshot, then resize
   the droplet to 2 GB choosing *CPU and RAM only* (the disk stays the same, so you can
   resize back). The droplet powers off for a few minutes, so other services restart.
2. **DNS.** At the DNS host add A records for `cronoverse.online`, `www`, and `admin`
   pointing at the server. Leave the existing mail records alone. Certificates are issued
   automatically by Caddy once the records resolve. A computer that looked the names up
   before the records existed may keep the old "does not exist" answer for a while and
   fail to connect; check against `dig @1.1.1.1` or force the address with
   `curl --resolve host:443:SERVER_IP`.
3. **Settings** *(server)*. Create the deploy directory and the env file, then fill it in.
   Generate each secret separately (see the comments in the file):
   ```sh
   ssh root@SERVER 'mkdir -p /opt/cronoverse && chmod 700 /opt/cronoverse'
   scp deploy/.env.example root@SERVER:/opt/cronoverse/.env
   ssh root@SERVER 'chmod 600 /opt/cronoverse/.env && nano /opt/cronoverse/.env'
   ```
   Set `INQUIRY_API_KEY`, `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, the Mailjet keys, and
   `GA4_MEASUREMENT_ID` when you have it. Keep `EMAIL_PORT=2525` (see Email below).

   Two pitfalls from the real deployment: shell commands belong in the shell, and pasting
   them into the editor writes them into `.env` as text, which stops Compose reading the
   file. The file may contain only `NAME=value` lines. And check it without printing the
   secrets (every secret should show `set`, and the mode should be `600`):
   ```sh
   stat -c '%a' .env; grep -c -v -E '^[A-Z0-9_]+=' .env   # expect 600, then 0
   for k in INQUIRY_API_KEY DJANGO_SECRET_KEY POSTGRES_PASSWORD EMAIL_HOST_USER EMAIL_HOST_PASSWORD; do
     grep -q "^$k=." .env && echo "$k: set" || echo "$k: EMPTY"; done
   ```
4. **First deploy.** Builds here, loads the images on the server, and starts the stack:
   ```sh
   DEPLOY_HOST=root@SERVER DEPLOY_KEY=~/.ssh/YOUR_KEY deploy/ship.sh --up
   ```
5. **Admin user** *(server)*:
   ```sh
   cd /opt/cronoverse && docker compose exec backend python manage.py createsuperuser
   ```
6. **Attach the existing Caddy.** `ship.sh` uploaded `caddy/` to `/opt/cronoverse/caddy/`.
   On the server, copy the override next to the Xenos compose file and recreate only the
   Caddy container. This does not edit any tracked Xenos file:
   ```sh
   cd /opt/xenos/app
   cp /opt/cronoverse/caddy/xenos-override.example.yml docker-compose.override.yml
   docker compose config -q                      # must print nothing
   docker compose up -d caddy                    # a few seconds of Caddy downtime
   docker exec xenos-caddy-1 caddy validate --config /etc/caddy/Caddyfile
   ```
   To undo: delete `docker-compose.override.yml` and run `docker compose up -d caddy`.
   The Xenos engine and web containers are not restarted by either command.
7. **Verify.** `https://cronoverse.online/` shows the hero, `https://admin.cronoverse.online/admin/`
   shows the Django login, and a test inquiry from your own address produces two emails
   and appears in the admin. Both Xenos pages (`xenos.cronoverse.online`) should still load.

## Updating and rolling back

```sh
DEPLOY_HOST=root@SERVER DEPLOY_KEY=~/.ssh/YOUR_KEY deploy/ship.sh --up
```

Each build is tagged with the Git commit (suffixed `-dirty` if the tree has uncommitted
changes), and earlier images stay on the server. To roll back:

```sh
ssh root@SERVER 'docker images "cronoverse-*" --format "{{.Repository}}:{{.Tag}}  {{.CreatedSince}}"'
ssh root@SERVER 'cd /opt/cronoverse && CRONOVERSE_TAG=<older tag> docker compose up -d'
```

Migrations only move forward. If a release added one, rolling back the code does not undo
it: restore the database from a backup taken before the release. Take one first, and
remove old images occasionally with `docker image prune -a --filter until=720h`.

## Backups

The database is the only state (inquiries and email history). Back it up daily and copy it
off the server; a copy on the same disk does not survive losing the droplet.

```sh
# on the server
mkdir -p /opt/cronoverse/backups
cd /opt/cronoverse && docker compose exec -T db pg_dump -U cronoverse cronoverse | gzip > backups/cronoverse-$(date +%F).sql.gz
# restore into an empty database (stop writers first)
docker compose stop backend email-worker
gunzip -c backups/cronoverse-YYYY-MM-DD.sql.gz | docker compose exec -T db psql -U cronoverse cronoverse
docker compose start backend email-worker
```

## Operating

```sh
cd /opt/cronoverse
docker compose ps                         # state and health of all services
docker compose logs -f backend email-worker frontend
docker stats --no-stream                  # memory against the limits in compose.yaml
docker compose restart email-worker       # safe: jobs are leased and retried
```

## Email on DigitalOcean

On the Xenos droplet, connections to ports **25, 465, and 587** time out (to Gmail's SMTP
servers as well as Mailjet's, which points to DigitalOcean's outbound SMTP block rather
than a Mailjet problem). Mailjet's port **2525** connects and completes STARTTLS with a
valid certificate, so `.env.example` sets `EMAIL_PORT=2525` with `EMAIL_USE_TLS=1`. With 587 the email worker
would time out on every attempt and no email would ever be sent. On a host without that
block, either port works. Mailjet still needs a verified sender or domain and your API
key and secret before real delivery works.

## Settings that differ from the backend defaults, and why

| Setting | Value | Reason |
| --- | --- | --- |
| `DJANGO_SECURE_SSL_REDIRECT` | `0` | TLS ends at Caddy, which already redirects HTTP to HTTPS, and Django has no public port. With it on, the frontend's internal HTTP call would get a redirect, which the proxy deliberately refuses to follow, so every inquiry would fail. `check --deploy` reports this as `W008`; that is expected here. |
| `DJANGO_TRUST_PROXY` | `1` | So Django sees HTTPS from Caddy's forwarded protocol header. Safe only because Django is reachable solely through Caddy and the private network. |
| `DJANGO_ALLOWED_HOSTS` | includes `backend` | The frontend calls Django as `http://backend:8000`. |
| gunicorn | 1 worker, 4 threads | Keeps memory low on a shared small host. |
| PostgreSQL | small `shared_buffers` and `max_connections` | Its defaults assume far more memory. |

The proxy accepts plain HTTP only for loopback addresses and for dotless hostnames such as
`backend`, which only private DNS can resolve. Any dotted hostname must use HTTPS.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Intermittent 503 "worker restarted mid-request" | Memory pressure on the frontend. Compare `memory.peak` and `memory.events` (`max` counts how often the limit was hit) in `/sys/fs/cgroup/system.slice/docker-<container id>.scope/`, and raise `mem_limit` in `compose.yaml`. |
| Form shows "could not be saved" | First test the Origin check: `curl -s -X POST https://YOUR_SITE/api/inquiries -H 'Content-Type: application/json' -H 'Origin: https://YOUR_SITE' -d '{"website":"x"}'`. `Invalid origin` (403) means the site's public origin is missing from `INQUIRY_ALLOWED_ORIGINS` (it defaults to `STUDIO_URL`); `Please check your details` (400) means the origin check passed. Otherwise `docker compose logs frontend backend`. A 503 from the proxy means Django was unreachable or rejected the key; confirm both containers hold the same `INQUIRY_API_KEY`. |
| Django 400 `DisallowedHost` | The `Host` is missing from `DJANGO_ALLOWED_HOSTS`. |
| Caddy cannot get a certificate | DNS records must resolve to the server and ports 80 and 443 must be open (they are, for Xenos). `docker logs xenos-caddy-1`. |
| `docker compose up` says the network is missing | Start the Cronoverse stack first; it creates `cronoverse_edge`. |
| No emails arrive | `docker compose logs email-worker`, then the *Email deliveries* page in the admin. Confirm `EMAIL_PORT=2525`, the Mailjet keys, and sender verification. |
| A deployment variable seems ignored | A variable exported in your shell overrides `.env` for Compose. Run `env | grep -E 'POSTGRES|INQUIRY|CRONOVERSE'`. |
