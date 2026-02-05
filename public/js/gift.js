/**
 * Gift Flow — Даритель
 * Поток: список → подтверждение → оплата → готово
 */

let currentGift = null;
let modelInfo = null;
let wishlistItems = [];
let currentSlug = 'me'; // slug текущего вишлиста (для ссылки «поделиться»)
const GIFT_PAGE_SIZE = 10;
let giftPage = 1;

// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;

// Показать экран (при возврате на список обновляем подарки — даритель видит актуальный список)
function showScreen(screenId) {
    const wasList = document.getElementById('screen-list')?.classList.contains('active');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');
    if (screenId === 'list' && wasList === false) loadWishlist();
}

// Поиск вишлиста по ID пользователя или slug (me, u2 и т.д.)
async function searchWishlist() {
    const input = document.getElementById('search-input');
    const raw = (input && input.value && input.value.trim()) || '';
    if (!raw) {
        if (tg?.showAlert) tg.showAlert('Введите ID или slug пользователя');
        else alert('Введите ID или slug пользователя');
        return;
    }
    const idNum = parseInt(raw, 10);
    const slug = (!isNaN(idNum) && idNum > 0) ? 'u' + idNum : raw;
    currentSlug = slug;
    try {
        document.getElementById('gifts-list').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⏳</div>
                <div class="empty-title">Загрузка...</div>
            </div>
        `;
        const [profileRes, listRes] = await Promise.all([
            apiRequest(`/models/${slug}`).catch(() => null),
            apiRequest(`/wishlist/by-slug/${slug}`)
        ]);
        modelInfo = profileRes || {};
        wishlistItems = Array.isArray(listRes) ? listRes : [];
        giftPage = 1;
        document.getElementById('model-name').textContent = modelInfo.firstName || 'Вишлист';
        document.getElementById('model-bio').textContent = modelInfo.profile?.bio || '';
        if (modelInfo.avatar) {
            document.getElementById('model-avatar').innerHTML = `<img src="${modelInfo.avatar}" alt="">`;
        } else {
            document.getElementById('model-avatar').innerHTML = '👩‍💼';
        }
        if (input) input.value = '';
        renderGifts();
    } catch (e) {
        console.error('Search wishlist error:', e);
        document.getElementById('gifts-list').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😕</div>
                <div class="empty-title">Вишлист не найден</div>
                <div class="empty-text">Проверьте ID или slug (например 2, u2, me)</div>
            </div>
        `;
        if (tg?.showAlert) tg.showAlert('Вишлист не найден. Проверьте ID или slug.');
    }
}

// Загрузить данные модели и вишлист (параллельно — быстрее для дарителя)
async function loadWishlist() {
    try {
        // Slug: из URL (?slug=u2), из hash (#slug=u2), или из Telegram start_param (t.me/Bot/app?startapp=u2)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
        let slug = urlParams.get('slug') || hashParams.get('slug') || tg?.initDataUnsafe?.start_param;
        if (!slug && tg?.initData && typeof tg.initData === 'string') {
          const initParams = new URLSearchParams(tg.initData);
          slug = initParams.get('start_param');
        }
        slug = (slug && String(slug).trim()) || 'me';
        currentSlug = slug;

        // Профиль и подарки одним запросом — даритель сразу видит актуальный список
        const [profileRes, listRes] = await Promise.all([
            apiRequest(`/models/${slug}`).catch(() => null),
            apiRequest(`/wishlist/by-slug/${slug}`)
        ]);
        modelInfo = profileRes || {};
        wishlistItems = Array.isArray(listRes) ? listRes : [];
        giftPage = 1;

        document.getElementById('model-name').textContent = modelInfo.firstName || 'Вишлист';
        document.getElementById('model-bio').textContent = modelInfo.profile?.bio || '';
        if (modelInfo.avatar) {
            document.getElementById('model-avatar').innerHTML = `<img src="${modelInfo.avatar}" alt="">`;
        } else {
            document.getElementById('model-avatar').innerHTML = '👩‍💼';
        }

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

// Отрисовать список подарков (с пагинацией)
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
    
    const to = giftPage * GIFT_PAGE_SIZE;
    const visible = wishlistItems.slice(0, to);
    const hasMore = wishlistItems.length > to;
    
    container.innerHTML = visible.map(item => {
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
    }).join('') + (hasMore ? `
        <button type="button" class="btn btn-ghost pagination-more" onclick="giftPage++; renderGifts();">
            Показать ещё (${wishlistItems.length - to} из ${wishlistItems.length})
        </button>
    ` : '');
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

        // Информационное окно: в чате появится инвойс
        const infoText = 'В чате появится инвойс. Нажмите Pay в сообщении от бота.';
        if (tg?.showAlert) {
            tg.showAlert(infoText);
        } else {
            alert(infoText);
        }
        // Закрыть веб-апп через 1.5 сек
        setTimeout(() => {
            if (tg?.close) tg.close();
        }, 1500);

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

// Поделиться вишлистом (прямая ссылка на Mini App — открывает подарки сразу)
async function shareWishlist() {
    let link = `https://t.me/WishlistttGiftBot/app?startapp=${currentSlug}`;
    try {
        const cfg = await fetch((window.API_BASE_URL || '/api') + '/config').then(r => r.json());
        const bot = (cfg.botUsername || 'WishlistttGiftBot').trim();
        link = `https://t.me/${bot}/app?startapp=${currentSlug}`;
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

// Авторизация (для оплаты — donor_telegram_id берётся из токена)
async function ensureAuth() {
    if (!tg?.initData) return;
    if (localStorage.getItem('token')) return;
    try {
        const res = await fetch((window.API_BASE_URL || '/api') + '/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
        });
        const data = await res.json();
        if (data.token) localStorage.setItem('token', data.token);
    } catch (_) {}
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    if (tg) {
        tg.ready();
        tg.expand();
    }
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') searchWishlist();
        });
    }
    await ensureAuth();
    loadWishlist();
});
