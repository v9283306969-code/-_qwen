# ========================================
# Gateway Service — Multi-stage Dockerfile
# ========================================
# ⚠️ SCAFFOLD (шаг 2.5): Express с /health. Этап 3: заменить на NestJS (SPEC-05)
# ⚠️ pnpm@9: зафиксирован для совместимости с Node.js 20. При Node.js 22+ — проверить latest.
# ⚠️ --no-frozen-lockfile: lock-файлов нет в scaffold. Этап 3: вернуть --frozen-lockfile.
# ========================================

# ---------- STAGE 1: Зависимости ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Копируем package.json отдельно для кэширования слоёв
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

# Непривилегированный пользователь
RUN addgroup -g 1001 -S nodejs && \
    adduser -S gateway -u 1001 && \
    chown -R gateway:nodejs /app

# Копируем только скомпилированный код и production-зависимости
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

USER gateway

EXPOSE 4000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/main.js"]
