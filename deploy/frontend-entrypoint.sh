#!/bin/sh
# Turns the container's environment into the Worker's runtime bindings, then starts it.
# Wrangler reads bindings from a `.dev.vars` file beside the built config, so one is
# generated at start from just the three values the frontend is allowed to see.
set -eu
umask 077

: "${INQUIRY_BACKEND_URL:?Set INQUIRY_BACKEND_URL (for example http://backend:8000)}"
: "${INQUIRY_API_KEY:?Set INQUIRY_API_KEY}"

for value in "$INQUIRY_BACKEND_URL" "$INQUIRY_API_KEY" "${GA4_MEASUREMENT_ID:-}"; do
  case "$value" in
    *'
'*|*'"'*|*"'"*|*'#'*|*' '*) echo "A runtime value contains a newline, quote, space, or '#', which a .dev.vars file cannot hold safely." >&2; exit 1;;
  esac
done

{
  printf 'INQUIRY_BACKEND_URL=%s\n' "$INQUIRY_BACKEND_URL"
  printf 'INQUIRY_API_KEY=%s\n' "$INQUIRY_API_KEY"
  printf 'GA4_MEASUREMENT_ID=%s\n' "${GA4_MEASUREMENT_ID:-}"
} > /app/dist/server/.dev.vars

mkdir -p /tmp/home /tmp/wrangler/logs /tmp/wrangler/dev-registry /tmp/wrangler/registry
exec node ./node_modules/wrangler/bin/wrangler.js dev \
  --config dist/server/wrangler.json --local --persist-to /tmp/wrangler/state \
  --ip 0.0.0.0 --port 8787 --inspector-port 0 --log-level warn
