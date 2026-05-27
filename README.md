# Multi-Level E-Commerce Platform (MLECP)

Headless CMS + Микросервисы + MLM партнёрская сеть

## 🚀 Быстрый старт

```bash
# 1. Копируем .env.example в .env.local
cp .env.example .env.local
# (заполни .env.local своими значениями)

# 2. Запускаем Docker (всё одной командой)
docker compose up -d --build
# => Запускается: PostgreSQL, Redis, Strapi-scaffold, Gateway, Product, Order, Partner

# 3. Проверяем
docker compose ps
# => Все 7 контейнеров должны быть healthy
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

## 🐳 Сервисы (Docker Compose)

| Сервис | Порт | Статус | Описание |
|---|---|---|---|
| PostgreSQL | 5432 | ✅ | Основная БД (все сервисы) |
| Redis | 6379 | ✅ | Кэш, сессии, корзины |
| Strapi | 1337 | ⏳ scaffold | **Express-заглушка!** Полноценный Strapi v5 — Этап 4 (см. SPEC-05) |
| Gateway | 4000 | ⏳ scaffold | Express `/health`, GraphQL — Этап 3 |
| Product Service | 3001 | ⏳ scaffold | Express `/health`, NestJS — Этап 3 |
| Order Service | 3002 | ⏳ scaffold | Express `/health`, NestJS — Этап 3 |
| Partner Service | 3003 | ⏳ scaffold | FastAPI `/health`, код — Этап 3 |

## 🛠 Полезные команды

```bash
# Запуск всех сервисов
docker compose up -d --build

# Логи конкретного сервиса
docker compose logs -f gateway

# Остановка
docker compose down

# Полная очистка (включая volumes)
docker compose down -v
```
