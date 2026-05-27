---
name: docker-compose-validation-for-scaffolded-microservices
description: Полная проверка docker-compose в проектах-каркасах: scaffold-файлы, Dockerfile-фиксы, health checks, инфраструктурные тесты
source: auto-skill
extracted_at: '2026-05-27T18:02:54.728Z'
updated_at: '2026-05-27T20:18:00.000Z'
---

## Когда применять

Проект настроил Docker Compose, Dockerfile, health checks, но код микросервисов ещё не написан — сервисные папки содержат только Dockerfile-каркасы без package.json/tsconfig.json/src или минимальные заглушки.

## Проблема

`docker compose up -d --build` упадёт при сборке микросервисов по нескольким причинам: Dockerfile COPY ищет файлы, которых нет; утилиты вроде wget недоступны в slim/alpine образах; версии пакетов несовместимы с базовым образом.

## Процедура валидации

### 1. Проверить, запущен ли Docker daemon

```bash
docker info --format "{{.ServerVersion}}"
```

Если ошибка «unable to start» → установить/запустить Docker Desktop.

### 2. WSL 2 на Windows

Если Docker Desktop не запускается с «WSL needs updating»:

```bash
wsl --install        # скачает WSL + Ubuntu (~5 мин)
# После создания учётки Ubuntu:
docker info          # должен вернуть ServerVersion
```

### 3. Создать scaffold-файлы для микросервисов

Каждому Node.js сервису нужны:
- `package.json` — минимальный, с необходимыми зависимостями (express для заглушки)
- `tsconfig.json` — стандартная конфигурация TypeScript
- `tsconfig.build.json` — extends tsconfig.json, задаёт outDir/rootDir
- `src/main.ts` — минимальный Express-сервер с `/health` endpoint

Python-сервису:
- `requirements.txt` — только необходимые пакеты (fastapi, uvicorn)
- `src/main.py` — минимальный FastAPI app с `/health`

Пример Node.js заглушки (`src/main.ts`):
```typescript
import express from 'express';
const app = express();
const PORT = parseInt(process.env.SERVICE_PORT || '3001', 10);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => console.log(`Running on ${PORT}`));
```

### 4. Типичные Dockerfile-ошибки в scaffold-проектах

| Ошибка | Причина | Фикс |
|---|---|---|
| `pnpm@latest` → `ERR_UNKNOWN_BUILTIN_MODULE` | pnpm 11+ требует Node.js >=22, образ node:20 | `pnpm@9` |
| `pnpm: not found` в builder stage | Multi-stage изоляция — pnpm установлен только в deps | `RUN npm install -g pnpm@9` в builder |
| `No importer manifest found` | package.json не скопирован в builder | `COPY package.json ./` |
| `.eslintrc* not found` | COPY glob ищет несуществующие файлы | Убрать `.eslintrc*` из COPY |
| `--frozen-lockfile` → `ERR_PNPM_NO_LOCKFILE` | Нет pnpm-lock.yaml в scaffold | `--no-frozen-lockfile` |
| `wget: not found` в health check (slim/alpine) | wget/curl нет в slim-образах | Python: `urllib.request.urlopen()` |

### 5. Запуск и проверка

```bash
docker compose down
docker compose up -d --build
docker compose ps   # все должны быть (healthy)
```

### 6. Health endpoints (curl с хоста)

```bash
curl http://localhost:4000/health  # gateway
curl http://localhost:3001/health  # product-service
curl http://localhost:3002/health  # order-service
curl http://localhost:3003/health  # partner-service
curl http://localhost:1337/health  # strapi
```

### 7. Инфраструктурные тесты

```bash
# PostgreSQL
docker exec <pg-container> psql -U <user> -d <db> -c "SELECT version();"

# Redis
docker exec <redis-container> redis-cli ping       # → PONG
docker exec <redis-container> redis-cli SET k v    # → OK
docker exec <redis-container> redis-cli GET k      # → v

# Сеть — все контейнеры в одной сети
docker network inspect <network_name> --format "{{range .Containers}}{{.Name}} {{end}}"

# Health check внутри контейнера (если wget/curl нет)
docker exec <py-container> python -c "import urllib.request; urllib.request.urlopen('http://localhost:3003/health')"
```

### 8. Strapi v4/v5

Команда `npx strapi new` удалена в v4/v5. `npx create-strapi-app@latest` требует **интерактивного ввода** (SSO login/sign up prompt) и падает в non-TTY Docker-контейнере с ошибкой `npm error code ENOENT`.

**Рабочий подход для scaffold阶段:** Express-заглушка, отвечающая на `/admin` и `/health`:

