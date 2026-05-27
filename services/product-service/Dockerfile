# ========================================
# Product Service — Multi-stage Dockerfile
# ========================================
# Сборка: docker build -t mlecp-product-service .
# Запуск: docker run -p 3001:3001 mlecp-product-service
# ========================================

# ---------- STAGE 1: Зависимости ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@latest && pnpm config set store-dir .pnpm-store
RUN pnpm install --frozen-lockfile

# ---------- STAGE 2: Сборка ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json tsconfig.build.json .eslintrc* ./
COPY src ./src
RUN npm install -g pnpm && pnpm build

# ---------- STAGE 3: Production ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S product -u 1001 && \
    chown -R product:nodejs /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER product

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/main.js"]
