# SPEC-05: Инфраструктура и DevOps

**Дата создания:** 2026-05-25  
**Дата обновления:** 2026-05-25  
**Статус:** draft  
**Версия:** 1.0

---

## 1. Метаданные

| Поле | Значение |
|---|---|
| **ID** | SPEC-05 |
| **Название** | Инфраструктура и DevOps (Docker, CI/CD, деплой, мониторинг) |
| **Тип** | infrastructure |
| **Стек** | Docker, Docker Compose, GitHub Actions, Vercel, Railway, Supabase, Sentry |
| **Зависит от** | — |
| **Блокирует** | SPEC-01, SPEC-02, SPEC-03, SPEC-04 (все сервисы) |
| **Роль QWEN** | DevOps-инженер |
| **Промт** | `templates/devops.md` |

---

## 2. Бизнес-контекст

### Назначение

Обеспечить воспроизводимое локальное окружение, автоматическую сборку и деплой, мониторинг ошибок и доступности, безопасное управление секретами. **Первый сервис, который настраивается — без него ни один микросервис не работает.**

### Пользователи

| Кто | Как использует |
|---|---|
| Разработчик | `docker-compose up` для локальной разработки |
| CI/CD | Автоматическая сборка, тесты, деплой при push |
| Администратор | Мониторинг, логи, алерты |

---

## 3. Архитектура инфраструктуры

### Локальное окружение (Docker Compose)

```
docker-compose.yml
├── postgres (PostgreSQL 16)          # БД для всех сервисов
├── redis (Redis 7)                   # Кэш, сессии, корзины
├── strapi (Strapi CMS)               # ⚠️ SCAFFOLD: Express-заглушка, заменить на полноценный Strapi v5 на Этапе 4
├── product-service                   # Node.js + NestJS
├── order-service                     # Node.js + NestJS
├── partner-service                   # Python + FastAPI
├── web (Next.js dev server)          # Фронтенд
├── gateway (Apollo Server)           # API Gateway / GraphQL
└── admin (Refine dev server)         # Админка
```

### Production окружение

| Компонент | Где хостится | Как деплоится |
|---|---|---|
| Frontend (Next.js) | Vercel | Git push → автодеплой |
| API Gateway | Railway | Docker → GHCR → Railway |
| Product Service | Railway | Docker → GHCR → Railway |
| Order Service | Railway | Docker → GHCR → Railway |
| Partner Service | Railway | Docker → GHCR → Railway |
| PostgreSQL | Supabase | Управляемая БД |
| Redis | Upstash | Serverless |
| Strapi CMS | Railway | Docker |
| Админка | Vercel | Git push → автодеплой |

### CI/CD Pipeline

```
Push/PR в main
    │
    ├──► Lint (ESLint, Prettier, Black)
    ├──► Type check (tsc, mypy)
    ├──► Unit tests (Jest, pytest)
    ├──► Integration tests (PostgreSQL + Redis в контейнере)
    ├──► Security scan (gitleaks, npm audit, pip audit)
    │
    ├──► Если только web/ изменён → Deploy Frontend на Vercel
    ├──► Если services/ изменён → Build Docker → Push GHCR → Deploy на Railway
    └──► Если infra/ изменён → Обновить docker-compose.yml
```

---

## 4. Конфигурационные файлы

### docker-compose.yml (локальная разработка)

```yaml
# version удалён — obsolete в Docker Compose v2
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: ${DB_USER:-dev}
      POSTGRES_PASSWORD: ${DB_PASS:-dev}
      POSTGRES_DB: ${DB_NAME:-mlecp_dev}
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # ... каждый сервис ...

volumes:
  pgdata:
```

### .github/workflows/ci.yml

```yaml
name: CI/CD
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, env: {...} }
      redis: { image: redis:7 }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test -- --coverage
      - uses: actions/setup-python@v5
      - run: pip install -r requirements.txt
      - run: pytest --cov
```

### Секреты (environment variables)

| Переменная | Где хранится | Значение |
|---|---|---|
| `DATABASE_URL` | GitHub Secrets, Railway Vars | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | GitHub Secrets, Railway Vars | `redis://host:6379` |
| `JWT_SECRET` | GitHub Secrets, Railway Vars | Генерируется один раз |
| `STRAPI_API_KEY` | GitHub Secrets, Railway Vars | Ключ для Strapi |
| `YOOKASSA_SHOP_ID` | GitHub Secrets, Railway Vars | ID магазина |
| `YOOKASSA_SECRET` | GitHub Secrets, Railway Vars | Секретный ключ |

---

## 5. Функциональные требования

