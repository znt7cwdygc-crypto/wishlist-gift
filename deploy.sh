#!/bin/bash
# Деплой: git push → Render автоматически подхватит
# Использование: ./deploy.sh [commit message]

set -e
cd "$(dirname "$0")"

MSG="${1:-Deploy to Render}"

echo "📦 Wishlist Gift — deploy"
echo ""

# Есть ли изменения?
if [[ -n $(git status -s) ]]; then
  echo "Добавляю изменения..."
  git add -A
  git commit -m "$MSG"
fi

echo "Отправляю на GitHub..."
if git push origin main 2>/dev/null; then
  echo ""
  echo "✅ Готово. Render автоматически задеплоит в течение 1–3 мин."
  echo "   https://wishlist-gift.onrender.com"
else
  echo ""
  echo "❌ Ошибка push. Если нужна авторизация:"
  echo "   git push https://znt7cwdygc-crypto:ВАШ_ТОКЕН@github.com/znt7cwdygc-crypto/wishlist-gift.git main"
fi
