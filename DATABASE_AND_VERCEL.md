# База данных и деплой (сервер + Vercel)

## 1. База данных (уже создана)

База **wishlist_gift** развёрнута на вашем сервере **185.125.219.107**.

### Параметры подключения

| Параметр | Значение |
|----------|----------|
| **Хост** | `127.0.0.1` (если бэкенд на этом же сервере) или `185.125.219.107` (если бэкенд снаружи) |
| **Порт** | `5432` |
| **База** | `wishlist_gift` |
| **Пользователь** | `wishlist_gift` |
| **Пароль** | см. файл `DB_CREDENTIALS.txt` (создан локально, не коммитить) |

### Connection string (для бэкенда на сервере)

```
postgresql://wishlist_gift:SECRET@127.0.0.1:5432/wishlist_gift
```

Подставьте пароль из `DB_CREDENTIALS.txt` вместо `SECRET`. В URL спецсимволы в пароле нужно URL-кодировать (например `+` → `%2B`, `/` → `%2F`).

### Таблицы

- `users` — пользователи (Telegram ID, роль)
- `model_profiles` — профили моделей (обложка, био, public_slug)
- `wishlist_items` — товары вишлиста
- `orders` — заказы (подарки)
- `donations` — донаты Stars
- `model_balances` — балансы моделей
- `invite_tokens`, `wishlist_allowed_users`, `wishlist_access_requests` — доступ к вишлистам

---

## 2. Где крутить бэкенд (API)

Рекомендация: **API (Node/Express) — на том же сервере 185.125.219.107**. Тогда БД доступна по `127.0.0.1`, не нужно открывать PostgreSQL в интернет.

- Разместить проект (или только `server/`) на сервере.
- Запуск через PM2: `pm2 start server/index.js --name wishlist-api`.
- Nginx (или аналог) проксирует, например, `https://api.ваш-домен.com` → `http://127.0.0.1:3000`.

Переменные окружения на сервере для API:

```env
NODE_ENV=production
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=wishlist_gift
DB_USER=wishlist_gift
DB_PASSWORD=<пароль из DB_CREDENTIALS.txt>
# Или одна строка:
# DATABASE_URL=postgresql://wishlist_gift:PASSWORD@127.0.0.1:5432/wishlist_gift

BOT_TOKEN=...
JWT_SECRET=...
APP_URL=https://ваш-фронт.vercel.app
```

---

## 3. Vercel — веб-морда (фронт)

На Vercel деплоится только **фронтенд** (папка `public/` или собранный статический билд).

### Переменные окружения на Vercel

В настройках проекта Vercel → Settings → Environment Variables добавьте:

| Переменная | Значение | Описание |
|------------|----------|----------|
| `VITE_API_URL` или `NEXT_PUBLIC_API_URL` | `https://api.ваш-домен.com` | URL вашего API (сервер 185.125.219.107) |

Использование в коде: все запросы к API идут на `VITE_API_URL` / `NEXT_PUBLIC_API_URL` (в зависимости от сборки).

### Деплой на Vercel

1. Подключите репозиторий к Vercel.
2. Root Directory: корень проекта или папка с фронтом.
3. Build Command: например `npm run build` (если есть скрипт для статики).
4. Output Directory: `public` или `dist` — куда собирается фронт.
5. Укажите `VITE_API_URL` / `NEXT_PUBLIC_API_URL` как выше.

Фронт будет ходить за данными на ваш API на сервере; API подключается к PostgreSQL на localhost.

---

## 4. Если API будет на Vercel (Serverless)

Если решите поднять API как Vercel Serverless Functions, тогда PostgreSQL должен принимать подключения извне:

1. На сервере в `postgresql.conf`: `listen_addresses = '*'`.
2. В `pg_hba.conf` добавить строку для доступа по паролю с нужных IP (например Vercel IP ranges).
3. В Vercel Environment Variables задать `DATABASE_URL=postgresql://wishlist_gift:PASSWORD@185.125.219.107:5432/wishlist_gift` (пароль URL-encoded).

Рекомендация: для простоты и безопасности лучше держать API на вашем сервере, БД только localhost.
