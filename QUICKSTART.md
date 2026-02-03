# 🚀 Быстрый старт Wishlist Gift v2.0

## Локальный запуск (без базы данных)

### Шаг 1: Установка зависимостей

```bash
cd wishlist-gift-v2
npm install
```

### Шаг 2: Запуск сервера

```bash
npm start
```

Сервер запустится на `http://localhost:3000`

### Шаг 3: Открыть в браузере

- Главная: http://localhost:3000
- Модель: http://localhost:3000/model
- Даритель: http://localhost:3000/donor
- Админ: http://localhost:3000/admin

## С базой данных PostgreSQL

### Шаг 1: Установить PostgreSQL

```bash
# macOS
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Шаг 2: Создать базу данных

```bash
createdb wishlist_gift
```

### Шаг 3: Настроить .env

Отредактировать `.env` файл:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wishlist_gift
DB_USER=your_username
DB_PASSWORD=your_password
```

### Шаг 4: Применить миграции

```bash
# Скопировать DATABASE_SCHEMA.sql из корня проекта
psql wishlist_gift < ../DATABASE_SCHEMA.sql

# Или через node (если миграции настроены)
npm run migrate
```

### Шаг 5: Запустить сервер

```bash
npm start
```

## Деплой на Heroku (5 минут)

```bash
# 1. Установить Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# 2. Войти
heroku login

# 3. Создать приложение
heroku create wishlist-gift-app

# 4. Добавить PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# 5. Настроить переменные
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 32)

# 6. Деплой
git init
git add .
git commit -m "Initial commit"
git push heroku main

# 7. Проверить логи
heroku logs --tail
```

Ваше приложение будет доступно по адресу: `https://wishlist-gift-app.herokuapp.com`

## Деплой на Railway (3 минуты)

1. Перейти на https://railway.app
2. Войти через GitHub
3. Нажать "New Project" → "Deploy from GitHub repo"
4. Выбрать репозиторий
5. Railway автоматически определит Node.js и задеплоит
6. Добавить PostgreSQL сервис
7. Готово! 🎉

## Структура проекта

```
wishlist-gift-v2/
├── public/              # Frontend (HTML, CSS, JS)
│   ├── css/
│   ├── js/
│   └── *.html
├── server/             # Backend (Node.js)
│   ├── routes/        # API endpoints
│   ├── db.js          # Database connection
│   └── index.js       # Server entry point
├── package.json
├── Procfile           # Для Heroku
└── README.md
```

## API Endpoints

Все endpoints начинаются с `/api`:

- `POST /api/auth/telegram` - Авторизация
- `GET /api/models/me` - Профиль модели
- `GET /api/wishlist` - Вишлист
- `POST /api/wishlist/items` - Добавить товар
- `GET /api/admin/stats` - Статистика

## Особенности

✅ Современный дизайн 2025  
✅ Адаптивная верстка  
✅ API-first архитектура  
✅ Готово к деплою  
✅ Мультиязычность (RU/EN)  
✅ Telegram Mini App готовность  

## Следующие шаги

1. Настроить базу данных PostgreSQL
2. Реализовать полную интеграцию с Telegram
3. Добавить загрузку файлов
4. Настроить Telegram Payments
5. Добавить аутентификацию

## Проблемы?

- Проверить логи: `heroku logs --tail` или `pm2 logs`
- Проверить переменные окружения
- Проверить подключение к БД
- Убедиться что порт 3000 свободен


