# SPEC-03: Partner Service (Партнёрская сеть)

**Дата создания:** 2026-05-25  
**Дата обновления:** 2026-05-25  
**Статус:** draft  
**Версия:** 1.0

---

## 1. Метаданные

| Поле | Значение |
|---|---|
| **ID** | SPEC-03 |
| **Название** | Partner Service (Партнёрская сеть, бонусы, ранги) |
| **Тип** | backend |
| **Стек** | Python 3.12, FastAPI, SQLAlchemy, Alembic, pydantic |
| **Зависит от** | SPEC-00 (Docker/Инфраструктура) |
| **Блокирует** | SPEC-02 (Order), SPEC-05 (Frontend) |
| **Роль QWEN** | Бэкенд-разработчик (Python) |
| **Промт** | `templates/backend-dev.md` |

---

## 2. Бизнес-контекст

### Назначение сервиса

Управление партнёрской сетью: регистрация пользователей по промокодам, построение цепочек (кто кого привёл), расчёт и начисление бонусов с каждой продажи, автоматический пересчёт рангов. **Самая сложная бизнес-логика в проекте.**

### Пользователи сервиса

| Кто | Как использует |
|---|---|
| Покупатель | Регистрация по промокоду, просмотр своей сети, бонусов, ранга |
| Агент (1 ур.) | Получает бонусы со всех продаж в сети, видит свою сеть |
| Реализатор (2 ур.) | Получает бонусы с личных продаж, приглашает покупателей |
| Администратор | Настройка бонусов/рангов, просмотр пользователей, ручные корректировки |

### Связь с бизнес-моделью

(`docs/business-models/multi-level-ecommerce.md` — разделы 3, 4, 5, 6, 7)
- 3 уровня участников: агент → реализатор → покупатель
- Ранговая система с множителями (Старт, Бронза, Серебро, Золото)
- Бонусы: 1 ур. 8-15%, 2 ур. 10-20%, 3 ур. скидка 10-15%
- Hold-период бонусов: 7-14 дней
- Откат транзакций при возвратах

---

## 3. Архитектурные решения

### Тип сервиса

Микросервис на Python/FastAPI. Самая сложная логика — обходы графов (реферальные цепочки), агрегации для рангов, расчёт бонусов.

### Принятые решения

| Решение | Почему | Альтернативы (отклонены) |
|---|---|---|
| Python/FastAPI | Обходы графов, рекурсивные вычисления, будущая аналитика (pandas, ML). Python для этого лучше Node.js. | Node.js — быстрее для I/O, но сложнее для алгоритмов на графах |
| Рекурсивный SQL (CTE) для обхода сети | PostgreSQL CTE рекурсия — эффективно для обхода дерева связей | Обход в Python-коде — медленно при большой глубине |
| Бонусы через bonus_transactions (журнал) | Аудит, откаты, история. Невозможно потерять/пересчитать. | Обновление balance напрямую — нет истории, невозможно откатить |
| Ранги пересчитываются фоном | Не в горячем пути. Можно пересчитать всех за ночь. | Реалтайм-пересчёт при каждой продаже — слишком дорого |
| Hold-период 7-14 дней | Снижает риск возвратов без потери мотивации | Мгновенная выплата — риск откатов при возвратах |

### Зависимости

| Зависимость | Тип | Назначение |
|---|---|---|
| PostgreSQL | Инфраструктура | Основная БД (пользователи, промокоды, бонусы, ранги) |
| Redis | Инфраструктура | Сессии, кэш профилей |
| SPEC-01 (Product Service) | Микросервис | Запрос цены товара для расчёта бонусов |
| SPEC-02 (Order Service) | Микросервис | Получение событий о заказах → начисление бонусов |
| Notification Service (future) | Микросервис | Отправка уведомлений о бонусах/рангах |
| ЮKassa | Внешний сервис | Интеграция выплат самозанятым |

---

## 4. Модель данных

### Таблицы

#### users

| Поле | Тип | Nullable | Описание | Пример |
|---|---|---|---|---|
| id | UUID | No | Уникальный идентификатор | 550e8400-e29b-... |
| email | VARCHAR(255) | No | Email (уникальный) | user@example.com |
| phone | VARCHAR(20) | Yes | Телефон | +79001234567 |
| password_hash | VARCHAR(255) | No | Хэш пароля (bcrypt) | $2b$12$... |
| level | SMALLINT | No | Уровень (1=агент, 2=реализатор, 3=покупатель) | 2 |
| rank | VARCHAR(20) | No | Текущий ранг | "bronze" |
| rank_multiplier | DECIMAL(3,2) | No | Множитель ранга | 1.20 |
| balance | DECIMAL(12,2) | No | Баланс бонусов | 1250.00 |
| registered_at | TIMESTAMP | No | Дата регистрации | 2026-05-25 10:00:00 |
| referral_code_id | UUID | Yes | Промокод, по которому зарегистрировался | UUID |
| own_promo_code_id | UUID | No | Свой уникальный промокод | UUID |
| is_active | BOOLEAN | No | Активен ли | true |
| created_at | TIMESTAMP | No | Время создания | 2026-05-25 10:00:00 |
| updated_at | TIMESTAMP | No | Время обновления | 2026-05-25 12:00:00 |

