# syntax=docker/dockerfile:1
#
# Frontend image. The site builds to a Cloudflare Worker bundle that imports
# `cloudflare:workers`, which plain Node cannot load, so the same bundle that is
# built for Workers runs here on Wrangler's local workerd runtime. The runtime stage
# contains only Wrangler and the build output, not the 1 GB of build dependencies.

FROM node:22-slim AS build
WORKDIR /src
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
# Runtime needs exactly the Wrangler version the project is pinned to.
RUN mkdir /runtime && node -e "const p=require('./package.json');const v=(p.dependencies||{}).wrangler||(p.devDependencies||{}).wrangler;if(!v){console.error('wrangler is not declared in package.json');process.exit(1)}require('fs').writeFileSync('/runtime/package.json',JSON.stringify({private:true,dependencies:{wrangler:v}}))"

FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    HOME=/tmp/home \
    CLOUDFLARE_CF_FETCH_ENABLED=false \
    WRANGLER_SEND_METRICS=false \
    WRANGLER_WRITE_LOGS=false \
    WRANGLER_LOG_PATH=/tmp/wrangler/logs \
    WRANGLER_REGISTRY_PATH=/tmp/wrangler/dev-registry \
    MINIFLARE_REGISTRY_PATH=/tmp/wrangler/registry
# workerd verifies TLS against the operating system's certificate store, which the slim base
# image does not include (Node ships its own, so plain Node works and hides the problem).
# Without it every outbound HTTPS call from the site fails, including captcha verification.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Install and run as the unprivileged user from the start: a later `chown -R` would
# copy the whole 300 MB install into another image layer.
RUN mkdir /app && chown node:node /app
WORKDIR /app
USER node
COPY --from=build --chown=node:node /runtime/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force \
    && test -f node_modules/wrangler/bin/wrangler.js && node node_modules/wrangler/bin/wrangler.js --version \
    && rm -rf /tmp/home
COPY --from=build --chown=node:node /src/dist ./dist
COPY --chown=node:node --chmod=755 deploy/frontend-entrypoint.sh /usr/local/bin/frontend-entrypoint
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["frontend-entrypoint"]
