#!/bin/bash
# Включить HTTPS для wishliststars.com (запускать на VPS после того, как DNS указывает на этот сервер)
set -e
DOMAIN="wishliststars.com"
EMAIL="${1:-admin@wishliststars.com}"

echo "Остановка nginx..."
systemctl stop nginx

echo "Получение сертификата Let's Encrypt..."
certbot certonly --standalone -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"

echo "Настройка Nginx для HTTPS..."
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

echo "Запуск nginx..."
systemctl start nginx

echo "Готово. Откройте https://wishliststars.com"
