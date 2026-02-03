// Model Page JavaScript
// Functions are available from app.js

// Tab management
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// Load wishlist
async function loadWishlist() {
    try {
        const items = await apiRequest('/wishlist');
        const grid = document.getElementById('wishlist-grid');
        
        if (items.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">🎁</div>
                    <div class="empty-state-title">Ваш вишлист пока пуст</div>
                    <div class="empty-state-text">Добавьте первый товар!</div>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = items.map(item => {
            const photo = item.photos?.[0] || '';
            const photoCount = item.photos?.length || 0;
            const priceInfo = formatPriceStars(item.totalStars, { compact: true });
            
            return `
                <div class="wishlist-item" onclick="editItem(${item.id})">
                    <div style="position: relative; height: 100%;">
                        ${photo ? `<img src="${photo}" alt="${item.name}" class="wishlist-item-image">` : '<div class="wishlist-item-image" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem;">🎁</div>'}
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
        
        updateProfileStats(items);
    } catch (error) {
        console.error('Error loading wishlist:', error);
    }
}

// Photo preview handling + сжатие (макс 800px, качество 0.8)
let selectedPhotos = [];

function resizeImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = function() {
            URL.revokeObjectURL(url);
            const MAX = 800;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = (h * MAX) / w; w = MAX; } else { w = (w * MAX) / h; h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        };
        img.src = url;
    });
}

function initPhotoPreview() {
    const photoInput = document.getElementById('item-photos');
    if (!photoInput) return;
    
    photoInput.addEventListener('change', async function(e) {
        const files = Array.from(e.target.files);
        selectedPhotos = [];
        
        const preview = document.getElementById('photo-preview');
        if (!preview) return;
        
        preview.innerHTML = '';
        
        for (const file of files) {
            const dataUrl = await resizeImage(file);
            selectedPhotos.push(dataUrl);
            const img = document.createElement('img');
            img.src = dataUrl;
            img.style.width = '100px';
            img.style.height = '100px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '8px';
            img.style.margin = '5px';
            preview.appendChild(img);
        }
    });
}

// Add item form handler
function initAddItemForm() {
    const form = document.getElementById('add-item-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('item-name').value;
        const description = document.getElementById('item-description').value;
        const url = document.getElementById('item-url').value;
        const price = parseFloat(document.getElementById('item-price').value);
        const currency = document.getElementById('item-currency').value;
        
        if (!name || !url || !price) {
            alert('Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        const stars = convertToStars(price, currency);
        
        try {
            const result = await apiRequest('/wishlist/items', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    description,
                    url,
                    price,
                    currency,
                    baseStars: stars.base,
                    feeStars: stars.fee,
                    totalStars: stars.total,
                    photos: selectedPhotos || []
                })
            });
            
            alert('Опубликовано!');
            form.reset();
            selectedPhotos = [];
            const preview = document.getElementById('photo-preview');
            if (preview) preview.innerHTML = '';
            await loadWishlist();
            updateProfileStats(await apiRequest('/wishlist').catch(() => []));
            showTab('wishlist');
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Ошибка при добавлении товара: ' + (error.message || 'Неизвестная ошибка'));
        }
    });
    
    // Price calculator
    const priceInput = document.getElementById('item-price');
    const currencySelect = document.getElementById('item-currency');
    
    if (priceInput) {
        priceInput.addEventListener('input', () => {
            const price = parseFloat(priceInput.value) || 0;
            const currency = currencySelect?.value || 'USD';
            const stars = convertToStars(price, currency);
            const starsAmount = document.getElementById('stars-amount');
            if (starsAmount) {
                starsAmount.textContent = formatNumber(stars.total);
            }
        });
    }
    
    if (currencySelect) {
        currencySelect.addEventListener('change', () => {
            if (priceInput) {
                priceInput.dispatchEvent(new Event('input'));
            }
        });
    }
}

// Редактирование/удаление товара
let currentEditItem = null;

async function editItem(itemId) {
    try {
        const items = await apiRequest('/wishlist');
        const item = items.find(i => i.id === itemId);
        if (!item) {
            alert('Товар не найден');
            return;
        }
        currentEditItem = item;
        
        // Заполнить форму
        document.getElementById('edit-item-id').value = item.id;
        document.getElementById('edit-item-name').value = item.name || '';
        document.getElementById('edit-item-description').value = item.description || '';
        document.getElementById('edit-item-price').value = item.price || '';
        document.getElementById('edit-item-currency').value = item.currency || 'USD';
        document.getElementById('edit-item-url').value = item.url || '';
        
        // Показать модалку
        document.getElementById('edit-modal').classList.remove('hidden');
    } catch (e) {
        console.error('Error editing item:', e);
        alert('Ошибка: ' + e.message);
    }
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
    currentEditItem = null;
}

async function saveEditItem(e) {
    e.preventDefault();
    const itemId = document.getElementById('edit-item-id').value;
    const name = document.getElementById('edit-item-name').value;
    const description = document.getElementById('edit-item-description').value;
    const price = parseFloat(document.getElementById('edit-item-price').value);
    const currency = document.getElementById('edit-item-currency').value;
    const url = document.getElementById('edit-item-url').value;
    
    const stars = convertToStars(price, currency);
    
    try {
        await apiRequest(`/wishlist/items/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name, description, url, price, currency,
                baseStars: stars.base, feeStars: stars.fee, totalStars: stars.total
            })
        });
        alert('Сохранено!');
        closeEditModal();
        await loadWishlist();
    } catch (e) {
        console.error('Error saving item:', e);
        alert('Ошибка: ' + e.message);
    }
}

