# SPEC-02: Order Service (Заказы и корзина)

**Дата создания:** 2026-05-27
**Дата обновления:** 2026-05-27
**Статус:** draft
**Версия:** 1.0

---

## 1. Метаданные

| Поле | Значение |
|---|---|
| **ID** | SPEC-02 |
| **Название** | Order Service (Заказы и корзина) |
| **Тип** | backend microservice |
| **Стек** | Node.js + TypeScript, NestJS, Drizzle ORM |
| **Зависит от** | SPEC-00 (Docker/Инфраструктура), SPEC-01 (Product Service) |
| **Блокирует** | SPEC-05 (Frontend) |
| **Роль QWEN** | Бэкенд-разработчик |
| **Промт** | `templates/backend-dev.md` |

---

## 2. Бизнес-контекст

### Назначение сервиса

Управление полным жизненным циклом заказа: корзина (Redis) — создание заказа — оплата (ЮKassa) — доставка — статусы. Централизованная точка, агрегирующая данные о товарах (Product Service), промокодах и бонусах (Partner Service), платёжном статусе (ЮKassa).

### Пользователи сервиса

| Кто | Как использует |
|---|---|
| Покупатель | Добавление/удаление товаров в корзину, оформление заказа, оплата, просмотр истории заказов |
| Администратор | Просмотр заказов, ручная смена статусов (отмена, возврат), мониторинг платежей |
| Payment Gateway | ЮKassa → webhook → подтверждение оплаты |
| Product Service | Запрос наличия и цены товара при создании заказа |
| Partner Service | Валидация промокодов, расчёт бонусов/скидок |

### Связь с бизнес-моделью

Две категории товаров (косметика, БАДы) — единая корзина и оформление заказа для обеих витрин. Многоуровневая партнёрская программа: промокоды и бонусы обрабатываются через Partner Service. (`docs/business-models/multi-level-ecommerce.md`)

---

## 3. Архитектурные решения

### Тип сервиса

Бэкенд-микросервис с GraphQL-резолверами для клиентских запросов + внутренние REST-эндпоинты для межсервисного взаимодействия. Использует Redis для корзины (низкая задержка, TTL), PostgreSQL для заказов (ACID, история платежей).

### Принятые решения

| Решение | Почему | Альтернативы (отклонены) |
|---|---|---|
| Корзина в Redis с TTL | Самая часто изменяемая структура пользователя. TTL обеспечивает автоматическую очистку брошенных корзин. Без TTL — таблицы будут расти бесконтрольно. | Корзина в PostgreSQL → медленные операции чтения/записи, нет автосброса |
| Хранить items как JSON в Redis | Корзина — временная структура, нормализация не нужна. JSON даёт O(1) чтение всей корзины. | Реляционные таблицы → JOIN для каждого чтения корзины |
| Асинхронная оплата через webhook ЮKassa | ЮKassa не возвращает результат мгновенно — только webhook подтверждает факт оплаты. Синхронный вызов → таймауты. | Опрос API ЮKassa (polling) → лишний трафик, задержки |
| Отдельная таблица order_items | Заказ может содержать несколько позиций. Денормализация в JSON нарушит аналитику и поиск по товарам. | JSON-колонка в orders → невозможно агрегировать по товарам |
| CorrelationId через все вызовы | Распределённая трассировка: один запрос пользователя может затронуть 3–4 сервиса. Без correlationId — невозможна отладка. | Каждый сервис логирует отдельно → невозможно связать цепочку |

### Зависимости

| Зависимость | Тип | Назначение |
|---|---|---|
| PostgreSQL | Инфраструктура | Основная БД (заказы, позиции, платежи) |
| Redis | Инфраструктура | Хранение корзин (key: `cart:{userId}`, TTL) |
| GraphQL Gateway | Инфраструктура | Маршрутизация клиентских GraphQL-запросов |
| Product Service (SPEC-01) | Микросервис | Проверка наличия, цены, актуальности товаров |
| Partner Service | Микросервис | Валидация промокодов, расчёт бонусов |
| ЮKassa | Внешний Платёжный API | Приём платежей, webhook-подтверждение |

