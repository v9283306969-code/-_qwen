---
name: docker-compose-validation-for-scaffolded-microservices
description: Проверка docker-compose в проектах-каркасах, где микросервисы ещё не реализованы (только Dockerfile-заглушки)
source: auto-skill
extracted_at: '2026-05-27T18:02:54.728Z'
---

## Когда применять

Проект настроил Docker Compose, Dockerfile, health checks (шаг «инфраструктура готов»), но код микросервисов ещё не написан — сервисные папки содержат только Dockerfile + .dockerignore без package.json/tsconfig.json/src.

## Проблема

`docker compose up -d --build` упадёт на стадии build микросервисов, потому что Dockerfile COPY ищет файлы, которых ещё нет (package.json, tsconfig.json, src/).

## Процедура валидации

### 1. Проверить, запущен ли Docker daemon

```bash
docker info --format "{{.ServerVersion}}"
```

Если ошибка «unable to start» → установить/запустить Docker Desktop.

### 2. Запустить только инфраструктуру (без микросервисов)

```bash
docker compose up -d postgres redis
```

Проверить health:

```bash
docker compose ps
# оба контейнера должны показывать (healthy)
```

### 3. Проверить функциональность

```bash
# PostgreSQL
docker exec <container> psql -U <user> -d <db> -c "SELECT version();"

# Redis
docker exec <container> redis-cli ping
# → PONG
```

### 4. Инфраструктурные сервисы с особой инициализацией (Strapi и т.п.)

После запуска проверить логи:

```bash
docker logs <container> --tail 20
```

**Известная проблема Strapi v4/v5:** команда `npx strapi new . --quickstart` удалена. Заменить на `npx create-strapi-app@latest . --quickstart` или预先 создать Strapi-проект локально.

### 5. Документировать найденные проблемы

- ❌ Стреляющие сервисы — причина и план починки
- ⚠️ Неблокирующие warning (например, устаревший `version: '3.9'`)
- ✅ Рабочие компоненты с проверками

### 6. Закоммитить результаты

Обновить SPEC по инфраструктуре и ROADMAP с чек-листом проверки, затем `git commit`.

## Чек-лист результатов (для SPEC/ROADMAP)

```
- ✅ PostgreSQL — healthy, подключение OK
- ✅ Redis — healthy, PING/PONG OK
- ❌ Strapi — устаревшая команда инициализации (починим на Этапе N)
- ❌ Микросервисы — нет кода (Этап N), Dockerfile-каркасы готовы
- ⚠️ version: '3.9' — устаревший атрибут docker-compose (LOW)
```

## WSL 2 на Windows

Если Docker Desktop не запускается с ошибкой «WSL needs updating»:

```bash
wsl --install        # скачает WSL + Ubuntu (~5 мин)
# После создания учётки Ubuntu:
docker info          # должен вернуть ServerVersion
```
