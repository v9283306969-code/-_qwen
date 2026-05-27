# SPEC-04: Frontend (Next.js 14 Website + PWA)

**Дата создания:** 2026-05-27
**Дата обновления:** 2026-05-27
**Статус:** draft
**Версия:** 1.0

---

## 1. Метаданные

| Поле | Значение |
|---|---|
| **ID** | SPEC-04 |
| **Название** | Frontend (Next.js 14 Website + PWA) |
| **Тип** | frontend application |
| **Стек** | Next.js 14 (App Router, RSC), React 18, TypeScript, TailwindCSS, Zustand, Apollo Client, next-pwa |
| **Зависит от** | SPEC-01 (Product API), SPEC-02 (Order API), SPEC-03 (Partner API) — все через GraphQL Gateway |
| **Блокирует** | Этап 4 (Админка), Этап 5 (Тестирование и запуск) |
| **Роль QWEN** | Фронтенд-разработчик |
| **Промт** | `templates/frontend-dev.md` |

---

## 2. Бизнес-контекст

### Назначение приложения

Основная витрина магазина: каталог товаров (косметика + БАДы), корзина, оформление заказа, аутентификация, личный кабинет с отображением партнёрской сети, бонусов, рангов. Также PWA-функциональность — возможность работы офлайн (каталог кэшируется), push-уведомления о статусе заказа, установке в домашний экран мобильного устройства.

### Пользователи приложения

| Кто | Что делает |
|---|---|
| Гость | Просмотр каталога, фильтрация, просмотр карточки товара, регистрация |
| Покупатель (3 ур.) | Корзина, checkout, просмотр заказов, применение промокода, личный профиль |
| Реализатор (2 ур.) | Всё что покупатель + просмотр своей сети, бонусов, ранга, своего промокода |
| Агент (1 ур.) | Всё что реализатор + просмотр всей сети (дерево), лидерборд, аналитика по сети |
| Администратор | Через Refine-админку (отдельное приложение, SPEC-06) |

### Связь с бизнес-моделью

Платформа MLM с тремя уровнями участников. Фронтенд должен визуализировать партнёрскую сеть, ранги, бонусы, лидерборды. Mobile-first подход: 90% трафика — мобильные устройства. PWA вместо нативного приложения для минимизации трения при регистрации. (`docs/business-models/multi-level-ecommerce.md`)

---

## 3. Архитектурные решения

### Тип приложения

Next.js 14 с App Router. React Server Components по умолчанию, Client Components — только для интерактивности (корзина, фильтры, формы). Статические страницы для SEO, ISR/SSR для динамических данных.

### Принятые решения

| Решение | Почему | Альтернативы (отклонены) |
|---|---|---|
| Next.js 14 App Router + RSC | SSR/ISR из коробки, серверные компоненты снижают JS-бандл, хорошая SEO-оптимизация | SPA (Vite + React) → хуже SEO, больше бандл, нужен отдельный SSR |
| Apollo Client (GraphQL) | Все бэкенд-сервисы отдают GraphQL через Gateway. Apollo даёт кэширование, optimistic updates, единый endpoint | Fetch/REST → несколько endpoints, нет встроенного кэша, больше boilerplate |
| Zustand | Минималистичный, без boilerplate Redux. Для корзины (гость + авторизованный) — идеален | Redux Toolkit → слишком много boilerplate, Zustand — 1KB |
| React Query (отклонён) | Apollo Client уже имеет кэш — не нужен второй слой кэширования | React Query дублировал бы Apollo кэш |
| TailwindCSS | Быстрая стилизация, utility-first подход хорош для responsive, small bundle после purge | CSS Modules / Styled Components → больше CSS-файлов, сложнее responsive |
| next-pwa | Конфигурация Service Worker + manifest.json через next.config.js, минимум кода | Ручной Service Worker → больше кода, сложнее обновления |
| i18n: только русский (MVP) | Целевой рынок — РФ. i18n архитектура заложена, но переводы только RU | Мультиязычность → замедляет MVP, переводы только после валидации рынка |
| Корзина в Zustand синхр. с GraphQL | Zustand хранит локальную корзину (включая гостей). При авторизации — синхронизация с сервером | Только server-side корзина → гости не могут добавить товары |

### Зависимости

| Зависимость | Тип | Назначение |
|---|---|---|
| GraphQL Gateway | Backend endpoint | Единый GraphQL endpoint (`/api/graphql`), объединяет SPEC-01, SPEC-02, SPEC-03 |
| SPEC-01 (Product Service) | Данные | Каталог, категории, цены, остатки, медиа |
| SPEC-02 (Order Service) | Данные | Корзина, заказы, оплата, статусы |
| SPEC-03 (Partner Service) | Данные | Пользователи, промокоды, сеть, бонусы, ранги |
| Strapi CMS | Медиа | Изображения товаров (CDN URL) |

### Архитектура приложения

```
┌─────────────────────────────────────────────────────┐
│                   Next.js 14 App                    │
├─────────────────────────────────────────────────────┤
│  Pages (App Router)                                 │
│  ├── / (Home)          ← SSG                        │
│  ├── /products         ← ISR (revalidate: 60)       │
│  ├── /products/[id]    ← ISR (revalidate: 60)       │
│  ├── /cart             ← Client Component           │
│  ├── /checkout         ← Client + Auth              │
│  ├── /auth/login       ← Client                     │
│  ├── /auth/register    ← Client                     │
│  ├── /account/*        ← Client + Auth              │
│  └── /leaderboard      ← SSR                        │
├─────────────────────────────────────────────────────┤
│  Components Layer                                   │
│  ├── Header, Footer, MobileBottomNav                │
│  ├── ProductCard, ProductGallery, FilterSidebar     │
│  ├── CartDrawer, CartItem, PromoCodeInput           │
│  ├── NetworkTree, RankProgress, Leaderboard         │
│  └── Skeleton, Error, EmptyState                    │
├─────────────────────────────────────────────────────┤
│  State Layer                                        │
│  ├── Zustand: cartStore (local + sync)             │
│  ├── Zustand: authStore (JWT + session)             │
│  └── Zustand: uiStore (modals, drawer, toasts)      │
├─────────────────────────────────────────────────────┤
│  Data Layer                                         │
│  ├── Apollo Client (GraphQL queries/mutations)      │
│  ├── GraphQL fragments + generated types            │
│  └── next-pwa (Service Worker + offline cache)      │
└─────────────────────────────────────────────────────┘
```

---

## 4. Структура проекта

