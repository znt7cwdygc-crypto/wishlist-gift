/**
 * Gift Flow — Даритель
 * Поток: список → подтверждение → оплата → готово
 */

let currentGift = null;
let modelInfo = null;
let wishlistItems = [];

// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;

// Показать экран
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
}

// Загрузить данные модели и вишлист
async function loadWishlist() {
    try {
        // Получаем slug из URL или startParam
        const urlParams = new URLSearchParams(window.location.search);
        const slug = tg?.initDataUnsafe?.start_param || urlParams.get('slug') || 'me';
        
        // Загружаем профиль модели
        try {
            modelInfo = await apiRequest(`/models/${slug}`);
            document.getElementById('model-name').textContent = modelInfo.firstName || 'Вишлист';
            document.getElementById('model-bio').textContent = modelInfo.profile?.bio || '';
            if (modelInfo.avatar) {
                document.getElementById('model-avatar').innerHTML = `<img src="${modelInfo.avatar}" alt="">`;
            }
        } catch (e) {
            document.getElementById('model-name').textContent = 'Вишлист';
        }
        
        // Загружаем товары
        wishlistItems = await apiRequest('/wishlist');
        renderGifts();
    } catch (error) {
        console.error('Error loading wishlist:', error);
        document.getElementById('gifts-list').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😕</div>
                <div class="empty-title">Не удалось загрузить</div>
                <div class="empty-text">Попробуйте позже</div>
            </div>
        `;
    }
}

// Отрисовать список подарков
function renderGifts() {
    const container = document.getElementById('gifts-list');
    
    if (wishlistItems.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎁</div>
                <div class="empty-title">Вишлист пуст</div>
                <div class="empty-text">Подарки ещё не добавлены</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = wishlistItems.map(item => {
        const photo = item.photos?.[0];
        const status = item.status || 'available';
        const isGifted = status === 'gifted';
        const isReserved = status === 'reserved';
        
        const statusLabels = {
            available: 'Свободно',
            reserved: 'Зарезервировано',
            gifted: 'Подарено'
        };
        
        return `
            <div class="gift-card ${isGifted ? 'gifted' : ''}">
                <div class="gift-image">
                    ${photo ? `<img src="${photo}" alt="">` : '🎁'}
                </div>
                <div class="gift-content">
                    <div class="gift-name">${escapeHtml(item.name)}</div>
                    <div class="gift-description">${escapeHtml(item.description || '')}</div>
                    <div class="gift-footer">
                        <div class="gift-price">${item.totalStars} ⭐</div>
                        ${isGifted || isReserved 
                            ? `<span class="gift-status ${status}">${statusLabels[status]}</span>`
                            : `<button class="gift-btn" onclick="selectGift(${item.id})">Подарить</button>`
                        }
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Выбрать подарок
function selectGift(itemId) {
    currentGift = wishlistItems.find(i => i.id === itemId);
    if (!currentGift) return;
    
    const photo = currentGift.photos?.[0];
    document.getElementById('confirm-image').innerHTML = photo ? `<img src="${photo}" alt="">` : '🎁';
    document.getElementById('confirm-name').textContent = currentGift.name;
    document.getElementById('confirm-price').textContent = `${currentGift.totalStars} ⭐`;
    document.getElementById('gift-message').value = '';
    
    showScreen('confirm');
}

// Перейти к оплате
async function proceedToPayment() {
    if (!currentGift) return;
    
    const message = document.getElementById('gift-message').value.trim();
    
    try {
        // Создаём заказ (резерв)
        const order = await apiRequest('/orders', {
            method: 'POST',
            body: JSON.stringify({
                item_id: currentGift.id,
                model_id: modelInfo?.id || 1,
                donor_telegram_id: tg?.initDataUnsafe?.user?.id || 0,
                donor_username: tg?.initDataUnsafe?.user?.username || '',
                amount_xtr: currentGift.totalStars,
                message: message
            })
        });
        
        // Запрашиваем создание инвойса
        await apiRequest('/payments/invoice', {
            method: 'POST',
            body: JSON.stringify({
                item_id: currentGift.id,
                order_id: order.order_id,
                amount_xtr: currentGift.totalStars,
                title: currentGift.name
            })
        });
        
        // В реальном приложении бот отправит Invoice в чат
        // Для демо показываем экран успеха
        showSuccessScreen(message);
        
    } catch (error) {
        console.error('Payment error:', error);
        alert('Ошибка: ' + (error.message || 'Не удалось создать заказ'));
    }
}

// Показать экран успеха
function showSuccessScreen(message) {
    document.getElementById('success-message').textContent = 
        message ? 'Сообщение доставлено' : 'Подарок отправлен';
    
    // Обновляем статус в списке
    if (currentGift) {
        currentGift.status = 'gifted';
    }
    
    showScreen('success');
}

// Поделиться вишлистом
async function shareWishlist() {
    let link = 'https://t.me/WishlistGiftBot?start=me';
    try {
        const cfg = await fetch('/api/config').then(r => r.json());
        if (cfg.shareLink) link = cfg.shareLink;
    } catch (_) {}
    
    if (navigator.share) {
        navigator.share({
            title: 'Вишлист',
            text: 'Посмотри мой вишлист!',
            url: link
        });
    } else if (tg) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}`);
    } else {
        navigator.clipboard.writeText(link);
        alert('Ссылка скопирована!');
    }
}

// Утилиты
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    if (tg) {
        tg.ready();
        tg.expand();
    }
    loadWishlist();
});
