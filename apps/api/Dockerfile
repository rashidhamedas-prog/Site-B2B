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
WORKDIR /app/apps/api
RUN npm run build

# Production runner
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api/package.json ./

EXPOSE 4000
CMD ["node", "dist/main"]