```
app/
├── layout.tsx                          # Root layout: fonts, global styles, Apollo/Providers
├── page.tsx                            # Home (SSG)
├── not-found.tsx                       # 404 страница
├── error.tsx                           # Global error boundary
│
├── products/
│   ├── page.tsx                        # Каталог (ISR, revalidate: 60)
│   ├── layout.tsx                      # Layout: Header + FilterSidebar
│   └── [id]/
│       └── page.tsx                    # Карточка товара (ISR, revalidate: 60)
│
├── cart/
│   └── page.tsx                        # Корзина (Client Component)
│
├── checkout/
│   └── page.tsx                        # Оформление заказа (Client + Auth guard)
│
├── auth/
│   ├── login/
│   │   └── page.tsx                    # Вход (Client)
│   └── register/
│       └── page.tsx                    # Регистрация с промокодом (Client)
│
├── account/
│   ├── layout.tsx                      # Auth-guard wrapper
│   ├── page.tsx                        # Профиль (dashboard)
│   ├── orders/
│   │   └── page.tsx                    # История заказов
│   ├── bonuses/
│   │   └── page.tsx                    # Бонусы + история транзакций
│   ├── network/
│   │   └── page.tsx                    # Просмотр партнёрской сети
│   ├── settings/
│   │   └── page.tsx                    # Настройки профиля
│   └── referrals/
│       └── page.tsx                    # Промокод пользователя + QR
│
├── leaderboard/
│   └── page.tsx                        # Лидерборд (SSR)
│
├── api/
│   └── revalidate/
│       └── route.ts                    # On-demand ISR revalidate (webhook)
│
components/
├── layout/
│   ├── Header.tsx                      # Лого, навигация, иконка корзины, аватар
│   ├── Footer.tsx                      # Ссылки, контакты, соцсети
│   ├── MobileBottomNav.tsx             # Мобильная нижняя навигация (4-5 кнопок)
│   ├── CartDrawer.tsx                  # Выдвижная панель корзины (slide-over)
│   └── Container.tsx                   # Layout wrapper с max-width
│
├── catalog/
│   ├── ProductCard.tsx                 # Карточка товара (изображение, название, цена, old_price)
│   ├── ProductCardSkeleton.tsx         # Skeleton для ProductCard
│   ├── ProductGallery.tsx              # Галерея изображений (свайп на мобилке)
│   ├── FilterSidebar.tsx               # Фильтры: категория, цена, наличие, ранг
│   ├── SortSelector.tsx                # Сортировка (цена, название, рейтинг)
│   ├── PaginationControls.tsx          # Пагинация / "Load more"
│   └── CategoryBreadcrumbs.tsx         # Хлебные крошки категорий
│
├── product/
│   ├── ProductDetail.tsx               # Детальная информация: описание, состав
│   ├── PriceBlock.tsx                  # Блок цены (текущая, старая, скидка %)
│   ├── AddToCartButton.tsx             # Кнопка "В корзину" + quantity selector
│   ├── StockIndicator.tsx              # Индикатор наличия ("В наличии", "Мало", "Нет")
│   └── RelatedProducts.tsx             # Блок "Похожие товары"
│
├── cart/
│   ├── CartPage.tsx                    # Полная страница корзины
│   ├── CartItem.tsx                    # Позиция корзины (+/-quantity, remove)
│   ├── CartSummary.tsx                 # Итого: сумма, скидка, итого к оплате
│   └── CartEmpty.tsx                   # Empty state корзины
│
├── checkout/
│   ├── CheckoutForm.tsx               # Форма: адрес доставки, контакты
│   ├── PromoCodeInput.tsx              # Ввод промокода с валидацией
│   ├── OrderReview.tsx                 # Ревью заказа перед оплатой
│   └── PaymentRedirect.tsx             # Перенаправление на оплату (ЮKassa)
│
├── auth/
│   ├── LoginForm.tsx                   # Форма входа (email + пароль)
│   ├── RegisterForm.tsx                # Форма регистрации (email, телефон, пароль, промокод)
│   └── AuthGuard.tsx                   # HOC/Wrapper — редирект на /auth/login если нет токена
│
├── account/
│   ├── ProfileCard.tsx                 # Карточка профиля: email, ранг, баланс
│   ├── RankProgress.tsx                # Прогресс-бар до следующего ранга
│   ├── OrderHistory.tsx                # Список заказов со статусами
│   ├── BonusHistory.tsx                # Таблица бонусных транзакций
│   ├── NetworkTree.tsx                 # Визуальное дерево партнёрской сети
│   └── ReferralCard.tsx                # Промокод + QR-код для шаринга
│
├── leaderboard/
│   ├── LeaderboardTable.tsx            # Таблица лидеров (топ за месяц)
│   └── LeaderboardCard.tsx             # Карточка лидера (для мобилки)
│
└── ui/
    ├── Button.tsx                       # Переиспользуемая кнопка (variants)
    ├── Input.tsx                        # Текстовый input
    ├── Select.tsx                       # Выпадающий список
    ├── Badge.tsx                        # Бейдж (статус, ранг, скидка)
    ├── Skeleton.tsx                     # Skeleton-загрузка
    ├── Toast.tsx                        # Всплывающие уведомления
    ├── Modal.tsx                        # Модальное окно
    ├── EmptyState.tsx                   # Universal empty state
    └── Spinner.tsx                      # Спиннер загрузки

lib/
├── graphql/
│   ├── client.ts                       # Apollo Client инициализация
│   ├── provider.tsx                    # ApolloProvider wrapper
│   ├── queries/                        # GraphQL queries
│   │   ├── products.graphql            # catalog, product detail, categories
│   │   ├── orders.graphql              # cart, orders, checkout
│   │   └── partner.graphql             # profile, network, bonuses, leaderboard
│   ├── mutations/
│   │   ├── cart.graphql                # addToCart, removeFromCart, updateQuantity
│   │   ├── auth.graphql                # login, register
│   │   └── order.graphql               # checkout, applyPromoCode
│   ├── fragments/
│   │   ├── product.graphql             # ProductFragment
│   │   └── cart.graphql                # CartFragment
│   └── generated/
│       └── graphql.ts                  # Автогенерация типов (@graphql-codegen)
│
├── stores/
│   ├── cartStore.ts                    # Zustand: корзина (items, totals, guest sync)
│   ├── authStore.ts                    # Zustand: auth (token, user, session)
│   └── uiStore.ts                      # Zustand: UI (drawer open, toasts, modals)
│
├── hooks/
│   ├── useCart.ts                      # Хук корзины (обёртка cartStore + Apollo)
│   ├── useAuth.ts                      # Хук авторизации
│   ├── useProductFilters.ts            # Хук фильтров (URL sync)
│   └── useMediaQuery.ts                # Хук media query (responsive)
│
├── utils/
│   ├── format.ts                       # Форматирование: цены, даты, телефонов
│   ├── validation.ts                   # Zod-схемы валидации форм
│   └── constants.ts                    # Константы: API_URL, PAGINATION_LIMIT
│
├── types/
│   └── index.ts                        # Shared TypeScript типы
│
├── i18n/
│   └── ru.ts                           # Строки на русском (MVP: только RU)
│
└── middleware.ts                       # Next.js middleware: JWT refresh, route guards

public/
├── manifest.json                       # PWA manifest
├── sw.js                               # Service Worker (генерируется next-pwa)
├── icons/
│   ├── icon-192x192.png
│   ├── icon-512x512.png
│   └── favicon.ico
├── og-image.jpg                        # OpenGraph default image
└── logo.svg                            # Логотип

styles/
└── globals.css                         # TailwindCSS + custom utilities

next.config.js                          # Next.js config (PWA, ISR, images)
tailwind.config.ts                      # Tailwind конфигурация
tsconfig.json                           # TypeScript config
package.json                            # Зависимости
```

---

## 5. Страницы

### 5.1. Главная — `/`

| Параметр | Значение |
|---|---|
| **Рендеринг** | SSG (статическая) |
| **Данные** | Категории (из Product Service), featured-товары (кэш) |
| **SEO** | `<title>` "Мульти-маркет косметики и БАДов", `<meta description>` |

**Секции страницы:**
1. Hero-баннер (изображение + CTA "Смотреть каталог")
2. Блок категорий (2 карточки: "Косметика", "БАДы")
3. Featured-товары (слайдер 4–6 товаров)
4. "Как это работает" (3 шага: регистрация → промокод → бонусы)
5. CTA "Стать партнёром"

---

### 5.2. Каталог товаров — `/products`

| Параметр | Значение |
|---|---|
| **Рендеринг** | ISR (`revalidate: 60`) |
| **Данные** | Список товаров (products query), категории, фильтры |
| **SEO** | `<title>` "Каталог товаров — {category}", динамический description |

**Функциональность:**
- Список товаров (ProductCard) — grid 2 cols (mobile) / 4 cols (desktop)
- FilterSidebar (мобилка = drawer, десктоп = sidebar слева)
- Фильтры: категория, диапазон цен, наличие, ранг товара
- Сортировка: по цене (↑↓), по названию, по популярности
- Пагинация: "Load more" кнопка (mobile) / numbered (desktop)
- Пустое состояние: "Товары не найдены" с предложением сбросить фильтры

**Данные (ISR):**
```typescript
export const revalidate = 60; // ISR: перебилдить каждые 60 секунд

// Server Component — загрузка через Apollo Client (или прямой fetch к Gateway)
```