```yaml
strapi:
  image: node:20-alpine
  working_dir: /app
  command: >
    sh -c "
      npm init -y &&
      npm install express &&
      node -e \"const e=require('express');const a=e();
        a.get('/admin',(_,r)=>r.send('<h1>Strapi Admin (scaffold)</h1>'));
        a.get('/health',(_,r)=>r.json({status:'ok',service:'strapi-scaffold'}));
        a.listen(1337,()=>console.log('[strapi] Scaffold'))\"
    "
  ports:
    - "1337:1337"
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://localhost:1337/health || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 10
    start_period: 30s
```

**Критично:** на Этапе интеграции Strapi (не scaffold!) нужно:
1. Удалить Express-заглушку из docker-compose.yml
2. Инициализировать Strapi: `cd services/strapi && npx create-strapi-app@latest . --quickstart --ts --no-run`
3. Закоммитить стрapi-проект в `services/strapi/` (может быть большой — .gitignore node_modules)
4. Вернуть `command: npm run develop` в docker-compose.yml

**Пометка:** добавить `⚠️` предупреждения в docker-compose.yml (TODO comment в сервисе), PROJECT-LIFECYCLE.md (шаг интеграции), SPEC-05 (решения), SPEC-06 (админка), README.md (таблица сервисов). Минимум 4 места.

### 9. Документировать результаты

Обновить SPEC и ROADMAP, закоммитить. Формат чек-листа:

```
✅ 7/7 containers healthy
✅ Health endpoints: 4000, 3001, 3002, 3003, 1337
✅ PostgreSQL: connection + volume persistence
✅ Redis: PING/PONG + SET/GET persistence
✅ Network: all containers on mlecp-network
⚠️ Scaffold limitations: Strapi=Express stub, microservices=health-only
```

### 10. Пост-аудит: зафиксировать отклонения scaffold от SPEC

После успешного запуска — **обязательный шаг**: систематически найти все отклонения scaffold от проектной документации и пометить их. Иначе при переходе к реальному коду разработчик (или ты в будущей сессии) потеряет контекст.

#### 10a. Типичные отклонения для поиска

| Отклонение | Что проверить | Где искать |
|---|---|---|
| Фреймворк ≠ SPEC | Express вместо NestJS, Express вместо Apollo GraphQL | package.json `dependencies`, Dockerfile comment |
| Библиотеки ≠ SPEC | Минимальный requirements.txt без SQLAlchemy, psycopg2, Alembic | requirements.txt, SPEC-файл сервиса |
| Lock-файлы отсутствуют | `--no-frozen-lockfile` — временное решение | Dockerfile RUN pnpm install |
| Версия пакета зафиксирована | pnpm@9 вместо latest, node:20 вместо latest | Dockerfile FROM, RUN install |
| Сервис-заглушка | Express-scaffold вместо Strapi, нет полноценной CMS | docker-compose.yml command |

#### 10b. 4 уровня пометок (не менее 2)

На каждое найденное отклонение добавить предупреждения минимум на двух уровнях:

| Уровень | Где | Пример |
|---|---|---|
| **Файл** | `# ⚠️` comment в Dockerfile, `_comment` в package.json | В header Dockerfile: "⚠️ SCAFFOLD: Express вместо NestJS, Этап 3" |
| **Документация** | SPEC-файл с обновлённым `current_context` разделом | `## Текущий контекст: Express scaffold работает, NestJS — Этап 3` |
| **ROADMAP / дорожная карта** | Блок «Заметки» после завершённого шага | `⏳ Gateway: Express scaffold, GraphQL — Этап 3` |
| **Память проекта** | Папка `.qwen/memory/current_work.md` | `⚠️ Отклонения scaffold: Gateway=Express, нужен Apollo` |

#### 10c. Шаблон комментария в Dockerfile

```
# ========================================
# <Service Name> — Multi-stage Dockerfile
# ========================================
# ⚠️ SCAFFOLD (шаг <N>): <what's here instead of SPEC>. Этап <N>: <what should be>.
# ⚠️ <config deviation 1>
# ⚠️ <config deviation 2>
# ========================================
```

#### 10d. Шаблон записи в `current_work.md` памяти

```
**⚠️ Отклонения scaffold от SPEC (ВАЖНО для Этапа N)**:
- <What's in SPEC> вместо <what's here> → заменить на Этапе N (подробности в <file>)
- ...
```

### 11. Обновлять SPEC при каждом шаге

После каждого успешного шага обновить:
- `docs/specs/SPEC-XX.md` → разделы «Файлы проекта» ([ ]→✅), «Прогресс реализации», «Текущий контекст»
- `ROADMAP.md` → строка шага и раздел «Что дальше»
- `PROJECT-LIFECYCLE.md` → описание шага с результатами верификации

Это не «бумажная работа» — без этого следующая сессия начнёт с нулевого контекста.
