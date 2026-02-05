#!/bin/bash
# Деплой приложения и БД на VPS (185.125.219.107)
# — упаковка кода, копирование на сервер, npm install, схема БД + seed, перезапуск PM2
# Использование: ./deploy-vps.sh
# Требуется: SSH-ключ ~/.ssh/id_ed25519_vps и доступ root@185.125.219.107

set -e
cd "$(dirname "$0")"

VPS_HOST="${VPS_HOST:-185.125.219.107}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519_vps}"
REMOTE_DIR="${REMOTE_DIR:-/opt/wishlist-gift-v2}"
PM2_NAME="${PM2_NAME:-wishlist-api}"

echo "📦 Wishlist Gift — деплой на сервер $VPS_USER@$VPS_HOST"
echo "   Единственная рабочая версия: $REMOTE_DIR (все деплои идут сюда)"
echo ""

# 1. Упаковка (без node_modules, .git, .env)
ARCHIVE="/tmp/wishlist-gift-v2-$(date +%s).tar.gz"
echo "1/5 Создаю архив..."
# COPYFILE_DISABLE=1 убирает macOS xattr из tar (предупреждения на Linux-сервере)
COPYFILE_DISABLE=1 tar --exclude='node_modules' --exclude='.git' --exclude='.env' --exclude='*.log' -czf "$ARCHIVE" .
echo "   Готово: $ARCHIVE"

# 2. Копирование на сервер
echo ""
echo "2/5 Копирую на сервер..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$ARCHIVE" "$VPS_USER@$VPS_HOST:/tmp/wishlist-gift-deploy.tar.gz"
rm -f "$ARCHIVE"

# 3. На сервере: распаковка (без перезаписи .env), установка, миграции, seed, PM2
echo ""
echo "3/5 Распаковываю и устанавливаю зависимости..."
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" "mkdir -p $REMOTE_DIR && cd $REMOTE_DIR && tar -xzf /tmp/wishlist-gift-deploy.tar.gz && rm -f /tmp/wishlist-gift-deploy.tar.gz"

echo "4/5 Применяю схему БД, seed и тестовые подарки Nikola..."
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" "cd $REMOTE_DIR && npm install --production 2>/dev/null || npm install && node scripts/init-db.js 2>/dev/null; node scripts/run-seed.js 2>/dev/null || true; node scripts/seed-nikola-test-gifts.js 2>/dev/null || true"

echo "5/5 Перезапускаю приложение (PM2)..."
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" "cd $REMOTE_DIR && (pm2 describe $PM2_NAME >/dev/null 2>&1 && pm2 restart $PM2_NAME --update-env || pm2 start server/index.js --name $PM2_NAME) && pm2 save"

echo ""
echo "✅ Деплой завершён."
echo "   Приложение: http://$VPS_HOST:3000"
echo "   API:        http://$VPS_HOST:3000/api"
echo "   Логи:       ssh -i $SSH_KEY $VPS_USER@$VPS_HOST 'pm2 logs $PM2_NAME'"
echo ""
# Предупреждение, если .env на сервере нет (первый деплой)
if ! ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" "test -f $REMOTE_DIR/.env" 2>/dev/null; then
    echo "⚠️  На сервере нет файла .env. Создайте его (см. ЧТО_ДЕЛАТЬ_ПО_ПУНКТАМ.md, шаг 2.3), затем: pm2 restart $PM2_NAME"
fi
