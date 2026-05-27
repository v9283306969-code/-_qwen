---
name: docker-compose-validation-for-scaffolded-microservices
description: Полная проверка docker-compose в проектах-каркасах: scaffold-файлы, Dockerfile-фиксы, health checks, инфраструктурные тесты
source: auto-skill
extracted_at: '2026-05-27T18:02:54.728Z'
updated_at: '2026-05-27T19:15:00.000Z'
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

Команда `npx strapi new` удалена. `npx create-strapi-app@latest` требует интерактивного ввода (SSO login) и падает в non-TTY.

**Рабочий подход для scaffold阶段:** Express-заглушка, отвечающая на `/admin` и `/health`:

```yaml
strapi:
  image: node:20-alpine
  command: >
    sh -c "
      npm init -y &&
      npm install express &&
      node -e \"const e=require('express');const a=e();
        a.get('/admin',(_,r)=>r.send('<h1>Strapi Admin (scaffold)</h1>'));
        a.get('/health',(_,r)=>r.json({status:'ok',service:'strapi-scaffold'}));
        a.listen(1337,()=>console.log('[strapi] Scaffold'))\"
    "
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://localhost:1337/health || exit 1"]
```

На Этапе с полноценным Strapi — заменить на реальный Strapi-проект.

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
