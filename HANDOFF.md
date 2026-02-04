# Handoff — данные для нового агента / продолжения работы

## Проект

**Название:** Wishlist Gift — Telegram Mini App для подарков через Stars  
**Путь:** `/Users/vladislav/wishlist-gift-v2`  
**Репозиторий:** https://github.com/znt7cwdygc-crypto/wishlist-gift  
**Продакшен:** https://wishlist-gift.onrender.com  

---

## Стек

- **Backend:** Node.js, Express, PostgreSQL
- **Frontend:** Vanilla JS, HTML/CSS, Telegram Web App API
- **Деплой:** Render (Web Service + PostgreSQL), GitHub

---

## Запуск локально

```bash
cd /Users/vladislav/wishlist-gift-v2
npm install
createdb wishlist_gift
psql wishlist_gift < schema/init.sql
cp .env.example .env
# Заполнить .env: DB_PASSWORD, опционально BOT_TOKEN, JWT_SECRET
npm start
```

Открыть: http://localhost:3000

---

## Переменные окружения

| Переменная     | Назначение |
|----------------|------------|
| `PORT`         | Порт (по умолчанию 3000) |
| `NODE_ENV`     | development / production |
| `DATABASE_URL` | Строка подключения к PostgreSQL (Render подставляет сам) |
| или `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Локальная БД |
| `BOT_TOKEN`    | Токен бота от @BotFather — нужен для авторизации по Telegram initData |
| `JWT_SECRET`   | Секрет для JWT (любая случайная строка) |
| `BOT_USERNAME` | Username бота без @ (например WishlistGiftBot) |
| `APP_URL`      | Не обязателен на Render (используется RENDER_EXTERNAL_URL) |

---

## Основные страницы и API

| Что | URL / Endpoint |
|-----|----------------|
| Главная | `/` (index.html) |
| Кабинет модели | `/cabinet` |
| Вишлист дарителя | `/gift`, `/gift/:slug` |
| Админка | `/admin` |
| Auth (Telegram) | `POST /api/auth/telegram` (body: `{ initData }`) |
| Профиль модели | `GET /api/models/me` (с JWT), `GET /api/models/:slug` (публичный) |
| Вишлист | `GET /api/wishlist` (свой, с JWT), `GET /api/wishlist/by-slug/:slug` (публичный) |
| Товары | `POST /api/wishlist/items`, `PUT /api/wishlist/items/:id`, `DELETE /api/wishlist/items/:id` (с JWT) |
| Заказы | `POST /api/orders` (item_id, model_id, donor_telegram_id, amount_xtr, message) |
| Конфиг для фронта | `GET /api/config` (appUrl, botUsername, shareLink) |

---

## База данных

- Схема: `schema/init.sql`
- При старте сервера выполняется `scripts/start.js` → `scripts/init-db.js` → применяется схема.
- Таблицы: `users`, `model_profiles`, `wishlist_items`, `orders`, `invite_tokens`, `wishlist_allowed_users`, `wishlist_access_requests`, `model_balances`.

---

## Деплой (Render)

1. Репозиторий уже подключён: https://github.com/znt7cwdygc-crypto/wishlist-gift  
2. В Render: Web Service + PostgreSQL (или Blueprint из `render.yaml`).  
3. В Environment задать: `BOT_TOKEN`, `JWT_SECRET` (или через generateValue в Blueprint).  
4. Push в `main` → авто-деплой.  
5. Скрипт деплоя локально: `./deploy.sh` (делает commit + push; для push нужна авторизация GitHub).

---

## Telegram

- Бот: создать в @BotFather, получить токен → `BOT_TOKEN`.
- Mini App: в BotFather → Menu Button → URL: `https://wishlist-gift.onrender.com/`
- Ссылка на вишлист: `https://t.me/<BOT_USERNAME>?start=<public_slug>` (public_slug у модели в профиле).

---

## Известные ограничения

- **Git push** из среды агента недоступен (нет доступа к GitHub). Пользователь пушит сам (терминал или GitHub Desktop).
- **Render API** (например setup-render.js) при использовании ключа пользователя возвращал Unauthorized — возможно, тип ключа или права.
- На продакшене может быть задеплоена старая версия; после push нужно дождаться деплоя или нажать Manual Deploy в Render.

---

## Важные файлы

- `server/index.js` — точка входа, роуты, обработка ошибок
- `server/routes/auth.js` — проверка Telegram initData, выдача JWT
- `server/middleware/auth.js` — проверка JWT (и optionalAuth для заказов)
- `server/routes/wishlist.js` — CRUD товаров (по JWT — свой вишлист)
- `server/routes/orders.js` — создание заказа, резерв, связь с payments
- `server/routes/models.js` — профиль модели (me по JWT, публичный по slug)
- `public/js/cabinet.js` — кабинет модели, авторизация по initData
- `public/js/gift.js` — экран дарителя, загрузка по slug, оплата
- `schema/init.sql` — полная схема БД

---

## Курс Stars

1 Star = $0.022 (используется в `public/js/app.js` — formatPriceStars, convertToStars и в отображении цен).

---

Этого достаточно, чтобы новый агент или ты сам продолжил работу: запуск, деплой, правки бэка/фронта и авторизации.
