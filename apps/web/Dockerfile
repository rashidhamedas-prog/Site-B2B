FROM node:20-alpine AS web-base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Install all deps at root level (monorepo)
FROM web-base AS web-deps
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/persian-utils/package*.json ./packages/persian-utils/
RUN npm ci --workspace=apps/web --workspace=packages/shared-types --workspace=packages/persian-utils --include-workspace-root

# Build shared packages then Next.js
FROM web-base AS web-builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=web-deps /app/node_modules ./node_modules
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
COPY package.json turbo.json tsconfig.base.json ./
WORKDIR /app/apps/web
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_RETAIL_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_RETAIL_URL=$NEXT_PUBLIC_RETAIL_URL
RUN npm run build

# Production runner (Next.js standalone with monorepo tracing root)
FROM web-base AS web-runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

WORKDIR /app
# Copy standalone output — contains node_modules at root + apps/web/server.js
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Static assets must be under apps/web/.next/static/ (relative to server.js location)
COPY --from=web-builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# Public folder must be under apps/web/public/
COPY --from=web-builder /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app/apps/web
CMD ["node", "server.js"]
