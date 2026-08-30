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
# Clean tsc (no nest-cli) emits dist/apps/api/src/main.js. Keep dist/main
# so compose/CMD and the worker entry stay stable.
RUN npm run build \
  && if [ -f dist/apps/api/src/main.js ]; then \
       printf '%s\n' "require('./apps/api/src/main');" > dist/main.js; \
     fi \
  && if [ -f dist/apps/api/src/worker.main.js ]; then \
       printf '%s\n' "require('./apps/api/src/worker.main');" > dist/worker.main.js; \
     fi

# Production runner
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S taranom && adduser -S taranom -G taranom

COPY --from=builder --chown=taranom:taranom /app/apps/api/dist ./dist
COPY --from=deps --chown=taranom:taranom /app/node_modules ./node_modules
COPY --from=deps --chown=taranom:taranom /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=taranom:taranom /app/packages/shared-types ./packages/shared-types
COPY --chown=taranom:taranom apps/api/package.json ./

USER taranom
EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:4000/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]
