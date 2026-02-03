# 🎁 Wishlist Gift Platform v2.0

Современная платформа для подарков через Telegram Stars (2025) с полностью обновленным дизайном и архитектурой.

## ✨ Особенности

- 🎨 Современный дизайн 2025 года
- 📱 Полностью адаптивный интерфейс
- 🚀 API-first архитектура
- 🗄️ PostgreSQL база данных
- 🔒 Безопасность и валидация
- 🌍 Мультиязычность (RU/EN)
- 📊 Админ-панель с аналитикой
- 🎁 Система вишлистов и подарков

## 🚀 Быстрый старт

**PostgreSQL обязателен** — все данные хранятся в БД.

```bash
cd wishlist-gift-v2
npm install

# 1. Создать БД
createdb wishlist_gift

# 2. Применить схему
psql wishlist_gift < schema/init.sql

# 3. Настроить .env (DB_PASSWORD и др.)
cp .env.example .env

# 4. Запустить
npm start
```

Откройте http://localhost:3000

📖 **Подробные инструкции:** См. [QUICKSTART.md](./QUICKSTART.md)  
🤖 **Интеграция с Telegram (deep links, Stars):** См. [TELEGRAM_INTEGRATION.md](./TELEGRAM_INTEGRATION.md)  
🚀 **Render (автодеплой):** См. [RENDER_SETUP.md](./RENDER_SETUP.md)

## 📁 Структура проекта

```
wishlist-gift-v2/
├── public/              # Frontend файлы
│   ├── css/            # Стили
│   ├── js/             # JavaScript
│   └── *.html          # HTML страницы
├── server/             # Backend
│   ├── routes/         # API роуты
│   ├── models/         # Модели базы данных
│   ├── middleware/     # Middleware
│   └── index.js        # Главный файл сервера
├── package.json
└── README.md
```

## 🛠 Технологии

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Frontend**: Vanilla JavaScript, Modern CSS
- **Deploy**: Heroku / Railway / Render

## 📝 API Endpoints

### Авторизация
- `POST /api/auth/telegram` - Авторизация через Telegram
- `POST /api/auth/admin` - Авторизация администратора

### Модели
- `GET /api/models/me` - Получить свой профиль
- `PUT /api/models/me` - Обновить профиль
- `GET /api/models/:publicLink` - Получить публичный профиль

### Вишлист
- `GET /api/wishlist` - Получить свой вишлист
- `GET /api/wishlist/model/:modelId` - Получить вишлист модели
- `POST /api/wishlist/items` - Добавить товар
- `PUT /api/wishlist/items/:id` - Обновить товар
- `DELETE /api/wishlist/items/:id` - Удалить товар

### Платежи
- `POST /api/payments/initiate` - Инициировать платеж
- `POST /api/payments/telegram/webhook` - Webhook от Telegram

### Админ
- `GET /api/admin/stats` - Статистика
- `GET /api/admin/models` - Список моделей
- `GET /api/admin/transactions` - Транзакции

## 🚢 Деплой

### Heroku

```bash
# Установить Heroku CLI
heroku login

# Создать приложение
heroku create wishlist-gift-app

# Добавить PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Установить переменные окружения
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret_key

# Деплой
git push heroku main
```

### Railway

1. Подключить GitHub репозиторий
2. Railway автоматически определит Node.js проект
3. Добавить PostgreSQL сервис
4. Настроить переменные окружения
5. Деплой произойдет автоматически

### Render

1. Создать новый Web Service
2. Подключить репозиторий
3. Настроить:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Добавить PostgreSQL базу данных
5. Настроить переменные окружения

## 📄 Лицензия

MIT