---

### 5.3. Карточка товара — `/products/[id]`

| Параметр | Значение |
|---|---|
| **Рендеринг** | ISR (`revalidate: 60`) |
| **Данные** | Продукт, цена, наличие, медиа, похожие товары |
| **SEO** | `<title>` "{product.name}", OG:Image, Structured Data (Product schema.org) |

**Блоки страницы:**
1. ProductGallery (свайп-слайдер на мобилке)
2. ProductDetail (название, описание, состав, применение)
3. PriceBlock (текущая цена, old_price, badge скидки %)
4. StockIndicator ("В наличии: {qty}", "Осталось мало", "Нет в наличии")
5. AddToCartButton (quantity selector: -/+, max = stock)
6. RelatedProducts (горизонтальный скролл, 4 товара)

**Schema.org (JSON-LD):**
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{product.name}",
  "image": "{product.media[0].url}",
  "description": "{product.description}",
  "brand": { "@type": "Brand", "name": "Наш Бренд" },
  "offers": {
    "@type": "Offer",
    "price": "{price.price}",
    "priceCurrency": "RUB",
    "availability": "{stock > 0 ? 'InStock' : 'OutOfStock'}"
  }
}
```

---

### 5.4. Корзина — `/cart`

| Параметр | Значение |
|---|---|
| **Рендеринг** | Client Component |
| **Данные** | Zustand cartStore (гость) / Apollo (авторизованный) |
| **SEO** | `<title>` "Корзина" (без индексации: `<meta name="robots" content="noindex">`) |

**Состояния:**
- **Пустая:** CartEmpty с CTA "Перейти в каталог"
- **Заполненная:** CartItem × N, CartSummary, CTA "Оформить заказ"
- **CartDrawer:** доступен из любой страницы через Header

**Синхронизация корзины:**
```
Гость: Zustand (localStorage) → persisted
После логина: Zustand items → merge с server cart (GraphQL sync)
При конфликте: server-side wins (данные свежее)
```

---

### 5.5. Оформление заказа — `/checkout`

| Параметр | Значение |
|---|---|
| **Рендеринг** | Client Component |
| **Auth** | Required (AuthGuard) |
| **SEO** | noindex |

**Шаги (stepper на мобилке):**
1. Адрес доставки (город, улица, дом, квартира, индекс)
2. Применение промокода (PromoCodeInput с валидацией)
3. Ревью заказа (товары, итого, скидка, итого к оплате)
4. Подтверждение → redirect на ЮKassa paymentUrl

**Валидация:**
- Все поля адреса обязательны (Zod-схема)
- Промокод: debounce 400ms → query validate → badge success/error
- Корзина не пуста (redirect на /cart если пуста)

---

### 5.6. Аутентификация — `/auth/*`

| Страница | Метод | Описание |
|---|---|---|
| `/auth/login` | POST → Partner Service | Email + пароль → JWT (access + refresh) |
| `/auth/register` | POST → Partner Service | Email, телефон, пароль, промокод (опционально) → JWT |

**LoginForm:**
- Email, Password
- "Забыли пароль?" (future)
- Ссылка "Регистрация"

**RegisterForm:**
- Email, Phone (опционально), Password, ConfirmPassword
- PromoCode (опционально — если перешёл по ссылке/QR агента)
- Checkbox: согласие с офертой (обязательно)
- Ссылка "Уже есть аккаунт?"

**JWT handling:**
- Access token: httponly cookie or localStorage (MVP: localStorage)
- Refresh token: localStorage, TTL 30 дней
- Middleware: проверка токена → refresh при 401

---

### 5.7. Личный кабинет — `/account/*`

| Страница | Auth | Описание |
|---|---|---|
| `/account` | Required | Dashboard: ранг, баланс бонусов, промокод, быстрые ссылки |
| `/account/orders` | Required | История заказов (OrderHistory), статусы, детали |
| `/account/bonuses` | Required | Баланс + таблица транзакций (BonusHistory), фильтры по статусу |
| `/account/network` | Required | Партнёрская сеть (NetworkTree), статистика |
| `/account/settings` | Required | Настройки профиля: email, телефон, пароль |
| `/account/referrals` | Required | Свой промокод, QR-код, ссылка для шаринга, копирование |

**ProfileCard (dashboard):**
```
┌─────────────────────────────────┐
│ Ранг: Серебро (1.5×)            │
│ ████████████░░░░░  7/10 до Золото│
│ Баланс: 1 250₽                  │
│ Ваш промокод: AGENT-ABC123       │
│ [Копировать] [QR-код]           │
└─────────────────────────────────┘
```

---

### 5.8. Лидерборд — `/leaderboard`

| Параметр | Значение |
|---|---|
| **Рендеринг** | SSR (данные меняются часто) |
| **Данные** | Топ агентов + топ реализаторов (Partner Service) |
| **SEO** | `<title>` "Топ партнёров" |

**Отображение:**
- LeaderboardTable (desktop): #, Имя, Ранг, Продажи, Оборот
- LeaderboardCard (mobile): аватар, имя, ранг-badge, сумма
- Переключатель: "Агенты" / "Реализаторы"
- Период: "Этот месяц" / "Всё время"

---

## 6. PWA

### 6.1. manifest.json

```json
{
  "name": "Мульти-Маркет",
  "short_name": "ММ-Маркет",
  "description": "Интернет-магазин косметики и БАДов с партнёрской программой",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4F46E5",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

### 6.2. Service Worker (next-pwa)

**Конфигурация `next.config.js`:**
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/api\..*\//i,
      handler: 'NetworkFirst',
      options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } }
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/,
      handler: 'CacheFirst',
      options: { cacheName: 'images-cache', expiration: { maxEntries: 100, maxAgeSeconds: 2592000 } }
    },
    {
      urlPattern: /^https:\/\/.*\.strapi.*\//i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'strapi-cache', expiration: { maxEntries: 50, maxAgeSeconds: 86400 } }
    }
  ]
});

module.exports = withPWA(nextConfig);
```

### 6.3. Offline-функциональность

| Сценарий | Поведение |
|---|---|
| Каталог загружен ранее | Показ кэшированные товары из SW cache |
| Карточка товара загружена ранее | Показ кэшированную страницу с данными |
| Нет кэша + нет сети | Страница-заглушка: "Нет подключения. Проверьте интернет." |
| Добавление в корзину офлайн | Сохранение в Zustand (localStorage) → отправка при восстановлении сети |
| Checkout офлайн | Блокировка: "Для оформления нужен интернет" |

### 6.4. Push-уведомления

| Событие | Когда отправляется |
|---|---|
| Заказ оплачен | Webhook ЮKassa → notification → Push |
| Заказ отправлен | Admin меняет статус на "shipped" |
| Бонус начислен | Partner Service начислил бонус |
| Ранг изменён | Фоновый пересчёт рангов |

**Реализация:**
- Запрос разрешения при первом входе в `/account`
- Сохранение subscription в Partner Service (POST /internal/push/subscribe)
- Service Worker `push` event → показать Notification

---

## 7. Компоненты

### 7.1. Header

**Пропсы:**
```typescript
interface HeaderProps {
  cartItemCount: number;
  isAuthenticated: boolean;
  user?: { name: string; rank: string };
}
```

**Состав:**
- Логотип (ссылка на `/`)
- Десктоп: горизонтальная навигация (Каталог, О нас, Лидерборд)
- Иконка корзины (badge с количеством, открывает CartDrawer)
- Мобилка: Hamburger menu → drawer с навигацией
- Аватар пользователя (ссылка на `/account`)

**Поведение:**
- Sticky top (`position: sticky, top: 0, z-index: 50`)
- Прозрачный на `page.tsx` hero, с фоном при скролле

---

### 7.2. ProductCard

**Пропсы:**
```typescript
interface ProductCardProps {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  oldPrice?: number;       // для скидки
  currency: string;        // "RUB"
  inStock: boolean;
  categorySlug: string;
}
```

**Дизайн:**
- Изображение (aspect-ratio 1:1, object-cover)
- Название (truncate 2 lines)
- Цена (bold) + oldPrice (strikethrough, красный)
- Badge скидки (%) в углу изображения
- Link на `/products/[id]`

---

### 7.3. CartDrawer

**Пропсы:**
```typescript
interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Состав:**
- Slide-over справа (320px mobile / 420px desktop)
- Список CartItem (до 3 видны, остальные scroll)
- CartSummary внизу (sticky bottom)
- Кнопка "Оформить заказ" → `/checkout`
- Overlay (click → close, ESC → close)

---

### 7.4. FilterSidebar

**Пропсы:**
```typescript
interface FilterSidebarProps {
  categories: Category[];
  priceRange: [number, number];
  currentFilters: ProductFilters;
  onFilterChange: (filters: ProductFilters) => void;
  isMobile: boolean;          // true → drawer, false → sidebar
}

interface ProductFilters {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'name' | 'popular';
}
```

**Поведение:**
- Десктоп: фиксированная боковая панель слева
- Мобилка: Drawer (открывается по кнопке "Фильтры")
- Счётчик активных фильтров на кнопке
- Кнопка "Сбросить все"

---

### 7.5. PromoCodeInput

**Пропсы:**
```typescript
interface PromoCodeInputProps {
  onApply: (code: string) => Promise<PromoCodeResult>;
  onRemove: () => void;
  appliedDiscount?: { amount: number; percentage: number };
}
```

**Состояния:**
- **Дефолт:** input + кнопка "Применить"
- **Загрузка:** input disabled, spinner
- **Успех:** badge "Скидка {X}%", кнопка "Удалить"
- **Ошибка:** input с красной рамкой, текст "Промокод не найден"

**Логика:**
- Debounce 400ms перед запросом
- GraphQL mutation `applyPromoCode(code: String!)`

---

### 7.6. NetworkTree

**Пропсы:**
```typescript
interface NetworkTreeProps {
  userId: string;            // ID пользователя (своя сеть)
  maxDepth?: number;         // максимальная глубина отображения (default: 3)
  compact?: boolean;         // compact mode для мобилок
}
```

**Визуализация:**
- Десктоп: горизонтальное дерево (CSS flex + SVG линии)
- Мобилка: вертикальный аккордеон (раскрытие по уровням)
- Каждый узел: аватар, имя, уровень, ранг-badge
- Цвета: 1 ур. (агент) = зелёный, 2 ур. (реализатор) = синий, 3 ур. (покупатель) = серый
- Клик → popup с деталями пользователя

**Ограничение:** При >50 узлах — "Показать ещё" (lazy load)

---

### 7.7. RankProgress

**Пропсы:**
```typescript
interface RankProgressProps {
  currentRank: 'start' | 'bronze' | 'silver' | 'gold';
  currentName: string;       // "Серебро"
  nextRank: 'bronze' | 'silver' | 'gold' | 'max';
  nextName: string;          // "Золото"
  progress: number;          // 0–100 (процент до следующего ранга)
  metrics: {
    current: { directDownlines: number; networkSales: number };
    required: { directDownlines: number; networkSales: number };
  };
}
```

**Дизайн:**
- Прогресс-бар (цвет зависит от ранга)
- Текст: "7 из 10 активных реализаторов"
- Текст: "500 из 2000 продаж сети"
- Badge ранга с иконкой
- Если max rank: "Вы достигли максимального ранга! 🏆"

---

### 7.8. MobileBottomNav

**Пропсы:**
```typescript
interface MobileBottomNavProps {
  activePath: string;        // текущий path
}
```

**Кнопки (4):**
1. 🏠 Главная (`/`)
2. 🔍 Каталог (`/products`)
3. 🛒 Корзина (`/cart`) — badge с количеством
4. 👤 Профиль (`/account`) — если авторизован, иначе `/auth/login`

**Поведение:**
- Фиксирован внизу (`position: fixed, bottom: 0, z-index: 40`)
- Высота: 56px
- Активная иконка подсвечена (primary color)
- Показывается только на `max-width: 768px`

---

## 8. State Management (Zustand)

### 8.1. cartStore

```typescript
interface CartItem {
  productId: string;
  quantity: number;
  name: string;
  price: number;
  imageUrl: string;
}

interface CartState {
  items: CartItem[];
  isLoading: boolean;

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;

  // Computed
  totalItems: number;
  totalPrice: number;

  // Sync (для авторизованных)
  syncWithServer: () => Promise<void>;    // upload local → merge with server
  loadFromServer: () => Promise<void>;    // загрузить server cart
}
```

**Persist:** `create(persist(...))` → localStorage, key: `ml-ecommerce-cart`

**Sync-логика:**
```
При login:
  1. loadFromServer() → получить server cart
  2. local items + server items → merge (сложить quantities)
  3. upload merged → server

При logout:
  clearCart() → Zustand очищен
```

### 8.2. authStore

```typescript
interface User {
  id: string;
  email: string;
  phone?: string;
  level: number;         // 1=агент, 2=реализатор, 3=покупатель
  rank: string;
  rankMultiplier: number;
  balance: number;
  ownPromoCode: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
}
```

**Tokens:** localStorage (MVP). В продакшене → httponly cookies.

### 8.3. uiStore

```typescript
interface UiState {
  cartDrawerOpen: boolean;
  mobileMenuOpen: boolean;
  filterDrawerOpen: boolean;
  toasts: Array<{ id: string; type: 'success'|'error'|'info'; message: string }>;

  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  toggleMobileMenu: () => void;
  openFilterDrawer: () => void;
  closeFilterDrawer: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}
```

---

## 9. GraphQL (Apollo Client)

### 9.1. Конфигурация клиента

```typescript
// lib/graphql/client.ts
import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: { ...headers, Authorization: token ? `Bearer ${token}` : '' },
  };
});

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (networkError) console.error(`[Network error]: ${networkError}`);
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      console.error(`[GraphQL error]: ${err.message}`, err.path);
    }
    // 401 → попытка refresh
    if (graphQLErrors.some(e => e.extensions?.code === 'UNAUTHENTICATED')) {
      // trigger refresh token logic
    }
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          products: {
            keyArgs: ['category', 'sortBy'],
            merge(existing, incoming) {
              return { ...existing, ...incoming };
            },
          },
        },
      },
      CartItem: { keyFields: ['productId'] },
    },
  }),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network', errorPolicy: 'all' },
    query: { fetchPolicy: 'cache-first', errorPolicy: 'all' },
    mutate: { errorPolicy: 'all' },
  },
});
```

### 9.2. Основные Queries

**Каталог:**
```graphql
query GetProducts($category: String, $cursor: String, $limit: Int!, $sortBy: ProductSort, $filters: ProductFilters) {
  products(category: $category, cursor: $cursor, limit: $limit, sortBy: $sortBy, filters: $filters) {
    items {
      ...ProductFragment
    }
    hasMore
    nextCursor
  }
  categories {
    id
    name
    slug
  }
}
```

**Продукт:**
```graphql
query GetProduct($id: ID!) {
  product(id: $id) {
    ...ProductFragment
    description
    media { url, altText, isPrimary }
    stock { quantity, reserved }
  }
}
```

**Корзина и заказы:**
```graphql
query GetMe {
  me {
    id
    email
    level
    rank { name, displayName, multiplier }
    balance
    ownPromoCode { code, qrCodeUrl, isActive }
    cart {
      items { productId, quantity, unitPrice }
    }
    orders {
      id
      status
      totalAmount
      finalAmount
      createdAt
      items { productId, quantity, unitPrice, totalPrice }
    }
  }
}
```

**Партнёрская сеть:**
```graphql
query GetNetwork($userId: ID!) {
  network(userId: $userId) {
    totalDownlines
    totalSales
    statsByLevel { level, count, revenue }
    tree { id, name, level, rank, downlines { ... } }
  }
}

query GetBonuses($userId: ID!, $status: String) {
  bonuses(userId: $userId, status: $status) {
    id
    amount
    percentage
    type
    status
    holdUntil
    orderId
  }
}
```

**Лидерборд:**
```graphql
query GetLeaderboard($period: LeaderboardPeriod!, $level: Int) {
  leaderboard(period: $period, level: $level) {
    rank
    userId
    name
    displayName
    rankName
    salesCount
    revenue
  }
}
```

### 9.3. Основные Mutations

**Корзина (optimistic updates):**
```graphql
mutation AddToCart($productId: ID!, $quantity: Int!) {
  addToCart(productId: $productId, quantity: $quantity) {
    success
    error
  }
}
# Optimistic response: добавить item в кэш Cart локально

mutation RemoveFromCart($productId: ID!) {
  removeFromCart(productId: $productId) {
    success
    error
  }
}
# Optimistic response: удалить item из кэша
```

**Автентификация:**
```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    accessToken
    refreshToken
    user { id, email, level, rank { name }, balance, ownPromoCode { code } }
  }
}

mutation Register($input: RegisterInput!) {
  register(input: $input) {
    accessToken
    refreshToken
    user { id, email, level }
  }
}
```

**Checkout:**
```graphql
mutation Checkout($input: CheckoutInput!) {
  checkout(input: $input) {
    orderId
    finalAmount
    paymentUrl
  }
}

mutation ApplyPromoCode($code: String!) {
  applyPromoCode(code: $code) {
    valid
    discountAmount
    discountPercentage
    error
  }
}
```

---

## 10. SEO

### 10.1. Meta-теги

| Страница | Title | Description |
|---|---|---|
| `/` | "Мульти-Маркет — косметика и БАДы с партнёрской программой" | "Интернет-магазин натуральной косметики и БАДов. Покупайте по промокоду и получайте бонусы. Станьте партнёром!" |
| `/products` | "Каталог товаров — Мульти-Маркет" | "Косметика и БАДы от проверенных производителей. Доставка по России." |
| `/products/[id]` | "{product.name} — Мульти-Маркет" | "{product.description.substring(0, 150)}..." |
| `/auth/login` | "Вход — Мульти-Маркет" | — |
| `/leaderboard` | "Топ партнёров — Мульти-Маркет" | "Лучшие агенты и реализаторы нашего проекта." |

### 10.2. OpenGraph

**Настройка (в root layout):**
```typescript
export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'Мульти-Маркет',
    images: ['/og-image.jpg'],
  },
};
```

**Для продукта (динамический OG):**
```typescript
// В /products/[id]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const product = await getProduct(params.id);
  return {
    title: `${product.name} — Мульти-Маркет`,
    openGraph: {
      images: [{ url: product.media?.[0]?.url || '/og-image.jpg', width: 1200, height: 630 }],
    },
  };
}
```

### 10.3. Sitemap и Robots

**`sitemap.xml` (generateSitemaps):**
```typescript
// app/sitemap.ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getAllProductsSlugs();
  const productUrls = products.map(p => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/leaderboard`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    ...productUrls,
  ];
}
```

**`robots.txt`:**
```
User-agent: *
Allow: /
Disallow: /auth/
Disallow: /account/
Disallow: /cart/
Disallow: /checkout/
Sitemap: https://example.com/sitemap.xml
```

---

## 11. Производительность

### 11.1. ISR (Incremental Static Regeneration)

| Страница | Стратегия | Revalidate | Почему |
|---|---|---|---|
| `/` | SSG | — | Статический контент, кэш категорий |
| `/products` | ISR | 60 сек | Каталог меняется (остатки, цены), но не критично |
| `/products/[id]` | ISR | 60 сек | Карточка товара, кэш снижает нагрузку |
| `/leaderboard` | SSR | — | Данные меняются часто, кэш не имеет смысла |
| `/account/*` | Client | — | Только для авторизованных, SSR бесполезен |

**On-demand revalidation:**
```typescript
// app/api/revalidate/route.ts
export async function POST(request: Request) {
  const { secret, path } = await request.json();
  if (secret !== process.env.REVALIDATE_SECRET) return new Response('Unauthorized', { status: 401 });
  await revalidatePath(path);
  return Response.json({ revalidated: true, path });
}
// Вызывается при изменении товара/цены/остатков на бэкенде
```

### 11.2. Оптимизация изображений

**`next.config.js`:**
```javascript
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.strapi.example.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [320, 480, 768, 1024, 1280],
  },
};
```

**Применение:**
```tsx
<Image
  src={product.imageUrl}
  alt={product.name}
  width={400}
  height={400}
  sizes="(max-width: 768px) 50vw, 25vw"
  priority={isFeatured}  // LCP: только для hero/featured
  loading="lazy"          // По умолчанию для non-featured
/>
```

### 11.3. Lazy Loading

| Что | Как |
|---|---|
| Компоненты Below-the-fold | `next/dynamic` с `ssr: false` |
| NetworkTree | `const NetworkTree = dynamic(() => import('...'), { ssr: false, loading: () => <Skeleton/> })` |
| Изображения в списке | `loading="lazy"` (по умолчанию next/image) |
| Карточки товаров | Intersection Observer — рендер только в viewport |

### 11.4. Целевые метрики

| Метрика | Значение | Инструмент |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5 сек | Lighthouse, Web Vitals |
| FID (First Input Delay) | < 100ms | Web Vitals |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse |
| TTFB (Time to First Byte) | < 600ms (SSR) / < 50ms (cached ISR) | DevTools |
| Bundle size (initial JS) | < 200KB gzip | Webpack Bundle Analyzer |
| Lighthouse Performance | > 90 | Lighthouse CI |

---

## 12. Мобильная адаптация

### 12.1. Breakpoints (TailwindCSS)

| Breakpoint | Ширина | Целевое устройство |
|---|---|---|
| `sm` | 640px | Большие телефоны (landscape) |
| `md` | 768px | Планшеты |
| `lg` | 1024px | Маленькие ноутбуки |
| `xl` | 1280px | Десктоп |
| `2xl` | 1536px | Большие экраны |

### 12.2. Touch-friendly требования

| Элемент | Мин. размер | Примечание |
|---|---|---|
| Кнопки | 44×44px | Apple HIG recommendation |
| Ссылки в навигации | 44px высота | Достаточно места для пальца |
| Свайп в галерее | Full-width touch area | ProductGallery on mobile |
| Tap targets | 8px минимум между | Не перекрываются при нажатии |
| Input поля | 44px высота | Крупный cursor/фокус |

### 12.3. Mobile-first паттерны

| Паттерн | Desktop | Mobile |
|---|---|---|
| Навигация | Горизонтальная в Header | Hamburger menu (drawer) |
| Фильтры | Sidebar слева | Drawer по кнопке |
| Корзина | Страница /cart | Drawer + BottomNav |
| NetworkTree | Горизонтальное дерево | Вертикальный аккордеон |
| Лидерборд | Таблица | Карточки |
| Пагинация | Numbered page | "Load more" кнопка |

---

## 13. i18n (Интернационализация)

### 13.1. Текущее состояние

- **MVP:** только русский язык
- **Архитектура:** заложена подготовка к i18n

### 13.2. Подготовка

**Строки вынесены в `lib/i18n/ru.ts`:**
```typescript
// lib/i18n/ru.ts
export const ru = {
  common: {
    addToCart: 'В корзину',
    checkout: 'Оформить заказ',
    search: 'Поиск',
    filters: 'Фильтры',
    noResults: 'Ничего не найдено',
    loading: 'Загрузка...',
    error: 'Произошла ошибка',
  },
  product: {
    inStock: 'В наличии',
    lowStock: 'Осталось мало',
    outOfStock: 'Нет в наличии',
    related: 'Похожие товары',
  },
  cart: {
    empty: 'Корзина пуста',
    total: 'Итого',
    discount: 'Скидка',
    goToCheckout: 'Оформить заказ',
  },
  // ...и т.д.
};
```

**При переходе на мультиязычность:**
- Next.js i18n routing (`next.config.js` → `i18n: { locales: ['ru', 'en'], defaultLocale: 'ru' }`)
- Переключатель языка в Header
- Роуты: `/ru/products`, `/en/products`

---

## 14. Маршрутизация и Guards

### 14.1. Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_ROUTES = ['/account', '/checkout'];
const AUTH_ROUTES = ['/auth/login', '/auth/register'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value
    || request.nextUrl.searchParams.get('token');  // fallback

  const isProtected = PROTECTED_ROUTES.some(route =>
    request.nextUrl.pathname.startsWith(route)
  );
  const isAuthPage = AUTH_ROUTES.some(route =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Неавторизованный → redirect на /auth/login
  if (isProtected && !token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Авторизованный на auth-странице → redirect на /account
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/account', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/account/:path*', '/checkout/:path*', '/auth/:path*'],
};
```

### 14.2. AuthGuard (Client-side)

```tsx
// components/auth/AuthGuard.tsx
'use client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
```

---

## 15. Обработка ошибок

### 15.1. Глобальные ошибки

**`app/error.tsx` (Error Boundary):**
```tsx
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <h2 className="text-2xl font-bold">Что-то пошло не так</h2>
      <p className="text-gray-500">{error.message}</p>
      <button onClick={reset} className="btn btn-primary mt-4">Попробовать снова</button>
    </div>
  );
}
```

### 15.2. 404

**`app/not-found.tsx`:**
```tsx
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <h1 className="text-6xl font-bold text-gray-300">404</h1>
      <p className="text-xl">Страница не найдена</p>
      <Link href="/" className="btn btn-primary mt-4">На главную</Link>
    </div>
  );
}
```

### 15.3. GraphQL ошибки

| Код ошибки | Обработка | UI |
|---|---|---|
| `PRODUCT_NOT_FOUND` | redirect `/not-found` | 404 страница |
| `CART_EMPTY` | redirect `/cart` → показать CartEmpty | State корзины |
| `PROMO_CODE_INVALID` | Field error | Красное поле ввода + текст |
| `UNAUTHENTICATED` | redirect `/auth/login` | AuthGuard |
| Network error | Retry (Apollo retry-link) | Toast "Нет подключения" |
| Server error (5xx) | retry 3 раза → fallback | Fallback UI + toast |

---

## 16. Функциональные требования

| ID | Требование | Приоритет | Зависит от | Статус |
|---|---|---|---|---|
| FR-1 | Главная страница: hero, категории, featured-товары | must | SPEC-01 | pending |
| FR-2 | Каталог: список товаров, ISR, пагинация | must | SPEC-01 | pending |
| FR-3 | Фильтрация: по категории, цене, наличию | must | SPEC-01 | pending |
| FR-4 | Сортировка: цена, название, популярность | must | SPEC-01 | pending |
| FR-5 | Карточка товара: галерея, описание, цена, наличие, "В корзину" | must | SPEC-01 | pending |
| FR-6 | Корзина: добавление/удаление, изменение количества (Zustand) | must | SPEC-02 | pending |
| FR-7 | Сохранение корзины гостя в localStorage | must | — | pending |
| FR-8 | Синхронизация корзины при логине | must | FR-7, SPEC-02 | pending |
| FR-9 | CartDrawer: выдвижная корзина из любой страницы | should | FR-6 | pending |
| FR-10 | Checkout: форма адреса, промокод, ревью, оплата | must | SPEC-02, SPEC-03 | pending |
| FR-11 | Регистрация с промокодом | must | SPEC-03 | pending |
| FR-12 | Логин (email + пароль, JWT) | must | SPEC-03 | pending |
| FR-13 | Личный кабинет: профиль, ранг, баланс | must | SPEC-03 | pending |
| FR-14 | История заказов (список + детали) | must | SPEC-02 | pending |
| FR-15 | История бонусов (таблица транзакций) | must | SPEC-03 | pending |
| FR-16 | Визуализация партнёрской сети (NetworkTree) | must | SPEC-03 | pending |
| FR-17 | Промокод пользователя + QR-код (шаринг) | must | SPEC-03 | pending |
| FR-18 | RankProgress: прогресс до следующего ранга | should | SPEC-03 | pending |
| FR-19 | Лидерборд: топ агентов/реализаторов | should | SPEC-03 | pending |
| FR-20 | PWA: manifest.json + Service Worker (next-pwa) | must | — | pending |
| FR-21 | Offline: кэширование каталога | must | — | pending |
| FR-22 | Push-уведомления (заказы, бонусы, ранги) | should | — | pending |
| FR-23 | Mobile-first: responsive design, touch-friendly | must | — | pending |
| FR-24 | MobileBottomNav: нижняя навигация на мобилке | must | — | pending |
| FR-25 | SEO: meta-теги, OpenGraph, sitemap.xml, robots.txt | must | — | pending |
| FR-26 | Schema.org (Product JSON-LD) для карточек товаров | should | — | pending |
| FR-27 | ISR для каталога (revalidate: 60) | must | — | pending |
| FR-28 | i18n: подготовка (строки вынесены, только RU) | should | — | pending |
| FR-29 | Error boundary + not-found page | must | — | pending |
| FR-30 | Loading states: скелетоны, спиннеры | must | — | pending |

---

## 17. Нефункциональные требования

| Требование | Значение | Как проверяется |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5 сек | Lighthouse, Web Vitals |
| FID (First Input Delay) | < 100ms | Web Vitals report |
| CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse |
| Bundle size (initial JS) | < 200KB gzip | Webpack Bundle Analyzer |
| Lighthouse Performance score | > 90 | Lighthouse CI |
| Accessibility (a11y) | WCAG 2.1 AA | Lighthouse Accessibility |
| PWA installable | Lighthouse PWA audit = pass | Lighthouse |
| Offline catalog | Catalog доступен без сети (после 1 визита) | SW cache inspection |
| SSR/ISR TTFB | < 600ms (SSR) / < 50ms (ISR cache) | DevTools Network |
| SEO | Все страницы индексируются (кроме /auth, /account, /cart, /checkout) | Google Search Console |
| Touch targets | Минимум 44×44px | Manual QA на устройстве |
| Кросс-браузерность | Chrome, Safari, Firefox (последние 2 версии) | BrowserStack / manual |

---

## 18. Тесты

### 18.1. Unit-тесты (Jest + React Testing Library)

| Сценарий | Компонент | Вход | Ожидаемый результат |
|---|---|---|---|
| ProductCard отрисовка | ProductCard | { name: "Тест", price: 100, inStock: true } | Название, цена видны, "В наличии" |
| ProductCard со скидкой | ProductCard | { price: 100, oldPrice: 150 } | oldPrice зачёркнут, badge "-33%" |
| CartDrawer open/close | CartDrawer | isOpen: true → click overlay | Drawer виден → скрыт |
| PromoCodeInput success | PromoCodeInput | Apply → onApply resolves | Badge "Скидка 10%", кнопка "Удалить" |
| PromoCodeInput error | PromoCodeInput | Apply → onApply rejects | Красная рамка, "Промокод не найден" |
| RankProgress 70% | RankProgress | progress: 70 | Бар заполнен на 70%, текст "7/10" |
| FilterSidebar apply | FilterSidebar | Выбрать категорию → Apply | onFilterChange вызван с { categoryId: "x" } |
| MobileBottomNav active | MobileBottomNav | activePath: "/products" | Иконка "Каталог" подсвечена |

### 18.2. Integration-тесты

| Сценарий | Mock | Проверка |
|---|---|---|
| Каталог: загрузка товаров | Apollo mock (products query) | ProductCard × N, no skeleton |
| Каталог: фильтрация | Apollo mock (filtered products) | Фильтр применён, товаров меньше |
| Добавление в корзину | Apollo mock (addToCart) + Zustand | Cart count +1, toast "Добавлено" |
| Checkout: успешное оформление | Apollo mock (checkout mutation) | Redirect на paymentUrl ЮKassa |
| Checkout: промокод invalid | Apollo mock (applyPromoCode error) | Error message, заказ не создан |
| Логин: success | Apollo mock (login) | Redirect на /account, user в store |
| Логин: wrong password | Apollo mock (login error) | Error message "Неверный email или пароль" |
| Регистрация с промокодом | Apollo mock (register) | User создан, промокод применён |
| AuthGuard: без токена | — | Redirect на /auth/login |

### 18.3. E2E-тесты (Playwright)

| Сценарий | Шаги | Проверка |
|---|---|---|
| Полный путь покупателя | Главная → Каталог → Карточка → Корзина → Checkout | Заказ создан |
| Регистрация по промокоду | /auth/register → ввести промокод → "Стать агентом" | Пользователь в сети агента |
| PWA installability | Lighthouse → PWA audit | Pass |
| Offline catalog | Загрузить каталог → offline → обновить | Каталог виден (из кэша) |
| Mobile responsive | Viewport 375px → все страницы | Не ломается, touch-friendly |

---

## 19. Переменные окружения

| Переменная | Описание | Пример | Required |
|---|---|---|---|
| `NEXT_PUBLIC_GRAPHQL_URL` | URL GraphQL Gateway | `http://localhost:4000/graphql` | Да |
| `NEXT_PUBLIC_SITE_URL` | URL сайта (для sitemap, OG) | `https://example.com` | Да |
| `NEXT_PUBLIC_STRAPI_URL` | URL Strapi CMS (для изображений) | `https://strapi.example.com` | Да |
| `REVALIDATE_SECRET` | Secret для on-demand revalidate API | `random-string` | Да |
| `NODE_ENV` | Окружение | `development` / `production` | Да |
| `NEXT_PUBLIC_VERCEL_URL` | Vercel deployment URL (авто) | — | Нет (Vercel) |

---

## 20. Файлы проекта

| Файл | Назначение | Создан? |
|---|---|---|
| `frontend/package.json` | Зависимости, скрипты | [ ] |
| `frontend/next.config.js` | Next.js config (PWA, images, ISR) | [ ] |
| `frontend/tailwind.config.ts` | TailwindCSS (theme, breakpoints) | [ ] |
| `frontend/tsconfig.json` | TypeScript config (paths, strict) | [ ] |
| `frontend/app/layout.tsx` | Root layout (metadata, providers, fonts) | [ ] |
| `frontend/app/page.tsx` | Home page (SSG) | [ ] |
| `frontend/app/products/page.tsx` | Каталог (ISR) | [ ] |
| `frontend/app/products/[id]/page.tsx` | Карточка товара (ISR) | [ ] |
| `frontend/app/cart/page.tsx` | Корзина | [ ] |
| `frontend/app/checkout/page.tsx` | Оформление заказа (AuthGuard) | [ ] |
| `frontend/app/auth/login/page.tsx` | Вход | [ ] |
| `frontend/app/auth/register/page.tsx` | Регистрация | [ ] |
| `frontend/app/account/layout.tsx` | Account layout (AuthGuard) | [ ] |
| `frontend/app/account/page.tsx` | Dashboard | [ ] |
| `frontend/app/account/orders/page.tsx` | История заказов | [ ] |
| `frontend/app/account/bonuses/page.tsx` | Бонусы | [ ] |
| `frontend/app/account/network/page.tsx` | Партнёрская сеть | [ ] |
| `frontend/app/account/referrals/page.tsx` | Промокод + QR | [ ] |
| `frontend/app/account/settings/page.tsx` | Настройки | [ ] |
| `frontend/app/leaderboard/page.tsx` | Лидерборд (SSR) | [ ] |
| `frontend/app/not-found.tsx` | 404 страница | [ ] |
| `frontend/app/error.tsx` | Global error boundary | [ ] |
| `frontend/app/sitemap.ts` | Sitemap генерация | [ ] |
| `frontend/app/robots.ts` | Robots.txt генерация | [ ] |
| `frontend/app/api/revalidate/route.ts` | On-demand ISR revalidate | [ ] |
| `frontend/middleware.ts` | Next.js middleware (auth routes) | [ ] |
| `frontend/components/layout/Header.tsx` | Header | [ ] |
| `frontend/components/layout/Footer.tsx` | Footer | [ ] |
| `frontend/components/layout/MobileBottomNav.tsx` | Mobile bottom nav | [ ] |
| `frontend/components/layout/CartDrawer.tsx` | Cart drawer | [ ] |
| `frontend/components/catalog/ProductCard.tsx` | Product card | [ ] |
| `frontend/components/catalog/FilterSidebar.tsx` | Filter sidebar/drawer | [ ] |
| `frontend/components/product/ProductGallery.tsx` | Product image gallery | [ ] |
| `frontend/components/product/AddToCartButton.tsx` | Add to cart button | [ ] |
| `frontend/components/checkout/PromoCodeInput.tsx` | Promo code input | [ ] |
| `frontend/components/account/NetworkTree.tsx` | Network tree visualization | [ ] |
| `frontend/components/account/RankProgress.tsx` | Rank progress bar | [ ] |
| `frontend/components/ui/*` | UI primitives (Button, Input, etc.) | [ ] |
| `frontend/lib/graphql/client.ts` | Apollo Client setup | [ ] |
| `frontend/lib/graphql/provider.tsx` | ApolloProvider wrapper | [ ] |
| `frontend/lib/graphql/queries/*.graphql` | GraphQL queries | [ ] |
| `frontend/lib/graphql/mutations/*.graphql` | GraphQL mutations | [ ] |
| `frontend/lib/stores/cartStore.ts` | Zustand cart store | [ ] |
| `frontend/lib/stores/authStore.ts` | Zustand auth store | [ ] |
| `frontend/lib/stores/uiStore.ts` | Zustand UI store | [ ] |
| `frontend/lib/hooks/useCart.ts` | Cart hook | [ ] |
| `frontend/lib/hooks/useAuth.ts` | Auth hook | [ ] |
| `frontend/lib/i18n/ru.ts` | Ru strings (MVP) | [ ] |
| `frontend/public/manifest.json` | PWA manifest | [ ] |
| `frontend/public/icons/*` | PWA icons | [ ] |
| `frontend/styles/globals.css` | Tailwind + custom | [ ] |

---

## 21. Зависимости (package.json)

```json
{
  "dependencies": {
    "next": "^14.2",
    "react": "^18.3",
    "react-dom": "^18.3",
    "@apollo/client": "^3.10",
    "graphql": "^16.8",
    "zustand": "^4.5",
    "tailwindcss": "^3.4",
    "next-pwa": "^5.6",
    "zod": "^3.23",
    "clsx": "^2.1",
    "lucide-react": "^0.400"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5.5",
    "@graphql-codegen/cli": "^5.0",
    "@graphql-codegen/typescript": "^4.0",
    "@graphql-codegen/typescript-operations": "^4.0",
    "@graphql-codegen/typescript-react-apollo": "^4.0",
    "@testing-library/react": "^16.0",
    "@testing-library/jest-dom": "^6.4",
    "jest": "^29.7",
    "jest-environment-jsdom": "^29.7",
    "playwright": "^1.45",
    "prettier": "^3.3",
    "prettier-plugin-tailwindcss": "^0.6"
  }
}
```

### Инструменты генерации

| Инструмент | Назначение | Команда |
|---|---|---|
| `@graphql-codegen` | Генерация TypeScript типов из GraphQL схемы | `graphql-codegen --config codegen.ts` |
| `next-pwa` | Генерация Service Worker при build | `next build` |
| Prettier + Tailwind plugin | Автоформатирование + сортировка классов | `prettier --write .` |

---

## 22. Прогресс реализации

> **ВАЖНО:** Этот раздел обновляется после каждого рабочего шага.
> При возобновлении работы после разрыва сессии — начинать с первого `pending` пункта.

### Шаги реализации

| Шаг | Описание | Статус | Дата | Заметки |
|---|---|---|---|---|
| 1 | Инициализация Next.js 14 + TypeScript + TailwindCSS | [ ] | | |
| 2 | Настройка next.config.js (PWA, images, ISR) | [ ] | | |
| 3 | Root layout + глобальные стили + провайдеры (Apollo, Zustand) | [ ] | | |
| 4 | Базовые компоненты UI (Button, Input, Skeleton, Spinner, Badge) | [ ] | | |
| 5 | Header + Footer + MobileBottomNav + CartDrawer | [ ] | | |
| 6 | Главная страница (/ page) — SSG, hero, категории, featured | [ ] | | |
| 7 | Каталог (/products) — ISR, ProductCard, пагинация | [ ] | | |
| 8 | FilterSidebar + SortSelector + URL sync | [ ] | | |
| 9 | Карточка товара (/products/[id]) — ISR, галерея, PriceBlock | [ ] | | |
| 10 | Zustand cartStore + localStorage persist | [ ] | | |
| 11 | Apollo mutations: addToCart, removeFromCart (optimistic) | [ ] | | |
| 12 | CartDrawer + CartPage + CartEmpty | [ ] | | |
| 13 | AuthStore + LoginForm + RegisterForm + JWT handling | [ ] | | |
| 14 | Middleware + AuthGuard (route protection) | [ ] | | |
| 15 | Checkout form (адрес, промокод, ревью, payment redirect) | [ ] | | |
| 16 | Account layout + Dashboard (ProfileCard, RankProgress) | [ ] | | |
| 17 | Account: история заказов | [ ] | | |
| 18 | Account: история бонусов (BonusHistory) | [ ] | | |
| 19 | Account: партнёрская сеть (NetworkTree) | [ ] | | |
| 20 | Account: промокод + QR-код (ReferralCard) | [ ] | | |
| 21 | Account: настройки профиля | [ ] | | |
| 22 | Лидерборд (/leaderboard) — SSR | [ ] | | |
| 23 | PWA: manifest.json, Service Worker, offline cache | [ ] | | |
| 24 | Push notifications (subscription + SW push handler) | [ ] | | |
| 25 | SEO: sitemap, robots, meta-теги, OG, Schema.org | [ ] | | |
| 26 | Error boundary + not-found page | [ ] | | |
| 27 | i18n: вынос строк (ru.ts) | [ ] | | |
| 28 | Unit-тесты компонентов | [ ] | | |
| 29 | Integration-тесты (Apollo mock) | [ ] | | |
| 30 | E2E-тесты (Playwright) | [ ] | | |
| 31 | Lighthouse audit + оптимизация производительности | [ ] | | |
| 32 | Deployment (Vercel) | [ ] | | |

### Текущий контекст

_Заполняется в конце каждой сессии:_
- **Последнее действие:** —
- **Следующий шаг:** Шаг 1: Инициализация Next.js 14 + TypeScript + TailwindCSS
- **Открытые вопросы:**
  - Будет ли единый домен для косметики и БАДов, или два лендинга (разные поддомены/маршруты)?
  - Как будет выглядеть процесс оплаты: redirect на ЮKassa или встроенная форма?
  - Требуется ли верификация email при регистрации (MVP: без верификации)?
  - Будет ли "Забыли пароль" в MVP или отложено?
- **Временное состояние:** Файлы не созданы

---

## 23. Заметки и принятые решения

| Дата | Решение / Заметка | Кто |
|---|---|---|
| 2026-05-27 | Next.js 14 App Router (не Pages Router) — RSC для SEO и производительности | Qwen (Архитектор) |
| 2026-05-27 | Zustand для корзины — минимальный boilerplate, хорош для guest + auth sync | Qwen (Архитектор) |
| 2026-05-27 | Apollo Client кэш = основной слой данных; React Query отклонён (дублирование) | Qwen (Архитектор) |
| 2026-05-27 | Корзина гостя: Zustand + localStorage. При логине — merge с server cart | Qwen (Архитектор) |
| 2026-05-27 | ISR 60 сек для каталога — достаточно для динамики остатков, не грузит сервер | Qwen (Архитектор) |
| 2026-05-27 | MobileBottomNav на мобилке — стандарт для e-commerce, заменяет часть Header | Qwen (Архитектор) |
| 2026-05-27 | NetworkTree: горизонтальный (desktop) → вертикальный аккордеон (mobile) | Qwen (Архитектор) |
| 2026-05-27 | JWT в localStorage для MVP — перейти на httponly cookies перед продакшеном | Qwen (Архитектор) |
| 2026-05-27 | i18n: только RU в MVP, но строки вынесены для будущего расширения | Qwen (Архитектор) |
| 2026-05-27 | PWA вместо нативного приложения — меньше трения, критично для MLM-воронки | Qwen (Бизнес-аналитик) |
| 2026-05-27 | Optimistic updates для addToCart/removeFromCart — UX без ожидания сервера | Qwen (Архитектор) |

---

## 24. Проверка готовности

> Чек-лист «Done». Приложение считается готовым, когда ВСЕ пункты ✅.

### Функциональность
- [ ] Главная страница с категориями и featured-товарами
- [ ] Каталог: ISR, фильтрация, сортировка, пагинация
- [ ] Карточка товара: галерея, цена, наличие, "В корзину", Schema.org
- [ ] Корзина: Zustand + localStorage, sync с сервером при логине
- [ ] CartDrawer: выдвижная панель из любой страницы
- [ ] Checkout: адрес, промокод, ревью, redirect на оплату
- [ ] Аутентификация: логин + регистрация с промокодом
- [ ] Middleware + AuthGuard: защищённые роуты
- [ ] Account: dashboard, заказы, бонусы, сеть, промокод, настройки
- [ ] NetworkTree: визуализация партнёрской сети
- [ ] RankProgress: прогресс до следующего ранга
- [ ] Leaderboard: топ партнёров

### PWA
- [ ] manifest.json с корректными иконками
- [ ] Service Worker (next-pwa) установлен и активен
- [ ] Offline: каталог доступен из кэша
- [ ] Push-уведомления: subscription + обработка в SW
- [ ] Lighthouse PWA audit = pass

### UX / Мобильная адаптация
- [ ] Responsive: mobile-first, все breakpoints
- [ ] Touch targets ≥ 44×44px
- [ ] MobileBottomNav (max-width: 768px)
- [ ] FilterDrawer на мобилке
- [ ] Skeleton-загрузка для всех динамических данных
- [ ] Empty states для каталога, корзины, бонусов

### SEO
- [ ] Meta-теги (title, description) для всех страниц
- [ ] OpenGraph для основных страниц + динамический OG для продуктов
- [ ] sitemap.xml (динамический, с продуктами)
- [ ] robots.txt (disallow: /auth, /account, /cart, /checkout)
- [ ] Schema.org Product JSON-LD для карточек товаров

### Производительность
- [ ] LCP < 2.5 сек
- [ ] CLS < 0.1
- [ ] Initial JS bundle < 200KB gzip
- [ ] Lighthouse Performance > 90
- [ ] ISR работает (revalidate: 60)
- [ ] Image optimization (next/image, AVIF/WebP)

### Тесты
- [ ] Unit-тесты ключевых компонентов
- [ ] Integration-тесты (Apollo mock: каталог, корзина, checkout, auth)
- [ ] E2E-тесты (Playwright: покупатель, регистрация, PWA, offline)

### Инфраструктура
- [ ] `next.config.js` настроен (PWA, images, remotePatterns)
- [ ] `.env.example` с всеми переменными
- [ ] Deployment (Vercel) — работает в production
- [ ] On-demand revalidate endpoint подключен к бэкенду
- [ ] Нет захардкоженных секретов
- [ ] GraphQL Codegen настроен, типы генерируются

---

*Документ создан: 2026-05-27*
*Последнее обновление: 2026-05-27*
*Автор: Qwen Code (Бизнес-аналитик + Архитектор)*