### Диаграмма потока заказа

```
Пользователь → addToCart → Redis (cart:set userId)
Пользователь → removeFromCart → Redis (cart:update userId)
Пользователь → checkout → 
  1. Получить корзину из Redis
  2. Проверить наличие товаров → Product Service
  3. Проверить промокод → Partner Service
  4. Рассчитать итоговую сумму
  5. Создать заказ + order_items (PostgreSQL, транзакция)
  6. Удалить корзину из Redis
  → вернуть orderId
Пользователь → payOrder → 
  1. Создать запись в payments
  2. Инициализировать платёж в ЮKassa
  3. Вернуть URL для оплаты
ЮKassa → webhook → 
  1. Найти payment по provider_payment_id
  2. Обновить статус payment
  3. Обновить статус заказа на "paid"
```

---

## 4. Модель данных

### Корзина (Redis)

**Ключ:** `cart:{userId}`
**TTL:** 30 дней (2 592 000 секунд) — брошенные корзины очищаются автоматически
**Тип:** Hash / JSON String

```json
{
  "id": "uuid-cart-id",
  "user_id": "uuid-user-id",
  "items": [
    { "product_id": "uuid", "quantity": 2, "unit_price": 2500.00 }
  ],
  "created_at": "2026-05-27T10:00:00.000Z",
  "updated_at": "2026-05-27T12:30:00.000Z"
}
```

| Поле | Тип | Описание | Пример |
|---|---|---|---|
| id | UUID | Уникальный идентификатор корзины | 550e8400-... |
| user_id | UUID | ID владельца корзины | 660e8400-... |
| items | JSON Array | Массив позиций корзины | `[{product_id, quantity, unit_price}]` |
| created_at | ISO 8601 | Время создания корзины | "2026-05-27T10:00:00.000Z" |
| updated_at | ISO 8601 | Время последнего обновления | "2026-05-27T12:30:00.000Z" |

### orders

| Поле | Тип | Nullable | Описание | Пример |
|---|---|---|---|---|
| id | UUID | No | Уникальный идентификатор заказа | 550e8400-e29b-... |
| user_id | UUID | No | ID пользователя-заказчика | 660e8400-... |
| promo_code_id | UUID | Yes | ID применённого промокода (null если нет) | null или UUID |
| total_amount | DECIMAL(12,2) | No | Сумма до скидок | 7500.00 |
| discount_amount | DECIMAL(12,2) | No | Размер скидки | 750.00 |
| final_amount | DECIMAL(12,2) | No | Итоговая сумма к оплате | 6750.00 |
| status | ENUM | No | Статус заказа: `pending`, `paid`, `shipped`, `delivered`, `returned`, `cancelled` | "pending" |
| payment_id | UUID | Yes | Связанный платёж (null до оплаты) | null |
| shipping_address | JSON | No | Адрес доставки | `{"city":"Москва","street":"Ленина","house":"10","zip":"101000"}` |
| created_at | TIMESTAMP | No | Время создания | 2026-05-27 10:00:00 |
| updated_at | TIMESTAMP | No | Время обновления | 2026-05-27 12:30:00 |

### order_items

| Поле | Тип | Nullable | Описание | Пример |
|---|---|---|---|---|
| id | UUID | No | Уникальный идентификатор позиции | ... |
| order_id | UUID | No | ID родительского заказа (FK → orders.id) | UUID заказа |
| product_id | UUID | No | ID товара (ссылка на Product Service) | UUID товара |
| quantity | INT | No | Количество единиц товара | 2 |
| unit_price | DECIMAL(10,2) | No | Цена за единицу (на момент заказа) | 2500.00 |
| total_price | DECIMAL(12,2) | No | quantity × unit_price | 5000.00 |

### payments

