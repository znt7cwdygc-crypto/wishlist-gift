# Подключение домена wishliststars.com (GoDaddy) к VPS

Домен куплен на GoDaddy. Ниже — как направить его на сервер 185.125.219.107 и включить HTTPS через Let's Encrypt.

---

## Часть 1. DNS в GoDaddy

Нужно, чтобы **wishliststars.com** и **www.wishliststars.com** указывали на IP вашего VPS.

### Шаг 1.1. Открыть управление DNS

1. Зайдите на **https://www.godaddy.com** и войдите в аккаунт.
2. Перейдите в **Мои продукты** → найдите домен **wishliststars.com** → нажмите **DNS** (или **Управление DNS** / **Manage DNS**).

### Шаг 1.2. Добавить A-запись для основного домена

1. В блоке **Записи** нажмите **Добавить** (или **Add**).
2. Заполните:
   - **Тип:** **A**
   - **Имя / Name:** оставьте **@** (это сам домен wishliststars.com).
   - **Значение / Value / Points to:** **185.125.219.107**
   - **TTL:** 600 или 1 час (по умолчанию).
3. Сохраните.

### Шаг 1.3. Добавить A-запись для www

1. Снова **Добавить** запись.
2. Заполните:
   - **Тип:** **A**
   - **Имя / Name:** **www**
   - **Значение / Value:** **185.125.219.107**
   - **TTL:** 600 или 1 час.
3. Сохраните.

### Шаг 1.4. Подождать распространения DNS

Изменения могут применяться от нескольких минут до 24–48 часов. Проверка с вашего компьютера:

```bash
ping wishliststars.com
ping www.wishliststars.com
```

В ответе должен быть адрес **185.125.219.107**. Когда оба хоста пингуются на этот IP — переходите к настройке сервера.

---

## Часть 2. Настройка VPS: Nginx + Let's Encrypt

Подключитесь к серверу:

```bash
ssh -i ~/.ssh/id_ed25519_vps root@185.125.219.107
```

### Шаг 2.1. Установить Nginx и Certbot

```bash
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx
```

### Шаг 2.2. Освободить порт 80 для выдачи сертификата

Приложение должно слушать только 3000, порт 80 — для Nginx и проверки Let's Encrypt. Если на 80 что-то уже слушает — остановите. Для нашего приложения:

```bash
pm2 stop wishlist-api
```

(Позже снова запустите: приложение будет за Nginx на 3000.)

### Шаг 2.3. Получить сертификат Let's Encrypt

Подставьте **ваш реальный email** вместо `your@email.com`:

```bash
certbot certonly --standalone -d wishliststars.com -d www.wishliststars.com --non-interactive --agree-tos --email your@email.com
```

Если домен уже указывает на 185.125.219.107, команда создаст сертификаты в:
- `/etc/letsencrypt/live/wishliststars.com/fullchain.pem`
- `/etc/letsencrypt/live/wishliststars.com/privkey.pem`

(Они подходят и для www.)

### Шаг 2.4. Настроить Nginx (прокси на приложение)

Создайте конфиг:

```bash
cat > /etc/nginx/sites-available/wishliststars << 'EOF'
server {
    listen 80;
    server_name wishliststars.com www.wishliststars.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name wishliststars.com www.wishliststars.com;

    ssl_certificate     /etc/letsencrypt/live/wishliststars.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wishliststars.com/privkey.pem;

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

Включите сайт и отключите дефолтный:

```bash
ln -sf /etc/nginx/sites-available/wishliststars /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### Шаг 2.5. Запустить приложение и отключить его собственный SSL

Приложение должно слушать только **HTTP** на порту 3000 (HTTPS отдаёт Nginx).

```bash
cd /opt/wishlist-gift-v2
mv ssl ssl.bak 2>/dev/null || true
pm2 start wishlist-api
```

### Шаг 2.6. Обновить .env (APP_URL)

```bash
nano /opt/wishlist-gift-v2/.env
```

Установите:

```env
APP_URL=https://wishliststars.com
```

Сохраните (Ctrl+O, Enter, Ctrl+X) и перезапустите приложение:

```bash
pm2 restart wishlist-api
```

---

## Часть 2.7. Включить HTTPS (после настройки DNS в GoDaddy)

Сейчас домен **wishliststars.com** ещё не указывает на 185.125.219.107 (проверка Let's Encrypt не прошла). Как только в GoDaddy будут A-записи **@** и **www** → **185.125.219.107** и DNS обновится (проверьте: `ping wishliststars.com` показывает 185.125.219.107), на VPS выполните:

```bash
ssh -i ~/.ssh/id_ed25519_vps root@185.125.219.107
/opt/wishlist-gift-v2/scripts/enable-ssl-wishliststars.sh admin@wishliststars.com
```

Скрипт остановит nginx, получит сертификат Let's Encrypt, включит HTTPS в Nginx и запустит nginx снова. После этого сайт будет открываться по **https://wishliststars.com**.

---

## Часть 3. Проверка и бот

1. В браузере откройте **https://wishliststars.com** и **https://www.wishliststars.com** — должна открываться ваша веб-морда без ошибок сертификата.
2. В **@BotFather** для бота укажите Mini App (Menu Button / Web App URL): **https://wishliststars.com** (главная). Чтобы по прямой ссылке t.me/Bot/app?startapp=u2 даритель сразу видел подарки, можно указать **https://wishliststars.com/gift** — тогда откроется страница подарков с нужным slug.
3. После перезапуска приложения webhook для Telegram установится на `https://wishliststars.com/api/payments/telegram-webhook` (если в .env задан BOT_TOKEN и APP_URL).

---

## Продление сертификата

Let's Encrypt выдаёт сертификат на 90 дней. Продление:

```bash
certbot renew --quiet
systemctl reload nginx
```

Имеет смысл добавить в cron (например, раз в день в 3:00):

```bash
0 3 * * * certbot renew --quiet && systemctl reload nginx
```

---

## Краткая сводка

| Где | Что сделать |
|-----|-------------|
| **GoDaddy DNS** | A-запись **@** → 185.125.219.107 и **www** → 185.125.219.107 |
| **VPS** | Nginx на 80/443, certbot для wishliststars.com + www, прокси на 127.0.0.1:3000 |
| **.env** | APP_URL=https://wishliststars.com |
| **BotFather** | Mini App URL: https://wishliststars.com |

После этого сайт и Mini App работают по **https://wishliststars.com** с доверенным сертификатом.
