# ⭐ Простое приложение для приёма Telegram Stars

Минимальный Web App: выбор суммы → отправка счёта → оплата Stars.

## Страница

**/stars** — выбор суммы (50, 100, 250, 500, 1000 Stars), кнопка «Отправить».

## Что нужно настроить

### 1. BOT_TOKEN в Render

Environment → `BOT_TOKEN` = токен от @BotFather

### 2. Webhook на боте

Telegram должен слать события (pre_checkout, successful_payment) на ваш сервер.

Выполните (подставьте свои значения):

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://wishlist-gift.onrender.com/api/payments/telegram-webhook"
```

Или через браузер:
```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://wishlist-gift.onrender.com/api/payments/telegram-webhook
```

### 3. Menu Button в боте

@BotFather → ваш бот → Menu Button → URL: `https://wishlist-gift.onrender.com/stars`

## Как работает

1. Пользователь открывает Mini App (/stars) в Telegram
2. Выбирает сумму, жмёт «Отправить Stars»
3. Бот отправляет Invoice в чат
4. Пользователь нажимает Pay в сообщении
5. Оплата → webhook → статус «paid» в БД

Донаты сохраняются в таблице `donations`.