#### promo_codes

| Поле | Тип | Nullable | Описание | Пример |
|---|---|---|---|---|
| id | UUID | No | Уникальный идентификатор | ... |
| code | VARCHAR(50) | No | Текст промокода (AGENT-ABC123) | "AGENT-ABC123" |
| qr_code_url | VARCHAR(500) | Yes | URL QR-кода (PNG) | "/qr/agent-abc123.png" |
| owner_id | UUID | No | ID владельца (пользователя 1 ур.) | UUID |
| is_active | BOOLEAN | No | Активен ли | true |
| created_at | TIMESTAMP | No | Дата создания | ... |
| deactivated_at | TIMESTAMP | Yes | Дата деактивации | ... |

#### network_links

| Поле | Тип | Nullable | Описание | Пример |
|---|---|---|---|---|
| id | UUID | No | Уникальный идентификатор | ... |
| upline_id | UUID | No | Кто привёл (родитель в цепочке) | UUID |
| downline_id | UUID | No | Кого привёл (ребёнок в цепочке) | UUID |
| depth | SMALLINT | No | Глубина связи (1=прямой, 2=через одного) | 2 |
| promo_code_used | UUID | No | Промокод, по которому зарегистрировался | UUID |
| created_at | TIMESTAMP | No | Дата регистрации в сети | ... |

#### bonus_transactions

| Поле | Тип | Nullable | Описание | Пример |
|---|---|---|---|---|
| id | UUID | No | Уникальный идентификатор | ... |
| order_id | UUID | No | Связь с заказом | UUID |
| user_id | UUID | No | Кому начислен бонус | UUID |
| amount | DECIMAL(10,2) | No | Сумма бонуса | 200.00 |
| percentage | DECIMAL(5,2) | No | Процент от суммы заказа | 10.00 |
| type | VARCHAR(30) | No | Тип бонуса | "bonus_1_level" |
| status | VARCHAR(20) | No | Статус транзакции | "pending" |
| hold_until | TIMESTAMP | No | Дата окончания задержки | 2026-06-01 00:00:00 |
| reverted_at | TIMESTAMP | Yes | Дата отката (если был возврат) | null |
| created_at | TIMESTAMP | No | Дата начисления | 2026-05-25 14:00:00 |

#### ranks

| Поле | Тип | Nullable | Описание | Пример |
|---|---|---|---|---|
| id | UUID | No | Уникальный идентификатор | ... |
| name | VARCHAR(20) | No | Название ранга | "silver" |
| display_name | VARCHAR(50) | No | Отображаемое название | "Серебро" |
| level | SMALLINT | No | Для какого уровня (1=агент, 2=реализатор) | 1 |
| min_downlines | INT | No | Мин. количество прямых (для агентов) | 10 |
| min_network_sales | INT | No | Мин. оборот сети | 500 |
| multiplier | DECIMAL(3,2) | No | Множитель бонуса | 1.50 |
| is_active | BOOLEAN | No | Активен ли ранг | true |

#### rank_history

| Поле | Тип | Nullable | Описание | Пример |
|---|---|---|---|---|
| id | UUID | No | Уникальный идентификатор | ... |
| user_id | UUID | No | ID пользователя | UUID |
| old_rank | VARCHAR(20) | Yes | Предыдущий ранг | "bronze" |
| new_rank | VARCHAR(20) | No | Новый ранг | "silver" |
| reason | TEXT | No | Причина изменения | "10 реализаторов, 500 продаж" |
| changed_at | TIMESTAMP | No | Дата изменения | 2026-06-01 00:00:00 |

#### rank_settings (админ-настройки)

| Поле | Тип | Nullable | Описание | Пример |
|---|---|---|---|---|
| id | UUID | No | Уникальный идентификатор | ... |
| param_name | VARCHAR(50) | No | Название параметра | "bonus_1_level_base", "hold_period_days" |
| param_value | VARCHAR(100) | No | Значение | "8", "7" |
| updated_at | TIMESTAMP | No | Дата изменения | ... |
| updated_by | UUID | Yes | Кто изменил | UUID админа |