async function deleteItemFromModal() {
    if (!currentEditItem) return;
    if (!confirm('Удалить этот товар?')) return;
    try {
        await apiRequest(`/wishlist/items/${currentEditItem.id}`, { method: 'DELETE' });
        alert('Товар удалён');
        closeEditModal();
        await loadWishlist();
    } catch (e) {
        console.error('Error deleting item:', e);
        alert('Ошибка при удалении: ' + e.message);
    }
}

// Инициализация формы редактирования
function initEditForm() {
    const form = document.getElementById('edit-item-form');
    if (form) form.addEventListener('submit', saveEditItem);
}

// Copy link (deep link для бота: t.me/Bot?start=slug)
function copyLink() {
    const el = document.getElementById('public-link');
    const link = el?.dataset?.fullUrl || el?.textContent?.replace(/^t\.me/, 'https://t.me') || 'https://t.me/WishlistGiftBot?start=me';
    navigator.clipboard.writeText(link).then(() => {
        alert('Ссылка скопирована!');
    });
}

// Profile storage (localStorage for MVP)
const PROFILE_KEY = 'wishlist_model_profile';

function loadProfile() {
    try {
        const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
        const nameEl = document.getElementById('model-name');
        const bioEl = document.getElementById('model-bio');
        if (nameEl) nameEl.value = p.name || '';
        if (bioEl) bioEl.value = p.bio || '';
        if (p.avatar) {
            window._profileAvatar = p.avatar;
            const av = document.getElementById('model-avatar');
            if (av) av.innerHTML = `<img src="${p.avatar}" alt="">`;
        }
        if (p.cover) {
            window._profileCover = p.cover;
            const coverImg = document.getElementById('model-cover-img');
            if (coverImg) {
                coverImg.src = p.cover;
                coverImg.style.display = 'block';
            }
        }
    } catch (e) {}
}

function saveProfile() {
    const p = {
        name: document.getElementById('model-name')?.value || '',
        bio: document.getElementById('model-bio')?.value || '',
        avatar: window._profileAvatar || null,
        cover: window._profileCover || null
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

function initProfileEdit() {
    document.getElementById('model-name')?.addEventListener('blur', saveProfile);
    document.getElementById('model-bio')?.addEventListener('blur', saveProfile);
    
    document.getElementById('model-avatar-input')?.addEventListener('change', function(e) {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = function() {
            window._profileAvatar = r.result;
            const av = document.getElementById('model-avatar');
            if (av) av.innerHTML = `<img src="${r.result}" alt="">`;
            saveProfile();
        };
        r.readAsDataURL(f);
    });
    
    document.getElementById('model-cover-input')?.addEventListener('change', function(e) {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = function() {
            window._profileCover = r.result;
            const img = document.getElementById('model-cover-img');
            if (img) {
                img.src = r.result;
                img.style.display = 'block';
            }
            saveProfile();
        };
        r.readAsDataURL(f);
    });
}

function updateProfileStats(items) {
    const itemsArr = Array.isArray(items) ? items : [];
    const giftsEl = document.getElementById('stats-gifts');
    const itemsEl = document.getElementById('stats-items');
    const starsEl = document.getElementById('stats-stars');
    if (giftsEl) giftsEl.textContent = '0';
    if (itemsEl) itemsEl.textContent = itemsArr.length;
    if (starsEl) starsEl.textContent = '0 ⭐';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    initProfileEdit();
    loadWishlist().then(() => {
        apiRequest('/wishlist').then(items => {
            updateProfileStats(items || []);
        }).catch(() => updateProfileStats([]));
    });
    initPhotoPreview();
    initAddItemForm();
    initEditForm();
});

