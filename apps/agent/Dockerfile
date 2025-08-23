# Multi-stage build for monorepo Next.js application
FROM node:20-alpine AS base

# Install dependencies and bun for linux/amd64
RUN apk add --no-cache curl bash && \
    curl -fsSL https://bun.sh/install | bash -s "bun-v1.2.19" && \
    mv /root/.bun/bin/bun /usr/local/bin/bun && \
    ln -s /usr/local/bin/bun /usr/local/bin/bunx && \
    chmod +x /usr/local/bin/bun

# Install dependencies stage
FROM base AS deps
WORKDIR /heyfun/app

# Copy entire project first
COPY . .

# Install dependencies without frozen lockfile for Docker build
RUN bun install

# Build stage
FROM base AS builder
WORKDIR /heyfun/app

# Copy everything from deps stage
COPY --from=deps /heyfun/app .

# Build the agent app and its dependencies
RUN bunx turbo build --filter=agent

# Production stage
FROM daytonaio/sandbox:0.4.3 AS runner
WORKDIR /heyfun/app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built application
COPY --from=builder /heyfun/app/apps/agent/.next/standalone ./
COPY --from=builder /heyfun/app/apps/agent/.next/static ./apps/agent/.next/static
COPY --from=builder /heyfun/app/apps/agent/public ./apps/agent/public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV HEYFUN_AGENT_WORKSPACE=/heyfun/workspace