### Связи

| Таблица | Тип связи | Поле | Описание |
|---|---|---|---|
| users -> promo_codes | 1:1 | users.own_promo_code_id → promo_codes.id | У каждого пользователя свой промокод |
| users -> promo_codes | N:1 | users.referral_code_id → promo_codes.id | Пользователь зарегистрировался по промокоду |
| users -> network_links | 1:N | network_links.upline_id → users.id | Кто привёл других |
| bonus_transactions -> users | N:1 | bonus_transactions.user_id → users.id | Бонусы для пользователя |
| rank_history -> users | N:1 | rank_history.user_id → users.id | История рангов пользователя |
| rank_history -> ranks | N:1 | rank_history.new_rank → ranks.name | Какой ранг получил |

---

## 5. API контракты

### GraphQL схема (через API Gateway)

```graphql
type User {
  id: ID!
  email: String!
  phone: String
  level: Int!
  rank: Rank!
  rankMultiplier: Float!
  balance: Float!
  ownPromoCode: PromoCode!
  network: NetworkStats!
  bonuses: [BonusTransaction!]!
  registeredAt: DateTime!
}

type Rank { name: String!, displayName: String!, multiplier: Float! }
type PromoCode { code: String!, qrCodeUrl: String, isActive: Boolean! }
type BonusTransaction { id: ID!, amount: Float!, percentage: Float!, type: String!, status: String!, holdUntil: DateTime! }

type Query {
  me: User
  profile(userId: ID!): User
  network(userId: ID!): NetworkTree
  bonuses(userId: ID!, status: String): [BonusTransaction!]!
  adminUsers(filters: AdminUserFilters): [User!]!
  adminSettings: [RankSetting!]!
}

type Mutation {
  register(input: RegisterInput!): AuthResult!
  login(email: String!, password: String!): AuthResult!
  applyPromoCode(code: String!): PromoCodeResult!
  adminUpdateBonuses(input: BonusSettingsInput!): Boolean!
  adminUpdateRanks(input: RankSettingsInput!): Boolean!
}
```

### Внутренние REST endpoints (вызываются из API Gateway)

| Endpoint | Метод | Описание | Вход | Выход |
|---|---|---|---|---|
| `/internal/bonuses/calculate` | POST | Расчёт бонусов при заказе | `{ order_id, promo_code_id, order_total }` | `[ { user_id, amount, percentage, type } ]` |
| `/internal/bonuses/revert` | POST | Откат бонусов при возврате | `{ order_id }` | `{ reverted_count, total_amount }` |
| `/internal/ranks/recalculate` | POST | Пересчёт рангов (крон) | `{ }` | `{ recalculated_count, changes: [...] }` |
| `/internal/users/:id` | GET | Данные пользователя | `id` | `{ user, rank, network }` |
| `/internal/promo-codes/validate` | POST | Валидация промокода | `{ code }` | `{ valid, owner_id, is_active }` |

### Исходящие запросы (к другим сервисам)

| Сервис | Endpoint | Когда вызывается | Зачем |
|---|---|---|---|
| SPEC-02 (Order) | `GET /internal/orders/:id` | При откате бонусов | Получить сумму заказа |
| Notification (future) | `POST /internal/send-notification` | При начислении/ранге | Отправить email/SMS |

### Бизнес-логика расчёта бонусов (алгоритм)

```
Вход: order_id, promo_code_id, order_total

1. Найти promo_code → найти владельца (владелец = user_A, 1 ур.)
2. Найти all downline пользователей через network_links (CTE рекурсия, max depth=3)
3. Для каждого downline:
   a. Определить уровень (1, 2, 3)
   b. Прочитать rank и multiplier
   c. Рассчитать процент:
      - 1 ур. (агент): base_1_level * multiplier_агента
      - 2 ур. (реализатор): base_2_level * multiplier_реализатора
      - 3 ур. (покупатель): base_discount_3_level * multiplier (скидка на заказ)
   d. amount = order_total * percentage / 100
4. Создать bonus_transactions для каждого со статусом "pending"
5. hold_until = now() + hold_period_days (по умолчанию 7)
6. Вернуть список начисленных бонусов
```

### Ошибки

| Код | HTTP | Описание | Когда возвращается |
|---|---|---|---|
| PROMO_CODE_INVALID | 400 | Промокод не найден или неактивен | Неверный код при регистрации/покупке |
| PROMO_CODE_SELF_REFERRAL | 400 | Попытка зарегистрироваться по своему коду | Агент регистрируется по своему коду |
| USER_NOT_FOUND | 404 | Пользователь не найден | Запрос несуществующего user_id |
| RANK_CALCULATION_ERROR | 500 | Ошибка расчёта рангов | Баг в алгоритме |
| BONUS_CALCULATION_ERROR | 500 | Ошибка расчёта бонусов | Баг в формуле, нет сети |

