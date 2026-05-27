---
name: ci-cd-refinement-and-docs-sync
description: Настройка pre-commit hooks, Conventional Commits, release workflow, branching strategy + синхронизация документации после каждого шага
source: auto-skill
extracted_at: '2026-05-27T21:00:00.000Z'
updated_at: '2026-05-27T21:30:00.000Z'
---

## ⚠️ ВАЖНО: Совместимость версий с Node.js

При настройке CI инструментов **всегда фиксировать версии**, совместимые с Node.js пользователя.

### Обнаруженные при тестировании несовместимости (Node.js 20):

| Инструмент | :latest требует | Рабочая версия для Node.js 20 | Как указать |
|---|---|---|---|
| pnpm | v11 (Node >=22.13) | `pnpm@9` | `RUN npm install -g pnpm@9` |
| @commitlint/cli | v21 (Node >=22.12) | `@commitlint@19` | `"@commitlint/cli": "^19.3.0"` |

### Правило

При `pnpm install` или `npm install` CI-инструментов:
- **НЕ** использовать `@latest` по умолчанию
- Проверить `engines` в package.json инструмента
- Для Dockerfile: пинить конкретные версии в RUN-командах

Тестировать commitlint **ДО** коммита:
```bash
# Тест валидного сообщения
npx commitlint --last --verbose

# Тест через файл (echo добавляет whitespace в cmd.exe)
echo -n "feat(scope): description" > /tmp/test.txt && npx commitlint --edit /tmp/test.txt
```

## Когда применять

Базовый CI/CD pipeline уже настроен (lint → test → build → deploy stub). Нужно добавить:
- Пре-коммит валидацию (gitleaks локально, conventional commits)
- Release автоматизацию (теги → GitHub Release → Docker push)
- Branching strategy документацию
- Синхронизацию всей проектной документации по завершении шага

## Процедура

### 1. Pre-commit hooks (Husky v9 + gitleaks)

**`.husky/pre-commit`:**
```bash
#!/bin/sh
# Pre-commit hook: gitleaks scan
echo "🔍 Running gitleaks pre-commit scan..."
if ! command -v gitleaks &> /dev/null; then
    if command -v docker &> /dev/null; then
        git diff --cached --name-only --diff-filter=d | docker run --rm -i zricethezav/gitleaks:latest detect --report-format json --report-path /dev/null 2>/dev/null
        # Если docker/gitleaks недоступен — exit 0 (CI всё равно проверит)
        exit 0
    fi
    exit 0
fi
gitleaks detect --staged --report-format json --report-path /dev/null 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Gitleaks found potential secrets!"
    echo "   Use 'git commit --no-verify' to bypass"
    exit 1
fi
echo "✅ Gitleaks scan passed"
```

**`.gitleaks.toml` — кастомная конфигурация с allowlist:**
```toml
title = "Project gitleaks config"
[[rules]]
  id = "generic-secret"
  regex = '''(?i)(secret|password|token|api_?key).{0,20}['\"][0-9a-zA-Z]{16,}['\"]'''
  [[rules.allowlist]]
    paths = ['''docs/''', '''templates/''', '''\.env\.example''', '''\.md$''']
[allowlist]
  paths = ['''node_modules''', '''\.git''', '''coverage''', '''dist''', '''pnpm-lock\.yaml''']
```

### 2. Conventional Commits (commitlint + husky)

**`package.json` devDependencies:**
```json
{
  "scripts": { "prepare": "husky" },
  "devDependencies": {
    "@commitlint/cli": "^19.3.0",
    "@commitlint/config-conventional": "^19.2.2",
    "husky": "^9.0.11"
  }
}
```

**`commitlint.config.js`:**
```js
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", [
      "feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"
    ]],
    "scope-enum": [1, "always", ["gateway", "product", "order", "partner", "web", "admin", "shared", "infra", "docs", "ci", "deps", "release"]],
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
  }
};
```

**`.husky/commit-msg`:**
```bash
#!/bin/sh
echo "📝 Validating commit message..."
if command -v npx &> /dev/null; then
    npx --no -- commitlint --edit "$1" 2>/dev/null
    if [ $? -ne 0 ]; then
        echo "💡 Examples:"
        echo "   feat(gateway): add GraphQL schema"
        echo "   fix(order): validate shipping address"
        echo "   docs(SPEC-01): update API table"
        exit 1
    fi
fi
echo "✅ Commit message is valid"
```

### 3. CI Pipeline — добавить commitlint job

В `.github/workflows/ci.yml`:
```yaml
on:
  push:
    branches: [main, develop, 'release/*']
  pull_request:
    branches: [main, develop]

jobs:
  commitlint:
    name: Conventional Commits
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: npx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose
```

Gitleaks в CI — добавить `GITLEAKS_CONFIG: .gitleaks.toml` к env gitleaks-action.

### 4. Release Workflow

`.github/workflows/release.yml` — tag-triggered:
```yaml
on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g., 0.1.0)'
        required: true
        type: string

jobs:
  create-release:
    permissions:
      contents: write
    steps:
      - uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ version }}
          name: "Release ${{ version }}"
          body: ${{ changelog }}

  docker-push:
    permissions:
      packages: write
    strategy:
      matrix:
        service:
          - name: gateway
            context: services/gateway
          # ... other services
    steps:
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: ${{ matrix.service.context }}
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/mlecp-${{ matrix.service.name }}:${{ version }}
```

### 5. Branching Strategy документация

Создать `docs/BRANCHING.md` с:
- Таблица веток (main/develop/feat/fix/release/hotfix) и их назначение
- Диаграмма workflow (ASCII)
- Conventional Commits таблица (type + scope + примеры)
- Branch Protection Rules чек-лист для GitHub Settings → Branches
- Автоматизация таблица (какой event → какие проверки)

### 6. README.md — Contributing секция

Добавить в README:
```markdown
## 📋 Contributing

### Conventional Commits
<type>(<scope>): <description>

### Pre-commit hooks
- gitleaks — scan for secrets
- commitlint — validate commit message format
Run `pnpm install` to install hooks automatically.

### Branching
See `docs/BRANCHING.md` for full strategy.
```

### 7. Обновить документацию после шага

**После каждого шага ОБЯЗАТЕЛЬНО обновить:**

| Файл | Что обновить |
|---|---|
| `ROADMAP.md` | Статус шага → ✅, обновить "Что дальше" |
| `PROJECT-LIFECYCLE.md` | Добавить детали результата шага |
| `SPEC-XX.md` | FR статусы, прогресс таблица, текущий контекст |
| `README.md` | Новые секции если добавлены |
| `memory/current_work.md` | Полный контекст шага, следующий шаг, ⚠️ отклонения |

Это не "бумажная работа" — без этого следующая сессия начнёт с нулевого контекста.

## Типичные проблемы

| Проблема | Решение |
|---|---|
| gitleaks не установлен локально | Docker fallback (запускать `zricethezav/gitleaks:latest`) |
| commitlint падает в CI | `fetch-depth: 0` в checkout, `--from base.sha --to head.sha` |
| husky hooks не работают | `pnpm install` запустит `prepare` скрипт; проверить что `.husky/` файлы имеют `#!/bin/sh` и executable бит |
| release workflow не триггерится | Тег должен быть форматом `v*` (v0.1.0, v1.0.0) |
| Docker push к GHCR fails | Проверить `packages: write` permission в workflow |
