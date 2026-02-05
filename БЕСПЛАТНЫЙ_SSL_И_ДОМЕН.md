# Бесплатный домен и SSL для Telegram Mini App

Telegram не открывает Mini App по IP и с самоподписанным сертификатом. Нужен **домен** и **валидный SSL**. Ниже два бесплатных варианта.

---

## Вариант 1: DuckDNS + Let's Encrypt (рекомендуется, стабильный URL)

Вы получите адрес вида **https://ваше-имя.duckdns.org** с бесплатным доверенным сертификатом. URL не меняется — его один раз прописываете в боте.

### Шаг 1. Зарегистрировать поддомен на DuckDNS

1. Зайдите на **https://www.duckdns.org**
2. Войдите через Google/GitHub или создайте аккаунт
3. В поле «Create Domain» введите имя, например: `wishlistgift` → получится **wishlistgift.duckdns.org**
4. Нажмите «Create Domain»
5. В списке доменов нажмите **wishlistgift.duckdns.org** и в поле «Current IP» вставьте ваш IP: **185.125.219.107**, нажмите «Update IP»

Готово: домен **wishlistgift.duckdns.org** указывает на ваш сервер.

### Шаг 2. На VPS: Nginx + Certbot + сертификат Let's Encrypt

Подключитесь к серверу:

```bash
ssh -i ~/.ssh/id_ed25519_vps root@185.125.219.107
```

Установите Nginx и Certbot (подставьте свой домен вместо `wishlistgift.duckdns.org`):

```bash
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx
```

Временно остановите приложение, чтобы порт 80 был свободен для выдачи сертификата:

```bash
pm2 stop wishlist-api
```

Получите сертификат (замените `wishlistgift.duckdns.org` на свой домен):

```bash
certbot certonly --standalone -d wishlistgift.duckdns.org --non-interactive --agree-tos --email your@email.com
```

Сертификаты появятся в `/etc/letsencrypt/live/wishlistgift.duckdns.org/` (fullchain.pem и privkey.pem).

### Шаг 3. Настроить Nginx как HTTPS-прокси на приложение

Создайте конфиг (подставьте свой домен):

```bash
cat > /etc/nginx/sites-available/wishlist << 'EOF'
server {
    listen 80;
    server_name wishlistgift.duckdns.org;
    return 301 https://$server_name$request_uri;
}
server {
    listen 443 ssl;
    server_name wishlistgift.duckdns.org;

    ssl_certificate     /etc/letsencrypt/live/wishlistgift.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wishlistgift.duckdns.org/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

Включите сайт и перезапустите Nginx:

```bash
ln -sf /etc/nginx/sites-available/wishlist /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Запустите приложение снова (на порту 3000, без своего SSL — Nginx уже отдаёт HTTPS):

```bash
pm2 start wishlist-api
```

Уберите или переименуйте папку `ssl` в проекте, чтобы приложение не занимало 3000 с HTTPS (пусть слушает только HTTP для Nginx):

```bash
cd /opt/wishlist-gift-v2
mv ssl ssl.bak 2>/dev/null || true
pm2 restart wishlist-api
```

### Шаг 4. APP_URL и бот

В `.env` на сервере укажите новый адрес **без** порта (доступ по 443):

```bash
nano /opt/wishlist-gift-v2/.env
```

Строка:

```env
APP_URL=https://wishlistgift.duckdns.org
```

Перезапуск:

```bash
pm2 restart wishlist-api
```

В BotFather для Mini App (Menu Button или Web App URL) укажите: **https://wishlistgift.duckdns.org**

### Шаг 5. Продление сертификата

Let's Encrypt выдаёт сертификат на 90 дней. Продление:

```bash
certbot renew --quiet
systemctl reload nginx
```

Можно добавить в cron (раз в день):  
`0 3 * * * certbot renew --quiet && systemctl reload nginx`

---

## Вариант 2: Cloudflare Quick Tunnel (быстро для теста, URL меняется)

Подходит только для проверки: каждый запуск туннеля даёт **новый** адрес вида `https://xxxx.trycloudflare.com`. Для постоянного Mini App лучше Вариант 1.

На сервере:

```bash
# Установка cloudflared (пример для Linux)
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared-linux-amd64.deb

# Запуск туннеля к вашему приложению (оно должно слушать на 3000)
cloudflared tunnel --url http://127.0.0.1:3000
```

В консоли появится строка вида:  
`https://random-words.trycloudflare.com`  
Откройте её в браузере — должен открыться ваш сайт по HTTPS с валидным сертификатом.

В BotFather временно укажите этот URL как Mini App. После перезапуска туннеля URL изменится — его придётся обновлять в боте. Для постоянной работы используйте Вариант 1.

---

## Итог

| Вариант              | Домен              | SSL        | Стабильный URL | Сложность   |
|----------------------|--------------------|-----------|----------------|-------------|
| DuckDNS + Let's Encrypt | xxx.duckdns.org    | Let's Encrypt | Да            | Средняя     |
| Cloudflare Quick Tunnel | xxx.trycloudflare.com | Cloudflare   | Нет (меняется) | Очень простая |

Для **постоянного** Mini App лучше **Вариант 1**: один раз настроили DuckDNS + Nginx + certbot — и пользуетесь **https://ваше-имя.duckdns.org** в веб-аппе и в боте.
