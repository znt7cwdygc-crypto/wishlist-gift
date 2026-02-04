# Подключение Vercel (веб-морда Wishlist Gift)

Фронтенд деплоится на Vercel как статический сайт. API остаётся на вашем сервере.

## 1. Репозиторий

Убедитесь, что проект в Git и запушен (GitHub, GitLab или Bitbucket).

## 2. Импорт в Vercel

1. Зайдите на [vercel.com](https://vercel.com) и войдите.
2. **Add New** → **Project**.
3. Импортируйте репозиторий (GitHub/GitLab/Bitbucket).
4. **Root Directory**: если проект в подпапке (например `wishlist-gift-v2`), укажите её; если репозиторий = один проект — оставьте пустым.
5. **Framework Preset**: оставьте **Other** (или **None**).
6. **Build Command**: `npm run build` (по умолчанию подхватится из `vercel.json`).
7. **Output Directory**: `public` (подхватится из `vercel.json`).
8. **Install Command**: `npm install` (по умолчанию).

## 3. Переменные окружения (обязательно)

В настройках проекта: **Settings** → **Environment Variables**.

| Имя | Значение | Где использовать |
|-----|----------|-------------------|
| `API_URL` | Полный URL вашего API **включая `/api`**, например `https://api.ваш-домен.com/api` | Production, Preview (по желанию) |

Примеры:
- API на сервере 185.125.219.107: `https://api.ваш-домен.ru/api` (если настроили домен и прокси на Node).
- Или по IP (если открыт порт): `http://185.125.219.107:3000/api`.

Без `API_URL` фронт будет слать запросы на тот же домен (Vercel), и API там нет — запросы будут падать. После добавления переменной сделайте **Redeploy**.

## 4. Деплой

Нажмите **Deploy**. Vercel соберёт проект (`npm run build` подставит `API_URL` в `config.js`) и опубликует папку `public`.

Домен будет вида: `ваш-проект.vercel.app`. Можно привязать свой домен в **Settings** → **Domains**.

## 5. Маршруты (уже в vercel.json)

- `/` → index.html  
- `/gift`, `/gift/:slug` → gift.html  
- `/cabinet` → cabinet.html  
- `/stars` → stars.html  
- `/model` → model.html  
- `/donor`, `/donor/:link` → donor.html  
- `/admin` → admin.html  

## 6. CORS на API

На сервере, где крутится Node API, в `.env` укажите домен Vercel для CORS:

```env
CORS_ORIGIN=https://ваш-проект.vercel.app
```

Или несколько через запятую, либо `*` (менее безопасно).

## Итог

- **Vercel** — только статика (HTML/CSS/JS), переменная `API_URL` подставляется при сборке.
- **API и БД** — на вашем сервере (185.125.219.107). Настройте там домен и прокси до Node (например Nginx) и задайте этот URL в `API_URL` на Vercel.
