# Multi-stage production Dockerfile for Google Cloud Run (PostgreSQL)
FROM node:22-slim AS builder
WORKDIR /app

# Install OpenSSL needed by Prisma engines
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/domain/package.json packages/domain/
COPY packages/adapters/package.json packages/adapters/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN npm ci

COPY packages ./packages
COPY apps ./apps

# Generate PostgreSQL Prisma client for Cloud Run
RUN npx prisma generate --schema=apps/api/prisma/schema.postgres.prisma
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/domain/package.json ./packages/domain/
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/packages/adapters/package.json ./packages/adapters/
COPY --from=builder /app/packages/adapters/dist ./packages/adapters/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist

EXPOSE 8080

# Sync PostgreSQL schema on startup and launch CoverFlow API + Web on $PORT
CMD ["sh", "-c", "npx prisma db push --schema=apps/api/prisma/schema.postgres.prisma --skip-generate && node apps/api/dist/index.js"]
