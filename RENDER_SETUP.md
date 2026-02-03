# 🚀 Render — Автоматический деплой

Один раз настроили — дальше только `./deploy.sh`.

---

## Шаг 1: Один раз (если ещё не сделано)

### 1.1 Blueprint (создаёт всё автоматически)

1. [render.com](https://render.com) → **New** → **Blueprint**
2. Подключите репозиторий **znt7cwdygc-crypto/wishlist-gift**
3. Render прочитает `render.yaml` и создаст:
   - PostgreSQL (wishlist-gift-db)
   - Web Service (wishlist-gift)
4. При создании попросит **BOT_TOKEN** — вставьте токен от @BotFather
5. **Apply** → ждите первый деплой (2–3 мин)

### 1.2 Telegram Bot

1. [@BotFather](https://t.me/BotFather) → `/mybots` → ваш бот
2. **Bot Settings** → **Menu Button** → URL: `https://wishlist-gift.onrender.com/`

---

## Шаг 2: Деплой (каждый раз при изменениях)

```bash
cd wishlist-gift-v2
./deploy.sh
```

Или вручную:

```bash
git add -A && git commit -m "Update" && git push origin main
```

Render автоматически задеплоит новый код в течение 1–3 минут.

---

## Что уже автоматически

| Что | Как |
|-----|-----|
| База данных | Создаётся Blueprint'ом |
| DATABASE_URL | Подставляется из базы |
| JWT_SECRET | Генерируется Render |
| Схема БД | Применяется при старте (`scripts/start.js`) |
| Деплой при push | `autoDeployTrigger: commit` |

---

## Переменные окружения (уже в render.yaml)

- `NODE_ENV=production`
- `DATABASE_URL` — из PostgreSQL
- `JWT_SECRET` — auto
- `BOT_TOKEN` — ввести при создании Blueprint
- `BOT_USERNAME=WishlistGiftBot`
- `CORS_ORIGIN=*`
