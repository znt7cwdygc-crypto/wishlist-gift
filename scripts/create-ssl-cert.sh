#!/bin/bash
# Генерация самоподписанного сертификата для HTTPS по IP (или домену).
# Запускать из корня проекта или указать путь. Сертификаты попадут в ./ssl/

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$ROOT/ssl"
CN="${1:-185.125.219.107}"

mkdir -p "$SSL_DIR"
cd "$SSL_DIR"

openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/CN=$CN"

chmod 600 key.pem
chmod 644 cert.pem
echo "✅ Сертификаты созданы в $SSL_DIR (CN=$CN)"
echo "   key.pem, cert.pem — укажите APP_URL=https://$CN:3000 и перезапустите сервер."