| Поле | Тип | Nullable | Описание | Пример |
|---|---|---|---|---|
| id | UUID | No | Уникальный идентификатор платежа | ... |
| order_id | UUID | No | ID связанного заказа (FK → orders.id) | UUID заказа |
| provider | VARCHAR(50) | No | Платёжная система | "yookassa" |
| provider_payment_id | VARCHAR(255) | Yes | ID платежа в ЮKassa | "2e6d2e02-000f-..." |
| amount | DECIMAL(12,2) | No | Сумма платежа | 6750.00 |
| status | VARCHAR(30) | No | Статус: `pending`, `succeeded`, `failed`, `refunded` | "pending" |
| created_at | TIMESTAMP | No | Время создания | 2026-05-27 14:00:00 |

### Диаграмма состояний заказа

```
pending ──→ paid ──→ shipped ──→ delivered
   │                    │            │
   ├─→ cancelled        ├─→ returned←┘
   │
   (timeout если не оплачен > X часов)
```

| Переход | Условие | Кто инициирует |
|---|---|---|
| `pending` → `paid` | Webhook ЮKassa: payment succeeded | Система (webhook handler) |
| `paid` → `shipped` | Товар передан в доставку | Администратор |
| `shipped` → `delivered` | Получатель подтвердил получение | Система / Администратор |
| `delivered` → `returned` | Заявка на возврат | Администратор |
| `pending` → `cancelled` | Пользователь отменил / таймаут оплаты | Пользователь / Система |
| `paid` → `returned` | Возврат средств | Администратор |

### Связи с другими таблицами

| Таблица | Тип связи | Поле | Описание |
|---|---|---|---|
| orders → payments | 1:1 | orders.payment_id → payments.id | Заказ имеет один активный платёж |
| order_items → orders | N:1 | order_items.order_id → orders.id | Несколько позиций в одном заказе |
| carts — (внешняя) | — | — | Корзина в Redis, удаляется при checkout |

---

## 5. API контракты

### GraphQL (через gateway)

#### Схема

```graphql
type CartItem {
  productId: ID!
  quantity: Int!
  unitPrice: Float!
}

type Cart {
  id: ID!
  items: [CartItem!]!
  updatedAt: String!
}

type OrderItem {
  id: ID!
  productId: ID!
  quantity: Int!
  unitPrice: Float!
  totalPrice: Float!
}

type Payment {
  id: ID!
  provider: String!
  providerPaymentId: String
  amount: Float!
  status: String!
}

type ShippingAddress {
  city: String!
  street: String!
  house: String!
  zip: String!
}

type Order {
  id: ID!
  items: [OrderItem!]!
  totalAmount: Float!
  discountAmount: Float!
  finalAmount: Float!
  status: String!
  shippingAddress: ShippingAddress!
  payment: Payment
  createdAt: String!
  updatedAt: String!
}

type MeResult {
  cart: Cart
  orders: [Order!]!
}

input CartItemInput {
  productId: ID!
  quantity: Int!
}

input ShippingAddressInput {
  city: String!
  street: String!
  house: String!
  zip: String!
}

input CheckoutInput {
  promoCode: String
  shippingAddress: ShippingAddressInput!
}

type CheckoutResult {
  orderId: ID!
  finalAmount: Float!
  paymentUrl: String!
}

type MutationResult {
  success: Boolean!
  error: String
}

type Query {
  me: MeResult!
  order(id: ID!): Order
}

type Mutation {
  addToCart(productId: ID!, quantity: Int!): MutationResult!
  removeFromCart(productId: ID!): MutationResult!
  checkout(input: CheckoutInput!): CheckoutResult!
  payOrder(orderId: ID!): MutationResult!
}
```

### GraphQL endpoints

| Endpoint | Тип | Описание | Вход | Выход |
|---|---|---|---|---|
| `me { cart, orders }` | Query | Получить текущую корзину и историю заказов пользователя | — | `{ cart, orders }` |
| `order(id)` | Query | Получить детали конкретного заказа (опционально, можно через `me`) | `id: ID!` | `{ order }` |

