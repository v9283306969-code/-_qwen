extends:
  - "@commitlint/config-conventional"

# Типы коммитов (Conventional Commits)
# feat: новая функциональность
# fix: исправление бага
# docs: документация
# style: форматирование, точки с запятой и т.д. (не влияющие на код)
# refactor: изменение кода (не фича и не фикс)
# perf: улучшение производительности
# test: добавление/исправление тестов
# build: изменения в сборке/зависимостях
# ci: изменения в CI/CD
# chore: прочее (обновление зависимостей и т.д.)
# revert: откат коммита

# Scopes для MLECP:
# gateway, product, order, partner, web, admin, shared, infra, docs

rules:
  type-enum:
    - 2
    - always
    - [feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert]

  scope-enum:
    - 1
    - always
    - [gateway, product, order, partner, web, admin, shared, infra, docs, ci, deps, release]

  subject-case:
    - 2
    - never
    - [sentence-case, start-case, pascal-case, upper-case]

  subject-empty:
    - 2
    - never

  subject-full-stop:
    - 2
    - never
    - "."

  header-max-length:
    - 2
    - always
    - 100