| ID | Требование | Приоритет | Зависит от | Статус |
|---|---|---|---|---|
| FR-1 | docker-compose.yml поднимает PostgreSQL, Redis, Strapi | must | — | ✅ done |
| FR-2 | Все сервисы запускаются через `docker compose up` | must | FR-1 | ✅ done |
| FR-3 | Health check для каждого контейнера | must | FR-2 | ✅ done |
| FR-4 | .env.example с шаблоном переменных | must | — | ✅ done |
| FR-5 | .env.local в .gitignore | must | FR-4 | ✅ done |
| FR-6 | GitHub Actions: lint + type-check | must | — | pending |
| FR-7 | GitHub Actions: unit-тесты | must | FR-6 | pending |
| FR-8 | GitHub Actions: security scan (gitleaks) | must | — | pending |
| FR-9 | Автодеплой фронтенда на Vercel | should | FR-7 | pending |
| FR-10 | Автодеплой бэкенда на Railway | should | FR-7 | pending |
| FR-11 | Sentry для фронтенда | should | — | pending |
| FR-12 | Sentry для бэкенда | should | — | pending |
| FR-13 | UptimeRobot мониторинг | should | Деплой | pending |
| FR-14 | Структурированное логирование (JSON) | must | — | pending |
| FR-15 | correlationId для каждого запроса (генерация в Gateway) | must | — | pending |
| FR-16 | Docker multi-stage build для каждого сервиса | should | — | ✅ done |

---

## 6. Нефункциональные требования

| Требование | Значение | Как проверяется |
|---|---|---|
| Время поднятия dev-окружения | < 5 минут с `docker-compose up` | Таймер |
| Размер Docker-образа | < 500MB для Node.js, < 200MB для Python | `docker images` |
| CI/CD время | < 10 минут от push до деплоя | GitHub Actions log |
| Secrets leakage | 0 секретов в репозитории | gitleaks scan |

---

## 7. Тесты

### Инфраструктурные тесты

| Сценарий | Что проверять |
|---|---|
| `docker-compose up -d` | Все контейнеры running, health checks passed |
| База данных | Подключение, создание таблиц через миграции |
| Redis | SET/GET работает |
| Сервисы | Health check endpoint возвращает 200 |

### CI/CD тесты

| Сценарий | Что проверять |
|---|---|
| Push с failing lint | Pipeline fails |
| Push с failing tests | Pipeline fails |
| Push с passing tests | Pipeline passes, deploy triggered |
| Push с secret в коде | gitleaks блокирует |

---

## 8. Файлы проекта

| Файл | Назначение | Создан? |
|---|---|---|
| `docker-compose.yml` | Локальная разработка (production-like) | ✅ |
| `docker-compose.prod.yml` | Production overrides | ✅ |
| `docker-compose.dev.yml` | Dev overrides (live-reload, debug ports) | ✅ |
| `.env.example` | Шаблон переменных | ✅ |
| `.dockerignore` | Исключения для Docker (общий + per-service) | ✅ |
| `.github/workflows/ci.yml` | CI/CD pipeline | ✅ |
| `services/*/Dockerfile` | Образ каждого сервиса (multi-stage) | ✅ |
| `services/strapi/` | Папка для Strapi CMS | ✅ (placeholder) |
| `monitoring/sentry.config.ts` | Sentry конфигурация | ⏳ |

---

## 9. Прогресс реализации

| Шаг | Описание | Статус | Дата | Заметки |
|---|---|---|---|---|
| 1 | docker-compose.yml (PostgreSQL, Redis, Strapi) | ✅ | 2026-05-27 | Все сервисы + health checks |
| 2 | .env.example, .env.local, .gitignore | ✅ | 2026-05-27 | Полный шаблон с DB, JWT, YooKassa, CDEK, Sentry |
| 3 | Dockerfile для каждого сервиса | ✅ | 2026-05-27 | Multi-stage, non-root user, HEALTHCHECK |
| 4 | Health check для каждого контейнера | ✅ | 2026-05-27 | `wget /health` для всех сервисов |
| 5 | Настройка GitHub Actions (lint, test) | ✅ | 2026-05-27 | Node.js + Python, Docker build stage |
| 6 | gitleaks security scan | ✅ | 2026-05-27 | + pip-audit, npm audit |
| 7 | Деплой на Vercel (фронтенд) | ⏳ future | | Раскомментировать deploy-frontend в ci.yml |
| 8 | Деплой на Railway (бэкенд) | ⏳ future | | Раскомментировать deploy-backend в ci.yml |
| 9 | Sentry для мониторинга | ⏳ future | | `SENTRY_DSN` в env, добавить sentry.config.ts |
| 10 | UptimeRobot для доступности | ⏳ future | | После деплоя |
| 11 | correlationId middleware | ⏳ future | | В gateway middleware |
| 12 | Документация: README для разработчиков | ⏳ future | | Инструкция по `docker-compose up` |

### Текущий контекст

