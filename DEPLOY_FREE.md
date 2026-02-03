# 🚀 Деплой на бесплатные сервисы для Telegram

Пошаговая инструкция: Render (хостинг) + PostgreSQL + Telegram Bot.

---

## 1. Подготовка

### Репозиторий на GitHub

```bash
cd wishlist-gift-v2
git init
git add .
git commit -m "Initial"
git branch -M main
# Создайте репозиторий на github.com и выполните:
git remote add origin https://github.com/YOUR_USERNAME/wishlist-gift.git
git push -u origin main
```

---

## 2. Render.com (бесплатно)

### 2.1 Создать PostgreSQL

1. Зайдите на [render.com](https://render.com) и войдите через GitHub
2. **New** → **PostgreSQL**
3. Имя: `wishlist-gift-db`
4. Region: Frankfurt (или ближайший)
5. Plan: **Free**
6. **Create Database**
7. После создания скопируйте **Internal Database URL** (или External, если приложение вне Render)

### 2.2 Создать Web Service

1. **New** → **Web Service**
2. Подключите репозиторий `wishlist-gift`
3. Настройки:
   - **Name:** `wishlist-gift`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

4. **Environment** — добавьте переменные:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = (вставьте Internal Database URL из п. 2.1)
   - `APP_URL` = `https://YOUR-APP.onrender.com` (ваш URL после деплоя)
   - `BOT_USERNAME` = `WishlistGiftBot` (username вашего бота без @)
   - `CORS_ORIGIN` = `*`

5. **Create Web Service**

6. Дождитесь деплоя. URL будет: `https://wishlist-gift-XXXX.onrender.com`

### 2.3 Инициализация БД

После первого деплоя откройте в браузере:
```
https://YOUR-APP.onrender.com/
```

Схема БД применится автоматически при старте (скрипт `scripts/start.js`).

---

## 3. Telegram Bot + Mini App

### 3.1 Создать бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newbot`
3. Введите имя: `Wishlist Gift`
4. Введите username: `WishlistGiftBot` (должен заканчиваться на Bot)
5. Скопируйте **токен** бота

### 3.2 Настроить Mini App

1. В BotFather отправьте `/mybots`
2. Выберите вашего бота → **Bot Settings** → **Menu Button** → **Configure menu button**
3. Введите URL вашего приложения:
   ```
   https://YOUR-APP.onrender.com/
   ```
4. Или настройте через API:
   ```
   https://api.telegram.org/bot<TOKEN>/setChatMenuButton
   ```
   Body: `{"menu_button":{"type":"web_app","text":"Открыть","web_app":{"url":"https://YOUR-APP.onrender.com/"}}}`

### 3.3 Кнопка «Мой вишлист» (для моделей)

Пользователь нажимает Menu Button → открывается Mini App.

Ссылки для дарителей (публичный вишлист):
```
https://t.me/WishlistGiftBot?start=me
```
или с вашим slug:
```
https://t.me/WishlistGiftBot?start=anna
```

---

## 4. Альтернатива: Railway

1. [railway.app](https://railway.app) → **Start a New Project**
2. **Deploy from GitHub** → выберите репозиторий
3. **Add PostgreSQL** (плагин)
4. Переменные: `DATABASE_URL` подтянется автоматически
5. **Settings** → **Generate Domain**
6. URL: `https://wishlist-gift-production.up.railway.app`

---

## 5. Альтернатива: Neon (БД) + Render (приложение)

Если нужна бесплатная БД без ограничения по времени:

1. [neon.tech](https://neon.tech) → **Sign Up** → создайте проект
2. Скопируйте **Connection string**
3. На Render в Environment добавьте:
   - `DATABASE_URL` = connection string от Neon

---

## 6. Проверка

После деплоя:

- Главная: `https://YOUR-APP.onrender.com/`
- Кабинет модели: `https://YOUR-APP.onrender.com/cabinet`
- Вишлист дарителя: `https://YOUR-APP.onrender.com/gift`

В Telegram: откройте бота → нажмите кнопку меню (☰) или /start.

---

## 7. Ограничения бесплатных планов

| Сервис | Ограничение |
|--------|-------------|
| Render Free | Засыпает после 15 мин без трафика, холодный старт ~30 сек |
| Render PostgreSQL | 90 дней бесплатно, потом $7/мес |
| Railway | $5 бесплатных кредитов в месяц |
| Neon | 0.5 GB, без срока |

Рекомендация: для MVP подойдёт Render (app + Postgres). Для долгосрочного использования — Neon (БД) + Render (app).
