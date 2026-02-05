# Проверка приёма Telegram Stars из веб-приложения

Цепочка: **веб-приложение (Mini App)** → **API** → **бот отправляет инвойс** → пользователь платит → **webhook** → запись в БД.

---

## 1. Цепочка (как это устроено)

| Шаг | Где | Что происходит |
|-----|-----|----------------|
| 1 | Веб-приложение `/stars` | Пользователь выбирает сумму (50–1000 Stars), нажимает «Отправить Stars». |
| 2 | Фронт → `POST /api/stars/send` | Отправляются `amount` и `initData` (данные Telegram Web App). |
| 3 | `server/routes/stars.js` | Проверяется `initData` (HMAC с BOT_TOKEN), в БД создаётся запись в `donations` с payload `donate:uuid`. |
| 4 | Тот же роут | Вызов Telegram API `sendInvoice`: счёт уходит в **чат пользователя с ботом** (chat_id = telegram user id из initData). |
| 5 | Пользователь | В чате с ботом видит сообщение со счётом, нажимает **Pay**. |
| 6 | Telegram | Отправляет на наш webhook `POST /api/payments/telegram-webhook`: сначала `pre_checkout_query`, потом в сообщении — `successful_payment`. |
| 7 | `server/routes/payments.js` | По `pre_checkout_query` вызывается `answerPreCheckoutQuery(ok: true)` (проверка по БД по payload `donate:...`). |
| 8 | Тот же роут | По `successful_payment` обновляется запись в `donations`: `status = 'paid'`, сохраняется `telegram_payment_charge_id`. |

Итог: инвойс создаётся из веб-приложения, оплата принимается ботом через webhook, донаты пишутся в БД.

---

## 2. Что должно быть настроено

- **BOT_TOKEN** и **APP_URL** в `.env` на сервере (без слэша в конце у APP_URL).
- При старте сервера выполняется **setWebhook** на `APP_URL/api/payments/telegram-webhook` (логи: `✅ Telegram webhook set: ...`).
- Mini App открывается **из того же бота** (чтобы initData подписывался тем же BOT_TOKEN). В BotFather: Menu Button или ссылка вида `https://t.me/ВашБот/app` или `http://185.125.219.107:3000/stars` (если приложение по IP).

---

## 3. Как проверить

1. Откройте бота в Telegram и запустите Mini App (кнопка меню или ссылка на ваш сервер, например `http://185.125.219.107:3000/stars`).
2. На странице «Отправить Stars» выберите сумму и нажмите «Отправить».
3. Должно появиться сообщение «Счёт в чате!» и в том же чате с ботом — сообщение со счётом и кнопкой **Pay**.
4. Нажмите Pay и завершите оплату (тестовые Stars, если включена тестовая среда).
5. В логах сервера: `[Webhook] pre_checkout_query`, `[pre_checkout] answer OK`, затем обновление по `successful_payment`.
6. В БД: в таблице `donations` запись с этим payload и `status = 'paid'`.

Если счёт не приходит — проверьте BOT_TOKEN и что запрос идёт на ваш API. Если Pay зависает — проверьте, что webhook установлен и в логах есть `[Webhook] pre_checkout_query`.
