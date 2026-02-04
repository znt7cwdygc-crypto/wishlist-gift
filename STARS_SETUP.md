# ⭐ Простое приложение для приёма Telegram Stars

Минимальный Web App: выбор суммы → отправка счёта → оплата Stars.

## Страница

**/stars** — выбор суммы (50, 100, 250, 500, 1000 Stars), кнопка «Отправить».

## Что нужно настроить

### 1. BOT_TOKEN в Render

Environment → `BOT_TOKEN` = токен от @BotFather

### 2. Webhook на боте (обязательно)

Без webhook оплата будет зависать. Telegram присылает pre_checkout_query и successful_payment на ваш сервер.

1. Откройте в браузере (подставьте свой BOT_TOKEN):
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://wishlist-gift.onrender.com/api/payments/telegram-webhook
   ```

2. Должен вернуться `{"ok":true,"result":true}`

3. Проверка: откройте https://wishlist-gift.onrender.com/stars → «Проверить настройки»

### 3. Menu Button в боте

@BotFather → ваш бот → Menu Button → URL: `https://wishlist-gift.onrender.com/stars`

## Как работает

1. Пользователь открывает Mini App (/stars) в Telegram
2. Выбирает сумму, жмёт «Отправить Stars»
3. Бот отправляет Invoice в чат
4. Пользователь нажимает Pay в сообщении
5. Оплата → webhook → статус «paid» в БД

Донаты сохраняются в таблице `donations`.

## Если окно оплаты зависает (BOT_PRECHECKOUT_TIMEOUT)

Telegram ждёт `answerPreCheckoutQuery` максимум **10 секунд**.

**Что сделано в коде:**
- Логирование: `[Webhook] pre_checkout_query`, `[pre_checkout] answer OK 150ms`
- Таймаут БД: 8 сек — при медленной БД отвечаем «Попробуйте через минуту»
- `FAST_PRECHECKOUT=true` — для отладки: пропуск БД, сразу ok=true (только для теста!)

**Диагностика в Render Logs:**
1. Нажмите Pay → смотрите логи
2. Нет `[Webhook] pre_checkout_query` → webhook не доходит (проверьте setWebhook)
3. Есть `[pre_checkout]` но долго → БД медленная или cold start

**Cold start:**
- **UptimeRobot** (uptimerobot.com) → монитор `https://wishlist-gift.onrender.com/` каждые 5 мин
