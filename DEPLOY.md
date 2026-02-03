# 🚀 Инструкция по деплою Wishlist Gift Platform

## Варианты деплоя

### 1. Heroku (Рекомендуется для начала)

#### Шаги:

1. **Установить Heroku CLI**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku
   
   # Windows
   # Скачать с https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Войти в Heroku**
   ```bash
   heroku login
   ```

3. **Создать приложение**
   ```bash
   heroku create wishlist-gift-app
   ```

4. **Добавить PostgreSQL**
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```

5. **Настроить переменные окружения**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=$(openssl rand -base64 32)
   heroku config:set CORS_ORIGIN=https://wishlist-gift-app.herokuapp.com
   ```

6. **Деплой**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git push heroku main
   ```

7. **Применить миграции базы данных**
   ```bash
   heroku run npm run migrate
   ```

---

### 2. Railway.app

#### Шаги:

1. **Зарегистрироваться на Railway.app**
   - Перейти на https://railway.app
   - Войти через GitHub

2. **Создать новый проект**
   - Нажать "New Project"
   - Выбрать "Deploy from GitHub repo"
   - Выбрать репозиторий

3. **Добавить PostgreSQL**
   - В проекте нажать "New"
   - Выбрать "Database" → "PostgreSQL"
   - Railway автоматически создаст переменную DATABASE_URL

4. **Настроить переменные окружения**
   - В настройках сервиса добавить:
     ```
     NODE_ENV=production
     JWT_SECRET=<генерируемый секретный ключ>
     PORT=3000
     CORS_ORIGIN=https://your-app.up.railway.app
     ```

5. **Деплой**
   - Railway автоматически деплоит при каждом push в main ветку
   - Применить миграции через Railway CLI или добавить в startup команду

---

### 3. Render.com

#### Шаги:

1. **Зарегистрироваться на Render**
   - Перейти на https://render.com
   - Войти через GitHub

2. **Создать Web Service**
   - Нажать "New" → "Web Service"
   - Подключить репозиторий

3. **Настроить сервис**
   ```
   Name: wishlist-gift
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   ```

4. **Добавить PostgreSQL**
   - В проекте нажать "New" → "PostgreSQL"
   - Render создаст DATABASE_URL автоматически

5. **Настроить переменные окружения**
   ```
   NODE_ENV=production
   JWT_SECRET=<секретный ключ>
   CORS_ORIGIN=https://wishlist-gift.onrender.com
   ```

6. **Деплой**
   - Render автоматически деплоит при каждом push
   - Миграции можно применить через Render Shell

---

### 4. VPS (Ubuntu/Debian)

#### Шаги:

1. **Подключиться к серверу**
   ```bash
   ssh user@your-server-ip
   ```

2. **Установить Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Установить PostgreSQL**
   ```bash
   sudo apt-get update
   sudo apt-get install postgresql postgresql-contrib
   sudo -u postgres createdb wishlist_gift
   ```

4. **Клонировать репозиторий**
   ```bash
   git clone <your-repo-url>
   cd wishlist-gift-v2
   npm install
   ```

5. **Настроить .env**
   ```bash
   cp .env.example .env
   nano .env
   # Заполнить все переменные
   ```

6. **Установить PM2**
   ```bash
   npm install -g pm2
   pm2 start server/index.js --name wishlist-gift
   pm2 startup
   pm2 save
   ```

7. **Настроить Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

8. **Настроить SSL (Let's Encrypt)**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

---

## Общие шаги для всех платформ

### 1. Настройка базы данных

После деплоя обязательно применить миграции:

```bash
# Локально (для проверки)
npm run migrate

# На сервере/платформе
# Heroku: heroku run npm run migrate
# Railway: railway run npm run migrate
# Render: render shell (затем npm run migrate)
```

### 2. Переменные окружения

Обязательные переменные:
```env
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wishlist_gift
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_very_secret_key_here
CORS_ORIGIN=https://your-domain.com
```

### 3. Проверка работоспособности

После деплоя проверить:
- ✅ Главная страница открывается
- ✅ API endpoints отвечают (GET /api/admin/stats)
- ✅ База данных подключена
- ✅ Статические файлы загружаются

---

## Мониторинг и логи

### Heroku
```bash
heroku logs --tail
```

### Railway
- Логи доступны в веб-интерфейсе
- Или через CLI: `railway logs`

### Render
- Логи в веб-интерфейсе в разделе "Logs"

### PM2 (VPS)
```bash
pm2 logs wishlist-gift
pm2 monit
```

---

## Обновление приложения

### Для Git-based деплоя (Heroku, Railway, Render):
```bash
git add .
git commit -m "Update"
git push origin main
# Деплой произойдет автоматически
```

### Для VPS с PM2:
```bash
git pull origin main
npm install
pm2 restart wishlist-gift
```

---

## Полезные команды

```bash
# Проверить статус приложения
pm2 status

# Перезапустить приложение
pm2 restart wishlist-gift

# Остановить приложение
pm2 stop wishlist-gift

# Посмотреть логи
pm2 logs wishlist-gift

# Мониторинг
pm2 monit
```

---

## Поддержка

При возникновении проблем:
1. Проверить логи
2. Проверить переменные окружения
3. Проверить подключение к базе данных
4. Проверить статус сервера