---

## 6. Функциональные требования

| ID | Требование | Приоритет | Зависит от | Статус |
|---|---|---|---|---|
| FR-1 | Регистрация пользователя с промокодом | must | — | pending |
| FR-2 | Авторизация (JWT + refresh token) | must | FR-1 | pending |
| FR-3 | Генерация собственного промокода + QR | must | FR-1 | pending |
| FR-4 | Построение сети (рекурсивный обход CTE) | must | FR-1 | pending |
| FR-5 | Расчёт бонусов при заказе (алгоритм из разд. 5) | must | FR-4 | pending |
| FR-6 | Создание bonus_transactions (pending + hold) | must | FR-5 | pending |
| FR-7 | Подтверждение бонусов после hold_until | must | FR-6 | pending |
| FR-8 | Откат бонусов при возврате | must | FR-6 | pending |
| FR-9 | Пересчёт рангов (фоновая задача) | must | FR-4, FR-6 | pending |
| FR-10 | История рангов (rank_history) | should | FR-9 | pending |
| FR-11 | Админка: настройка базовых % и множителей | must | — | pending |
| FR-12 | Деактивация промокодов при неактивности (3 мес.) | should | — | pending |
| FR-13 | API: профиль пользователя (баланс, ранг, сеть) | must | FR-1 | pending |
| FR-14 | API: список бонусов пользователя | must | FR-6 | pending |
| FR-15 | Health check, логирование с correlationId | must | — | pending |

---

## 7. Нефункционаальные требования

| Требование | Значение | Как проверяется |
|---|---|---|
| Производительность (расчёт бонусов) | < 200ms для заказа с сетью 50 человек | Нагрузочный тест |
| Производительность (пересчёт рангов) | < 30 мин для 10 000 пользователей | Фоновая задача, лог времени |
| Надёжность | bonus_transactions — атомарная транзакция (ACID) | Интеграционный тест с rollback |
| Безопасность | Пароли bcrypt (cost 12), JWT 15 мин + refresh 30 дней | Code review |
| Отказоустойчивость | Если расчёт бонусов упал → заказ всё равно оформлен, бонусы пересчитаются позже | Retry-логика |

---

## 8. Тесты

### Unit-тесты (критично для расчёта бонусов)

| Сценарий | Вход | Ожидаемый результат |
|---|---|---|
| Расчёт бонусов: Старт | order_total=2000, сеть: 1агент(Старт)+1реал(Старт) | Агент: 160(8%), Реал: 200(10%) |
| Расчёт бонусов: Золото | order_total=2000, сеть: 1агент(Золото)+1реал(Золото) | Агент: 300(15%), Реал: 400(20%) |
| Откат бонусов | order_id с 2 транзакциями | status=reverted, balance уменьшены |
| Пересчёт рангов | Реализатор: 55 продаж за 3 мес. | Ранг: bronze → silver, multiplier обновлён |
| Самореферал | Регистрация по своему коду | Ошибка PROMO_CODE_SELF_REFERRAL |
| Глубина сети 4 | Агент → Реал → Покупатель → Покупатель | Только 2 уровня получают бонусы |

### Property-based тесты (fast-check / hypothesis)

| Инвариант | Условие |
|---|---|
| Сумма бонусов <= сумма заказа | Для любого заказа |
| hold_until >= now() + 7 дней | Для всех pending транзакций |
| multiplier >= 1.0 | Для всех рангов |
| no self-referral | Для всех network_links: upline != downline |

### Интеграционные тесты

| Сценарий | Что мокать | Что проверять |
|---|---|---|
| Регистрация → промокод генерируется | — | promo_codes содержит запись |
| Заказ → бонусы начисляются | Product Service (цену) | bonus_transactions созданы |
| Возврат → бонусы откатываются | — | status=reverted, balance обновлены |
| Пересчёт рангов — крон | — | rank_history содержит записи |

---

## 9. Файлы проекта

