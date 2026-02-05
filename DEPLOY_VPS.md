# Деплой на VPS (приложение и БД на одном сервере)

Всё работает на сервере **185.125.219.107**: приложение (Node.js) и PostgreSQL.

---

## Однократная подготовка сервера

Если сервер ещё не настроен, один раз выполните по [ЧТО_ДЕЛАТЬ_ПО_ПУНКТАМ.md](./ЧТО_ДЕЛАТЬ_ПО_ПУНКТАМ.md):

1. **База данных** — на сервере уже создана БД `wishlist_gift` (пароль в `DB_CREDENTIALS.txt`).
2. **Папка и .env** — подключитесь по SSH и создайте:
   ```bash
   ssh -i ~/.ssh/id_ed25519_vps root@185.125.219.107
   mkdir -p /opt/wishlist-gift-v2
   nano /opt/wishlist-gift-v2/.env
   ```
   Вставьте в `.env` (пароль из `DB_CREDENTIALS.txt`, токен от @BotFather):
   ```env
   NODE_ENV=production
   PORT=3000
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_NAME=wishlist_gift
   DB_USER=wishlist_gift
   DB_PASSWORD=...
   BOT_TOKEN=...
   JWT_SECRET=любая_длинная_строка
   APP_URL=http://185.125.219.107:3000
   CORS_ORIGIN=*
   ```
3. Установите на сервере **Node.js** (v18+) и **PM2**: `npm install -g pm2` (если ещё нет).

После этого деплой можно делать одной командой с вашего компьютера.

---

## Деплой одной командой

С вашего компьютера (из папки проекта):

```bash
cd /Users/vladislav/wishlist-gift-v2
./deploy-vps.sh
```

Скрипт:

1. Собирает архив кода (без `node_modules`, `.git`, `.env`).
2. Копирует его на сервер в `/opt/wishlist-gift-v2`.
3. Распаковывает, запускает `npm install`.
4. Применяет схему БД (`scripts/init-db.js`) и тестовые товары (`scripts/run-seed.js`).
5. Перезапускает приложение через PM2 (`wishlist-api`).

Файл `.env` на сервере **не перезаписывается** — в архиве его нет.

---

## Переменные для другого сервера

Можно задать свои значения (перед запуском скрипта):

```bash
export VPS_HOST=your-server.com
export VPS_USER=deploy
export SSH_KEY=~/.ssh/my_key
export REMOTE_DIR=/home/deploy/wishlist-gift-v2
./deploy-vps.sh
```

---

## Проверка после деплоя

- Сайт: **http://185.125.219.107:3000**
- API: **http://185.125.219.107:3000/api/config**
- Логи: `ssh -i ~/.ssh/id_ed25519_vps root@185.125.219.107 'pm2 logs wishlist-api'`
