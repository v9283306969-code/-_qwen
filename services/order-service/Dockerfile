# ========================================
# Order Service — Multi-stage Dockerfile
# ========================================
# Сборка: docker build -t mlecp-order-service .
# Запуск: docker run -p 3002:3002 mlecp-order-service
# ========================================

# ---------- STAGE 1: Зависимости ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@9 && pnpm config set store-dir .pnpm-store
RUN pnpm install --no-frozen-lockfile

# ---------- STAGE 2: Сборка ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm build

# ---------- STAGE 3: Production ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S order -u 1001 && \
    chown -R order:nodejs /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER order

EXPOSE 3002

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "dist/main.js"]