| Входящие запросы (межсервисные, REST)

| Endpoint | Метод | Описание | Вход | Выход |
|---|---|---|---|---|
| `/internal/orders` | POST | Создать заказ (вызывается из других сервисов или оркестратора) | `{ userId, items, promoCode, shippingAddress }` | `{ orderId, finalAmount, paymentUrl }` |
| `/internal/orders/:id` | GET | Получить детали заказа | `id` в пути | `{ order, items, payment }` |
| `/internal/orders/:id/cancel` | POST | Отменить заказ | `id` в пути, `{ reason }` в теле | `{ success, newStatus }` |
| `/internal/webhooks/yookassa` | POST | Обработать webhook от ЮKassa | Raw body (ЮKassa payload) | `200 OK` |
| `/internal/orders/health` | GET | Health check | — | `{ status: "ok" }` |

### Исходящие запросы (к другим сервисам)

| Сервис | Endpoint | Когда вызывается | Зачем |
|---|---|---|---|
| Product Service | `POST /internal/products/check-stock` | При создании заказа | Проверить наличие и зафиксировать товары |
| Product Service | `POST /internal/products/reserve` | При создании заказа | Зарезервировать товары на складе |
| Product Service | `POST /internal/products/release-reservation` | При отмене заказа | Снять резервирование товаров |
| Partner Service | `POST /internal/promo/validate` | При checkout (если указан промокод) | Проверить валидность и скидку |
| Partner Service | `POST /internal/promo/calculate-bonus` | При checkout | Рассчитать бонусы пользователя |

### Ошибки

| Код | HTTP | Описание | Когда возвращается |
|---|---|---|---|
| CART_EMPTY | 400 | Корзина пуста при попытке checkout | Вызов checkout на пустой корзине |
| PRODUCT_NOT_AVAILABLE | 409 | Товар закончился или недоступен | Product Service вернул 0 остатков или товар не найден |
| PROMO_CODE_INVALID | 400 | Промокод недействителен | Partner Service вернул ошибку валидации |
| ORDER_NOT_FOUND | 404 | Заказ не найден | Запрос несуществующего `orderId` |
| ORDER_STATUS_INVALID | 400 | Невалидный переход статуса заказа | Попытка перевести заказ в запрещённый статус |
| PAYMENT_FAILED | 422 | Платёж отклонён | ЮKassa вернула ошибку / отказ в оплате |
| ORDER_ALREADY_CANCELLED | 409 | Заказ уже отменён или оплачен | Попытка отменить заказ в статусе `paid` и выше |

---

## 6. Функциональные требования

| ID | Требование | Приоритет | Зависит от | Статус |
|---|---|---|---|---|
| FR-1 | Добавление товара в корзину (Redis) | must | SPEC-01 | pending |
| FR-2 | Удаление товара из корзины (Redis) | must | — | pending |
| FR-3 | Получение корзины пользователя (Redis) | must | — | pending |
| FR-4 | Автоматическое удаление корзины по TTL (30 дней) | must | — | pending |
| FR-5 | Обновление количества товара в корзине | must | — | pending |
| FR-6 | Создание заказа (checkout): получение корзины из Redis | must | FR-1, FR-3 | pending |
| FR-7 | Проверка наличия товаров через Product Service при checkout | must | SPEC-01, FR-6 | pending |
| FR-8 | Резервирование товаров на складе через Product Service | must | FR-7 | pending |
| FR-9 | Валидация промокода через Partner Service при checkout | should | FR-6 | pending |
| FR-10 | Расчёт итоговой суммы (с учётом промокодов и бонусов) | must | FR-6, FR-9 | pending |
| FR-11 | Атомарная транзакция: заказ + order_items (PostgreSQL) | must | FR-10 | pending |
| FR-12 | Удаление корзины из Redis после успешного checkout | must | FR-11 | pending |
| FR-13 | Инициализация платежа через ЮKassa | must | FR-11 | pending |
| FR-14 | Обработка webhook от ЮKassa (подтверждение оплаты) | must | FR-13 | pending |
| FR-15 | Автоматический переход `pending` → `paid` при webhook success | must | FR-14 | pending |
| FR-16 | Отмена заказа пользователем (`pending` → `cancelled`) | must | FR-6 | pending |
| FR-17 | Отмена заказа с таймаутом (не оплачен > X часов) | should | FR-14 | pending |
| FR-18 | Вручную отменить заказ с снятием резерва товаров | must | FR-8, FR-16 | pending |
| FR-19 | Статусы заказа: `pending` → `paid` → `shipped` → `delivered` → `returned` | should | — | pending |
| FR-20 | Просмотр истории заказов пользователя | must | — | pending |
| FR-21 | Health check endpoint | should | — | pending |
| FR-22 | Логирование запросов с correlationId | must | — | pending |

