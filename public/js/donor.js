// Donor Page JavaScript
// Functions are available from app.js

let currentModelId = null;
let currentGiftItem = null;

// Load model info
async function loadModelInfo() {
    try {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const publicLink = pathParts[pathParts.length - 1];
        const link = (publicLink && publicLink !== 'donor') ? publicLink : 'me';
        
        const model = await apiRequest(`/models/${link}`).catch(() => null);
        
        const name = model?.firstName || 'Модель';
        const bio = model?.profile?.bio || '';
        
        document.getElementById('model-name').textContent = name;
        document.getElementById('model-bio').textContent = bio;
        
        if (model?.avatar) {
            document.getElementById('model-avatar').innerHTML = `<img src="${model.avatar}" alt="${name}">`;
        }
        
        const coverImg = document.getElementById('model-cover-img');
        if (model?.profile?.banner && coverImg) {
            coverImg.src = model.profile.banner;
            coverImg.style.display = 'block';
        }
        
        currentModelId = model?.id || 1;
        loadWishlistItems();
    } catch (error) {
        console.error('Error loading model info:', error);
        currentModelId = 1;
        loadWishlistItems();
    }
}

// Load wishlist items
async function loadWishlistItems() {
    try {
        const items = await apiRequest(`/wishlist/model/${currentModelId || 1}`);
        const container = document.getElementById('wishlist-items');
        
        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem;">
                    <div class="empty-state-icon">🎁</div>
                    <div class="empty-state-title">Вишлист пока пуст</div>
                    <div class="empty-state-text">Модель еще не добавила товары</div>
                </div>
            `;
            document.getElementById('stats-items').textContent = '0';
            return;
        }
        
        container.innerHTML = items.map(item => {
            const photo = item.photos?.[0] || '';
            const photoCount = item.photos?.length || 0;
            const priceInfo = formatPriceStars(item.totalStars, { compact: true });
            
            const imgHtml = photo 
                ? `<img src="${photo}" alt="${item.name}" class="wishlist-item-image">`
                : '<div class="wishlist-item-image" style="background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;height:100%;font-size:2rem">🎁</div>';
            
            return `
                <div class="wishlist-item" onclick="openItemModal(${item.id})">
                    <div style="position:relative;height:100%">
                        ${imgHtml}
                        ${photoCount > 1 ? `<span class="photo-count-badge">📷 ${photoCount}</span>` : ''}
                    </div>
                    <div class="wishlist-item-info">
                        <div class="wishlist-item-name">${item.name}</div>
                        <div class="wishlist-item-price">
                            <div class="price-main">${priceInfo.full}</div>
                            <div class="price-usd">${priceInfo.usd}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        window.wishlistItems = items;
        
        document.getElementById('stats-items').textContent = items.length;
    } catch (error) {
        console.error('Error loading wishlist:', error);
    }
}

// Open item modal
function openItemModal(itemId) {
    const item = window.wishlistItems?.find(i => i.id === itemId);
    if (!item) return;
    
    currentGiftItem = item;
    const photo = item.photos?.[0] || '';
    const priceInfo = formatPriceStars(item.totalStars, { showDollar: true });
    
    document.getElementById('modal-item-name').textContent = item.name;
    document.getElementById('modal-item-image').src = photo;
    document.getElementById('modal-item-description').textContent = item.description || 'Нет описания';
    document.getElementById('modal-item-total').innerHTML = `
        ${priceInfo.stars} ⭐ <span class="text-secondary">${priceInfo.usd}</span>
    `;
    document.getElementById('modal-item-link').href = item.url;
    document.getElementById('item-modal').classList.remove('hidden');
}

// Close modal
function closeModal() {
    document.getElementById('item-modal').classList.add('hidden');
}

// Initiate payment
async function initiatePayment() {
    if (!currentGiftItem) return;
    
    try {
        const result = await apiRequest('/payments/initiate', {
            method: 'POST',
            body: JSON.stringify({ itemId: currentGiftItem.id })
        });
        
        // In real app, this would open Telegram Payments
        alert('Платеж будет обработан через Telegram Payments');
        closeModal();
    } catch (error) {
        alert('Ошибка при инициализации платежа');
    }
}

// Search and sort
document.getElementById('search-items')?.addEventListener('input', (e) => {
    // TODO: Implement search
});

document.getElementById('sort-items')?.addEventListener('change', (e) => {
    // TODO: Implement sort
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadModelInfo();
});

