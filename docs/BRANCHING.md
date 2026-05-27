# Branching Strategy — MLECP

**Модель:** GitHub Flow + Release Tags

## Ветки

| Ветка | Назначение | Защита |
|---|---|---|
| `main` | Production-ready код. Стабильная версия. | ✅ PR required, status checks, no direct push |
| `develop` | Интеграционная ветка. Все фичи сначала сюда. | ✅ PR required, status checks |
| `feat/*` | Новые фичи (ветвятся от `develop`). | — |
| `fix/*` | Исправления багов (ветвятся от `develop`). | — |
| `release/v*` | Подготовка релиза (ветвится от `develop`). | ✅ PR required |
| `hotfix/*` | Срочные фиксы в production (ветвятся от `main`). | ✅ PR required |

## Workflow

```
hotfix/v0.1.1    ───────────────────────────→ main → develop
                                          ↗
feat/... ────────→ develop ─────→ release/v0.2.0 → main → tag v0.2.0
feat/... ────────↗                 ↑
fix/...  ────────↗                 │
```

### Создание фичи

```bash
git checkout develop
git pull
git checkout -b feat/product-catalog
# ... коммиты ...
git push origin feat/product-catalog
# → Создать PR в develop
```

### Релиз

```bash
git checkout develop
git pull
git checkout -b release/v0.1.0
# ... финальные фиксы, changelog ...
git push origin release/v0.1.0
# → Создать PR в main → Merge
git tag v0.1.0
git push origin v0.1.0
# → release.workflow.yml запустится автоматически
```

### Hotfix

```bash
git checkout main
git pull
git checkout -b hotfix/urgent-fix
# ... фикс ...
git push origin hotfix/urgent-fix
# → Создать PR в main → Merge → tag v0.1.1
# → Затем merge в develop
```

## Conventional Commits

Формат: `<type>(<scope>): <description>`

| Type | Описание | Пример |
|---|---|---|
| `feat` | Новая функциональность | `feat(product): add category filtering` |
| `fix` | Исправление бага | `fix(order): validate shipping address` |
| `docs` | Документация | `docs(SPEC-01): update API table` |
| `style` | Форматирование (не код) | `style: fix trailing semicolons` |
| `refactor` | Изменение без фичи/фикса | `refactor(gateway): extract auth middleware` |
| `perf` | Улучшение производительности | `perf(product): add Redis cache layer` |
| `test` | Тесты | `test(order): add checkout flow tests` |
| `build` | Сборка/зависимости | `build(deps): update pnpm to 9.6.0` |
| `ci` | CI/CD | `ci: add commitlint to pipeline` |
| `chore` | Прочее | `chore(deps): update Dockerfile base image` |
| `revert` | Откат коммита | `revert: feat(product): add category filtering` |

| Scope | Область |
|---|---|
| `gateway` | API Gateway |
| `product` | Product Service |
| `order` | Order Service |
| `partner` | Partner Service |
| `web` | Frontend (Next.js) |
| `admin` | Admin panel (Refine) |
| `shared` | Общие пакеты |
| `infra` | Docker, CI/CD, deployment |
| `docs` | Документация |
| `deps` | Зависимости |
| `release` | Релизные изменения |

### Правила

1. **Не более 100 символов** в subject
2. **Без точки** в конце subject
3. **lowercase** в начале
4. **Scope обязателен** для `feat`, `fix`, `perf`, `refactor`

## Branch Protection Rules (GitHub)

Настроить вручную в Settings → Branches:

### `main`
- [x] Require pull request reviews (1 approval)
- [x] Require status checks to pass before merging
- [x] Require branches to be up to date
- [x] Status checks: `Lint & Type Check`, `Test Node.js Services`, `Test Python Services`, `Security Scan`
- [x] Do not allow bypassing the above settings
- [x] Restrict pushes that match (allow admins)

### `develop`
- [x] Require pull request reviews
- [x] Require status checks to pass
- [x] Status checks: `Lint & Type Check`, `Test Node.js Services`, `Test Python Services`, `Conventional Commits`

### `release/*`
- [x] Require pull request reviews

## Автоматизация

| Событие | Что происходит |
|---|---|
| `push` в `main`/`develop` | CI: lint → type-check → test → security → docker-build |
| `PR` в `main`/`develop` | CI + commitlint валидация |
| `push` тега `v*` | Release workflow: GitHub Release + Docker push к GHCR |
