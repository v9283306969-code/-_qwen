# Multi-Level E-Commerce Platform (MLECP)

Headless CMS + Микросервисы + MLM партнёрская сеть

## 🚀 Быстрый старт

```bash
# 1. Копируем .env.example в .env.local
cp .env.example .env.local
# (заполни .env.local своими значениями)

# 2. Устанавливаем зависимости (только root для docker)
pnpm install

# 3. Запускаем всё одной командой
pnpm dev
# => Запускается: PostgreSQL, Redis, Strapi, Gateway, Product, Order, Partner
```

## 📁 Структура

```
├── apps/
│   ├── web/          # Next.js сайт (витрина + PWA)
│   └── admin/        # Refine админка (управление)
├── services/
│   ├── gateway/        # API Gateway (GraphQL)
│   ├── product-service/# Каталог товаров (Node.js + NestJS)
│   ├── order-service/  # Заказы и корзина (Node.js + NestJS)
│   └── partner-service/# Партнёрка, бонусы, ранги (Python + FastAPI)
├── packages/
│   ├── shared/       # Общие типы, утилиты
│   └── database/     # Drizzle схемы, миграции
└── docs/             # Документация (Specs, Архитектура, Бизнес-модель)
```

## 🛠 Технологии

- **Фронтенд:** Next.js 14, React, TailwindCSS, Apollo Client
- **Бэкенд (Node.js):** NestJS, Drizzle ORM, Zod
- **Бэкенд (Python):** FastAPI, SQLAlchemy, pydantic
- **Инфраструктура:** Docker, PostgreSQL, Redis, Strapi, GitHub Actions
