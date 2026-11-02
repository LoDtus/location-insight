# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV TZ=UTC

FROM base AS development
ENV NODE_ENV=development \
    CHOKIDAR_USEPOLLING=true \
    CHOKIDAR_INTERVAL=1000 \
    TSC_WATCHFILE=UsePolling \
    TSC_WATCHDIRECTORY=UsePolling
COPY package.json package-lock.json ./
RUN npm ci
COPY docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN chmod +x /usr/local/bin/dev-entrypoint.sh
COPY . .
EXPOSE 22370
ENTRYPOINT ["dev-entrypoint.sh"]

FROM base AS build
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY --from=development /app/node_modules ./node_modules
COPY . .
# Công cụ reset database chỉ dành cho máy dev: xóa mã nguồn trước khi build và kiểm tra không còn dấu vết trong dist.
RUN rm -rf src/dev-tools \
    && npm run build \
    && test ! -e dist/dev-tools \
    && ! grep -rIl "DevResetController" dist \
    && npm prune --omit=dev

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production \
    TZ=UTC
COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
CMD ["node", "dist/main.js"]