- **Последнее действие:** Step 2.5 verified — `docker compose up` проверен 2026-05-27
- **Следующий шаг:** Step 2.6 — CI/CD refinement (pre-commit hooks, Conventional Commits)
- **Открытые вопросы:**
  - Strapi: команда инициализации устарела. Express-scaffold в docker-compose.yml. Полноценный Strapi — Этап 4. См. STEP 3.1.3 в PROJECT-LIFECYCLE.md.
  - Микросервисы: Express/FastAPI scaffold вместо NestJS/Apollo по SPEC. Замена — Начало Этапа 3.
  - `--no-frozen-lockfile` в Dockerfile: временное решение. Вернуть `--frozen-lockfile` когда будут lock-файлы.
  - pnpm@9 зафиксирован для Node.js 20 совместимости. При Node.js 22+ проверить latest.
  - Partner-service requirements.txt: минимальный. Расширить до SPEC-03 при старте Этапа 3.
- **Результаты проверки 2026-05-27:**
  - ✅ PostgreSQL 16 — healthy, подключение работает
  - ✅ Redis 7 — healthy, PING/PONG работает
  - ✅ Strapi — Express-scaffold healthy (полноценный Strapi — Этап 4)
  - ✅ Микросервисы — Express/FastAPI scaffold, все healthy
  - ⚠️ Архитектурные отклонения: Express вместо NestJS, нет Apollo GraphQL, нет lock-файлов (см. «Известные ограничения scaffold» ниже)

---

## 10. Заметки и принятые решения

| Дата | Решение / Заметка | Кто |
|---|---|---|
| 2026-05-25 | Vercel для Next.js — лучшая интеграция (ISR, Image Optimization) | Qwen (Архитектор) |
| 2026-05-25 | Railway для бэкенда — проще чем свой VPS, бесплатный тариф | Qwen (Архитектор) |
| 2026-05-25 | gitleaks блокирует коммиты с accidental secrets | Qwen (DevOps) |
| 2026-05-27 | **⚠️ Strapi — Express-заглушка вместо полноценного Strapi.** Причина: `npx create-strapi-app` требует интерактивного ввода, не работает в Docker. Scaffold добавлен только для верификации infrastructure (шаг 2.5). Действия: на Этапе 4 запустить `npx create-strapi-app@latest` в `services/strapi/`, закоммитить проект, заменить команду в docker-compose.yml на `npm run develop`. | Qwen (DevOps) |

---

## 11. Проверка готовности

- [x] docker-compose.yml поднимает все сервисы одной командой — **7/7 healthy**
- [x] Health check для всех контейнеров — все 7 с health checks
- [ ] CI/CD: lint → type-check → tests → deploy
- [ ] gitleaks scan в CI
- [ ] Деплой фронтенда на Vercel работает
- [ ] Деплой бэкенда на Railway работает
- [ ] Sentry ловит ошибки
- [ ] correlationId работает через все сервисы
- [x] .env.example заполнен, секреты не в репозитории
- [ ] README содержит инструкцию для нового разработчика

### Результаты проверки 2026-05-27

| Тест | Результат |
|---|---|
| `docker compose up -d --build` | ✅ 7 контейнеров, все healthy |
| Health endpoints (curl) | ✅ Все 5 сервисов: 4000, 3001, 3002, 3003, 1337 |
| PostgreSQL подключение | ✅ SELECT version() — 16.14 |
| Redis PING/PONG | ✅ PONG |
| Redis SET/GET | ✅ persistence OK |
| Межсервисная сеть | ✅ Все 7 контейнеров в mlecp-network |
| Volume persistence | ✅ pgdata volume работает |
| Контейнеры доступны с хоста | ✅ Все порты маппятся корректно |

**Известные ограничения scaffold**:
- Strapi: Express-заглушка (port 1337), полноценный Strapi — Этап 4
- Микросервисы: Express/FastAPI заглушки с `/health`. По SPEC-01, SPEC-02 должен быть **NestJS**. Замена на NestJS — Начало Этапа 3.
- **Gateway**: сейчас Express (только `/health`). По архитектуре — **Apollo GraphQL Federation** / GraphQL Gateway. Замена — Начало Этапа 3.
- `--no-frozen-lockfile` в Dockerfile: lock-файлов пока нет. При создании реальных сервисов вернуть `--frozen-lockfile` для CI/CD reproducibility.
- Partner-service requirements.txt: минимальный (fastapi + uvicorn), Dockerfile ставит gcc/libpq-dev (для psycopg2, которого пока нет). При старте Этапа 3 расширить requirements.txt до полного набора (SPEC-03).
- pnpm@9 зафиксирован (совместим с Node.js 20). При обновлении Node.js до 22+ — проверить совместимость pnpm latest.

---

*Документ создан: 2026-05-25*
*Последнее обновление: 2026-05-25*
*Автор: Qwen Code (DevOps-инженер)*