---

## 7. Нефункциональные требования

| Требование | Значение | Как проверяется |
|---|---|---|
| Производительность (корзина) | Операции чтения/записи Redis < 10ms (p95) | Нагрузочный тест (k6/Artillery) |
| Производительность (checkout) | Полный цикл checkout < 1s (p95), включая внешние вызовы | Нагрузочный тест, трейсинг |
| Производительность (получение заказа) | Запрос заказа из PostgreSQL < 50ms (p95) | Нагрузочный тест |
| Надёжность | Сервис восстанавливается при рестарте Docker | docker-compose restart → health check |
| Надёжность | Корзина не теряается при рестарте Redis (Redis persistence: AOF) | Redis конфигурация, тест восстановления |
| Безопасность | Только внутренние сервисы вызывают `/internal/*` | Network policy в Docker |
| Безопасность | Webhook от ЮKassa — верификация подписи | Проверка HMAC-подписи в header |
| Масштабируемость | Горизонтальное масштабирование (多个 инстансов за load balancer) | Запуск 2+ контейнеров через Docker Compose |
| Idempotency | Повторный webhook от ЮKassa не создаёт дубликаты платежей | Проверка `payment_id` + status before update |
| CorrelationId | Все логи в цепочке содержат один correlationId | Проверка логов при распределённом запросе |

---

## 8. Тесты

### Unit-тесты

| Сценарий | Вход | Ожидаемый результат |
|---|---|---|
| Добавление в корзину (новый товар) | userId, productId, quantity=2 | Товар добавлен в Redis, created_at установлен |
| Добавление в корзину (существующий товар) | userId, productId (уже в корзине), quantity=1 | quantity увеличен (merged) |
| Удаление из корзины | userId, productId | Товар удалён, остальные сохранены |
| Удаление несуществующего товара из корзины | userId, productId (нет в корзине) | Возвращается success, корзина не изменяется |
| Checkout: расчёт суммы | items=[{qty:2, price:2500}, {qty:1, price:1500}], discount=10% | totalAmount=6500, discountAmount=650, finalAmount=5850 |
| Переход статуса `pending` → `paid` | orderId, webhook event=payment.succeeded | order.status = "paid", updatedAt обновлён |
| Переход статуса (невалидный) | orderId в статусе `delivered`, попытка → `cancelled` | Ошибка ORDER_STATUS_INVALID |
| Отмена заказа | orderId в статусе `pending` | order.status = "cancelled", резерв снят |
| Верификация webhook ЮKassa | payload + signature | Подпись валидна → обработка, иначе → 401 |

### Интеграционные тесты

| Сценарий | Что мокать | Что проверять |
|---|---|---|
| Полный checkout | Product Service (stock OK), Partner Service (promo valid), Redis, PostgreSQL | Заказ создан в БД, order_items записаны, корзина удалена, payment создан |
| Checkout: товар закончился | Product Service (stock=0) | Заказ НЕ создан, ошибка PRODUCT_NOT_AVAILABLE |
| Checkout: промокод невалиден | Partner Service (promo invalid) | Заказ НЕ создан, ошибка PROMO_CODE_INVALID |
| Webhook ЮKassa: успех | — (реальный webhook payload) | payment.status = "succeeded", order.status = "paid" |
| Webhook ЮKassa: повторный | — (тот же payload второй раз) | Никаких изменений (idempotency), 200 OK |
| Health check | — | Возвращает { status: "ok", db: "connected", redis: "connected" } |
| CorrelationId propagation | — | Все логи одного запроса содержат одинаковый correlationId |

