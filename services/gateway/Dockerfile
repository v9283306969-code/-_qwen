# ==========================
# STAGE 1: Зависимости
# ==========================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Копируем только package.json и pnpm-lock.yaml для кэширования Docker-слоёв
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm config set store-dir .pnpm-store
RUN pnpm install --frozen-lockfile

# ==========================
# STAGE 2: Сборка
# ==========================
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Собираем Typescript
RUN npm install -g pnpm && pnpm build

# ==========================
# STAGE 3: Production
# ==========================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Создаем непривилегированного пользователя для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3001

CMD ["node", "dist/main.js"]
