# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS development
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    WATCHPACK_POLLING=true \
    HOSTNAME=0.0.0.0
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "dev:docker"]

FROM base AS builder
ARG WEBSITE_PORT
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    WEBSITE_PORT=${WEBSITE_PORT}
RUN if [ -z "$WEBSITE_PORT" ]; then echo "WEBSITE_PORT build-arg is required" >&2; exit 1; fi
COPY package.json package-lock.json ./
COPY --from=development /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ARG WEBSITE_PORT
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    WEBSITE_PORT=${WEBSITE_PORT} \
    PORT=${WEBSITE_PORT}
RUN if [ -z "$WEBSITE_PORT" ]; then echo "WEBSITE_PORT build-arg is required" >&2; exit 1; fi
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE ${WEBSITE_PORT}
CMD ["node", "server.js"]