---

## 9. Файлы проекта

| Файл | Назначение | Создан? |
|---|---|---|
| `services/order-service/src/index.ts` | Точка входа, NestJS bootstrap | [ ] |
| `services/order-service/src/schema.ts` | Drizzle-схема БД (orders, order_items, payments) | [ ] |
| `services/order-service/src/drizzle/` | Миграции PostgreSQL | [ ] |
| `services/order-service/src/services/cart.service.ts` | Бизнес-логика корзины (Redis CRUD) | [ ] |
| `services/order-service/src/services/order.service.ts` | Бизнес-логика заказов (checkout, отмена, история) | [ ] |
| `services/order-service/src/services/payment.service.ts` | Бизнес-логика платежей (ЮKassa, webhook) | [ ] |
| `services/order-service/src/clients/product.client.ts` | HTTP-клиент к Product Service | [ ] |
| `services/order-service/src/clients/partner.client.ts` | HTTP-клиент к Partner Service | [ ] |
| `services/order-service/src/clients/yookassa.client.ts` | HTTP-клиент к ЮKassa API | [ ] |
| `services/order-service/src/resolvers/order.resolver.ts` | GraphQL-резолверы (Query/Mutation) | [ ] |
| `services/order-service/src/controllers/webhook.controller.ts` | REST-контроллер webhook'ов ЮKassa | [ ] |
| `services/order-service/src/controllers/internal.controller.ts` | Внутренние REST-эндпоинты | [ ] |
| `services/order-service/src/guards/internal-auth.guard.ts` | Guard для внутренних запросов | [ ] |
| `services/order-service/src/interceptors/correlation-id.interceptor.ts` | Interceptor для correlationId | [ ] |
| `services/order-service/src/utils/status-transitions.ts` | Машина состояний заказов | [ ] |
| `services/order-service/src/tests/` | Unit и интеграционные тесты | [ ] |
| `services/order-service/Dockerfile` | Docker-образ (multi-stage, pnpm@9, Node 20) | ✅ scaffold |
| `services/order-service/package.json` | Зависимости (express scaffold), скрипты | ✅ scaffold |
| `services/order-service/tsconfig.json` | TypeScript конфигурация | ✅ scaffold |
| `services/order-service/tsconfig.build.json` | TypeScript build конфиг | ✅ scaffold |
| `services/order-service/src/main.ts` | Express scaffold с `/health` | ✅ scaffold |
| `services/order-service/.env.example` | Пример переменных окружения | [ ] |

---

## 10. Прогресс реализации

> **ВАЖНО:** Этот раздел обновляется после каждого рабочего шага.
> При возобновлении работы после разрыва сессии — начинать с первого `pending` пункта.

### Шаги реализации

