FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat vips-dev

# Install all deps at root level (monorepo)
FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/persian-utils/package*.json ./packages/persian-utils/
RUN npm ci --workspace=apps/api --workspace=packages/shared-types --workspace=packages/persian-utils --include-workspace-root

# Build shared packages then API
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY package.json turbo.json tsconfig.base.json ./
WORKDIR /app/packages/shared-types
RUN npx tsc -p tsconfig.json
WORKDIR /app/apps/api
# nest build can omit newly added jobs/migrations. tsc emits the full tree.
# Keep dist/main so compose CMD ["node", "dist/main"] and the worker stay stable.
RUN printf '%s\n' '{"extends":"./tsconfig.json","exclude":["node_modules","dist","**/*spec.ts"]}' > tsconfig.docker.json \
 && npx tsc -p tsconfig.docker.json \
 && if [ -f dist/apps/api/src/main.js ]; then \
      printf '%s\n' "require('./apps/api/src/main');" > dist/main.js; \
    fi \
 && if [ -f dist/apps/api/src/worker.main.js ]; then \
      printf '%s\n' "require('./apps/api/src/worker.main');" > dist/worker.main.js; \
    fi \
 && if [ ! -f dist/main.js ]; then echo 'tsc did not emit dist/main.js' >&2; exit 1; fi \
 && mkdir -p dist/database/migrations dist/apps/api/src/database/migrations \
 && find dist/apps/api/src/database/migrations dist/database/migrations -maxdepth 1 -type f -name '*.js' ! -name '*.spec.js' -exec cp {} dist/database/migrations/ \; \
 && find dist/apps/api/src/database/migrations dist/database/migrations -maxdepth 1 -type f -name '*.js' ! -name '*.spec.js' -exec cp {} dist/apps/api/src/database/migrations/ \; \
 && test -f dist/apps/api/src/database/migrations/20260906-004-wholesale-hero-cache-bust.js \
 && test -f dist/database/migrations/20260906-004-wholesale-hero-cache-bust.js \
 && { test -f dist/apps/api/src/jobs/backfill-product-images.js || test -f dist/jobs/backfill-product-images.js; }

# Production runner
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S taranom && adduser -S taranom -G taranom

COPY --from=builder --chown=taranom:taranom /app/apps/api/dist ./dist
COPY --from=deps --chown=taranom:taranom /app/node_modules ./node_modules
# npm can keep native workspace dependencies (notably sharp and @img/*)
# under the workspace-local node_modules. Overlay them at /app/node_modules
# because the compiled API runs from /app/dist and resolves modules upward.
COPY --from=deps --chown=taranom:taranom /app/apps/api/node_modules/ ./node_modules/
COPY --from=deps --chown=taranom:taranom /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=taranom:taranom /app/packages/shared-types ./packages/shared-types
COPY --chown=taranom:taranom apps/api/package.json ./
# COPY merge can leave sharp as a dangling workspace symlink. Copy the
# workspace-local native tree and fail the image if require('sharp') cannot load.
ENV NODE_PATH=/app/apps/api/node_modules
RUN mkdir -p /app/node_modules /app/node_modules/@img \
 && if [ -e /app/apps/api/node_modules/sharp ]; then \
      rm -rf /app/node_modules/sharp; \
      cp -a /app/apps/api/node_modules/sharp /app/node_modules/sharp; \
    fi \
 && if [ -d /app/apps/api/node_modules/@img ]; then \
      cp -a /app/apps/api/node_modules/@img/. /app/node_modules/@img/; \
    fi \
 && node -e "const s=require('sharp'); if(!s.versions.sharp || !s.versions.vips) process.exit(1); console.log('sharp-ok', require.resolve('sharp'), s.versions);"

USER taranom
EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:4000/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]