| Файл | Назначение | Создан? |
|---|---|---|
| `services/partner-service/src/main.py` | Точка входа, FastAPI app | [ ] |
| `services/partner-service/src/models/` | SQLAlchemy модели | [ ] |
| `services/partner-service/src/models/user.py` | Модель users | [ ] |
| `services/partner-service/src/models/promo_code.py` | Модель promo_codes | [ ] |
| `services/partner-service/src/models/network_link.py` | Модель network_links | [ ] |
| `services/partner-service/src/models/bonus_transaction.py` | Модель bonus_transactions | [ ] |
| `services/partner-service/src/models/rank.py` | Модели ranks, rank_history | [ ] |
| `services/partner-service/src/alembic/` | Миграции БД | [ ] |
| `services/partner-service/src/services/bonus_service.py` | Расчёт бонусов | [ ] |
| `services/partner-service/src/services/rank_service.py` | Пересчёт рангов | [ ] |
| `services/partner-service/src/services/network_service.py` | Обход сети (CTE) | [ ] |
| `services/partner-service/src/routers/` | FastAPI роутеры | [ ] |
| `services/partner-service/src/tests/` | Тесты | [ ] |
| `services/partner-service/Dockerfile` | Docker-образ (Python multi-stage, slim) | ✅ scaffold |
| `services/partner-service/requirements.txt` | Python зависимости (FastAPI, uvicorn — scaffold) | ✅ scaffold |
| `services/partner-service/src/main.py` | FastAPI scaffold с `/health` | ✅ scaffold |
| `services/partner-service/pyproject.toml` | Конфигурация проекта | [ ] |

---

## 10. Прогресс реализации

### Шаги реализации

| Шаг | Описание | Статус | Дата | Заметки |
|---|---|---|---|---|
| 1 | Настройка проекта (FastAPI, SQLAlchemy, Alembic, pydantic) | [ ] | | |
| 2 | Schema БД (SQLAlchemy модели, Alembic миграции) | [ ] | | |
| 3 | Регистрация с промокодом + генерация промокода | [ ] | | |
| 4 | Обход сети (CTE) | [ ] | | |
| 5 | Расчёт бонусов (алгоритм) | [ ] | | |
| 6 | bonus_transactions + hold-период | [ ] | | |
| 7 | Откат бонусов | [ ] | | |
| 8 | Пересчёт рангов (фоновая задача) | [ ] | | |
| 9 | rank_history | [ ] | | |
| 10 | Админ-настройки бонусов/рангов | [ ] | | |
| 11 | GraphQL-резолверы (через Gateway) | [ ] | | |
| 12 | Unit-тесты (бонусы, ранги, откаты) | [ ] | | |
| 13 | Интеграционные тесты | [ ] | | |
| 14 | Property-based тесты | [ ] | | |
| 15 | Health check, логирование | [ ] | | |
| 16 | Dockerfile (Python multi-stage) | ✅ scaffold | 2026-05-27 | Multi-stage, non-root, HEALTHCHECK (python urllib) |
| 17 | Деактивация неактивных промокодов | [ ] | | |

### Текущий контекст

- **Последнее действие:** Шаг 16 (Dockerfile scaffold) — 2026-05-27, Docker Compose верификация прошла успешно
- **Следующий шаг:** Шаг 1: Настройка проекта (FastAPI, SQLAlchemy, Alembic, pydantic) — Этап 3
- **Открытые вопросы:** —
- **Временное состояние:** FastAPI scaffold работает в Docker (port 3003, `/health` healthy)

---

## 11. Заметки и принятые решения

| Дата | Решение / Заметка | Кто |
|---|---|---|
| 2026-05-25 | CTE рекурсия для обхода сети — эффективнее обхода в Python | Qwen (Архитектор) |
| 2026-05-25 | bonus_transactions — журнал, не обновлять balance напрямую | Qwen (Архитектор) |
| 2026-05-25 | Максимальная глубина бонусов = 3 (1 агент + 1 реал + 1 покуп) | Qwen (Бизнес-аналитик) |
| 2026-05-25 | Property-based тесты — критично для расчёта бонусов | Qwen (Архитектор) |
| 2026-05-25 | Ранги пересчитываются фоном, не в реальном времени | Qwen (Архитектор) |

---

## 12. Проверка готовности

- [ ] Все функциональные требования реализованы
- [ ] Миграции БД написаны и применены
- [ ] Unit-тесты покрывают расчёт бонусов (все ранги)
- [ ] Интеграционные тесты проходят (заказ → бонусы → откат)
- [ ] Property-based тесты проверяют инварианты
- [ ] Dockerfile создан, сервис запускается в Docker Compose
- [ ] Health check endpoint реализован
- [ ] Секреты не захардкожены
- [ ] Логирование с correlationId работает
- [ ] Алгоритм расчёта бонусов документирован в коде

---

*Документ создан: 2026-05-25*
*Последнее обновление: 2026-05-25*
*Автор: Qwen Code (Бизнес-аналитик + Архитектор)*