| Шаг | Описание | Статус | Дата | Заметки |
|---|---|---|---|---|
| 1 | Настройка проекта (NestJS, Drizzle, Redis, зависимости) | [ ] | | |
| 2 | Схема БД (Drizzle: orders, order_items, payments), миграции | [ ] | | |
| 3 | Cart Service: Redis CRUD (get, set, update, delete, TTL) | [ ] | | |
| 4 | Order Service: создание заказа (checkout) с расчётом суммы | [ ] | | |
| 5 | Order Service: история заказов, детали заказа | [ ] | | |
| 6 | Order Service: отмена заказа, снятие резерва | [ ] | | |
| 7 | Payment Service: интеграция с ЮKassa (создание платежа) | [ ] | | |
| 8 | Payment Service: webhook handler (ЮKassa → статус) | [ ] | | |
| 9 | Status Machine: валидация переходов статусов | [ ] | | |
| 10 | GraphQL-резолверы (me, addToCart, removeFromCart, checkout, payOrder) | [ ] | | |
| 11 | Корреляционные ID (Interceptor, логирование) | [ ] | | |
| 12 | Internal REST controllers | [ ] | | |
| 13 | Unit-тесты (логика корзины, заказа, платежей, статусов) | [ ] | | |
| 14 | Интеграционные тесты (Redis, mock external services) | [ ] | | |
| 15 | Dockerfile, .env.example | ✅ scaffold | 2026-05-27 | Multi-stage, pnpm@9, non-root, HEALTHCHECK |
| 16 | Интеграция: Product Service (stock check, reservation) | [ ] | | |
| 17 | Интеграция: Partner Service (promo codes, bonuses) | [ ] | | |

### Текущий контекст

- **Последнее действие:** Шаг 15 (Dockerfile scaffold) — 2026-05-27, Docker Compose верификация прошла успешно
- **Следующий шаг:** Шаг 1: Настройка проекта (NestJS, Drizzle, Redis, зависимости) — Этап 3
- **Открытые вопросы:**
  - Сколько часов дать таймаут на неоплаченный заказ? (предложение: 24 часа)
  - Нужен ли механизм повторной попытки платежа при отказе ЮKassa?
  - Требуется ли частичный возврат (return отдельных позиций)?
- **Временное состояние:** Express scaffold работает в Docker (port 3002, `/health` healthy)

---

## 11. Заметки и принятые решения

| Дата | Решение / Заметка | Кто |
|---|---|---|
| 2026-05-27 | Корзина в Redis с TTL 30 дней — автоматическая очистка брошенных корзин | Qwen (Архитектор) |
| 2026-05-27 | Оплата через ЮKassa: асинхронная, webhook — синхронный polling отклонён | Qwen (Архитектор) |
| 2026-05-27 | Корзина удаляется из Redis сразу после успешного checkout, не после оплаты | Qwen (Архитектор) |
| 2026-05-27 | Машина состояний заказов строго контролирует переходы — прямой `delivered` из `pending` невозможен | Qwen (Архитектор) |
| 2026-05-27 | ЮKassa webhook: обязательная верификация подписи, idempotency при повторных вызовах | Qwen (Архитектор) |
| 2026-05-27 | `unit_price` в order_items — на момент заказа, не текущая (историческая цена) | Qwen (Архитектор) |

---

## 12. Проверка готовности

> Чек-лист «Done». Сервис считается готовым, когда ВСЕ пункты ✅.

- [ ] Все функциональные требования (FR-1 — FR-22) реализованы
- [ ] Миграции БД написаны и применены
- [ ] Корзина в Redis работает с TTL
- [ ] Машина состояний заказов валидирует переходы
- [ ] Webhook handler ЮKassa обрабатывает success/failed, idempotent
- [ ] Интеграция с Product Service (stock check + reservation)
- [ ] Интеграция с Partner Service (promo code validation)
- [ ] Unit-тесты покрывают критичную логику (статусы, расчёты, webhook)
- [ ] Интеграционные тесты проходят (Redis, mock services)
- [ ] Dockerfile создан, сервис запускается в Docker Compose
- [ ] GraphQL-резолверы реализованы (Query + Mutation)
- [ ] Internal REST endpoints работают (`/internal/orders/*`)
- [ ] Webhook-эндпоинт `/internal/webhooks/yookassa` защищён верификацией подписи
- [ ] CorrelationId logging работает по всей цепочке запросов
- [ ] Health check endpoint реализует проверку Redis + PostgreSQL
- [ ] Секреты (ЮKassa API keys) не захардкожены, берутся из env
- [ ] Redis persistence (AOF) настроена

---

*Документ создан: 2026-05-27*
*Последнее обновление: 2026-05-27*
*Автор: Qwen Code (Бизнес-аналитик + Архитектор)*
