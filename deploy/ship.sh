#!/usr/bin/env bash
# Build both images on this machine and stream them to the server. The server never
# builds: a 1 GB host runs out of memory during image builds and would take any
# neighbouring service down with it.
#
#   DEPLOY_HOST=root@203.0.113.10 DEPLOY_KEY=~/.ssh/id_ed25519 deploy/ship.sh          # load images only
#   DEPLOY_HOST=... deploy/ship.sh --up                                                 # also (re)start the stack
#
# Prerequisite on the server (once): the directory in DEPLOY_DIR with a filled-in .env
# (see deploy/README.md). This script never copies secrets.
set -euo pipefail

cd "$(dirname "$0")/.."
: "${DEPLOY_HOST:?Set DEPLOY_HOST, for example root@203.0.113.10}"
DEPLOY_DIR=${DEPLOY_DIR:-/opt/cronoverse}
ssh_opts=(-o BatchMode=yes -o ConnectTimeout=10)
[ -n "${DEPLOY_KEY:-}" ] && ssh_opts+=(-o IdentitiesOnly=yes -i "$DEPLOY_KEY")

tag=${CRONOVERSE_TAG:-$(git rev-parse --short HEAD)}
git diff --quiet HEAD -- . || tag="$tag-dirty"
export CRONOVERSE_TAG=$tag
echo "Building cronoverse images tagged $tag"

# Compose interpolates required variables even for `build`, so give placeholders; they are
# never baked into an image (secrets are runtime-only).
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-build-only} INQUIRY_API_KEY=${INQUIRY_API_KEY:-build-only}
docker compose -f deploy/compose.yaml build frontend backend

echo "Streaming images to $DEPLOY_HOST (this can take a minute)"
docker save "cronoverse-frontend:$tag" "cronoverse-backend:$tag" | gzip | ssh "${ssh_opts[@]}" "$DEPLOY_HOST" 'gunzip | docker load'

ssh "${ssh_opts[@]}" "$DEPLOY_HOST" "mkdir -p '$DEPLOY_DIR' && chmod 700 '$DEPLOY_DIR'"
scp "${ssh_opts[@]}" deploy/compose.yaml deploy/compose.analytics.yaml "$DEPLOY_HOST:$DEPLOY_DIR/"
scp -r "${ssh_opts[@]}" deploy/caddy "$DEPLOY_HOST:$DEPLOY_DIR/"

if [ "${1:-}" = "--up" ]; then
  echo "Starting the stack at tag $tag"
  # shellcheck disable=SC2029
  ssh "${ssh_opts[@]}" "$DEPLOY_HOST" "cd '$DEPLOY_DIR' && test -f .env && CRONOVERSE_TAG='$tag' docker compose up -d --remove-orphans && docker compose ps"
else
  echo "Images loaded. Start with: ssh $DEPLOY_HOST \"cd $DEPLOY_DIR && CRONOVERSE_TAG=$tag docker compose up -d\""
fi
