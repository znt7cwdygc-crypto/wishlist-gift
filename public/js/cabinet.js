/**
 * Cabinet — Кабинет модели
 * Вкладки: вишлист, поступления, баланс, настройки
 */

const tg = window.Telegram?.WebApp;
const STORAGE_KEY = 'wishlist_cabinet';

let myGifts = [];
let events = [];
let balance = { pending: 0, available: 0, withdrawn: 0 };
let settings = { name: '', bio: '', isPublic: true, invites: [] };
let editingGiftId = null;
let selectedPhoto = null;

// =====================================================
// Навигация
// =====================================================

function showTab(tabId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    document.getElementById('main-nav').classList.remove('hidden');

    if (tabId === 'balance') loadBalance();
    if (tabId === 'wishlist') loadMyGifts();
}

function showAddGift(giftId = null) {
    editingGiftId = giftId;
    selectedPhoto = null;
    
    const title = document.getElementById('add-gift-title');
    const deleteBtn = document.getElementById('delete-gift-btn');
    const form = document.getElementById('gift-form');
    
    if (giftId) {
        const gift = myGifts.find(g => g.id === giftId);
        if (gift) {
            title.textContent = 'Редактировать';
            document.getElementById('edit-gift-id').value = gift.id;
            document.getElementById('gift-name').value = gift.name || '';
            document.getElementById('gift-description').value = gift.description || '';
            document.getElementById('gift-price').value = gift.price || '';
            document.getElementById('gift-currency').value = gift.currency || 'USD';
            document.getElementById('gift-url').value = gift.url || '';
            updateStarsPreview();
            
            if (gift.photos?.[0]) {
                selectedPhoto = gift.photos[0];
                document.getElementById('photo-preview').innerHTML = `<img src="${gift.photos[0]}" alt="">`;
            }
            
            deleteBtn.classList.remove('hidden');
        }
    } else {
        title.textContent = 'Новый подарок';
        form.reset();
        document.getElementById('photo-preview').innerHTML = '';
        document.getElementById('stars-preview').textContent = '0';
        deleteBtn.classList.add('hidden');
    }
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-add-gift').classList.add('active');
    document.getElementById('main-nav').classList.add('hidden');
}

function closeAddGift() {
    editingGiftId = null;
    showTab('wishlist');
}

// =====================================================
// Вишлист
// =====================================================

async function loadMyGifts() {
    try {
        myGifts = await apiRequest('/wishlist');
        renderMyGifts();
    } catch (e) {
        console.error('Error loading gifts:', e);
    }
}

function renderMyGifts() {
    const container = document.getElementById('my-gifts-list');
    
    if (myGifts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎁</div>
                <div class="empty-title">Пока пусто</div>
                <div class="empty-text">Добавьте первый подарок</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = myGifts.map(item => {
        const photo = item.photos?.[0];
        const status = item.status || 'available';
        const statusLabels = {
            available: 'Свободно',
            reserved: 'Зарезервировано',
            gifted: 'Подарено'
        };
        
        return `
            <div class="gift-card" onclick="showAddGift(${item.id})">
                <div class="gift-image">
                    ${photo ? `<img src="${photo}" alt="">` : '🎁'}
                </div>
                <div class="gift-content">
                    <div class="gift-name">${escapeHtml(item.name)}</div>
                    <div class="gift-description">${escapeHtml(item.description || '')}</div>
                    <div class="gift-footer">
                        <div class="gift-price">${item.totalStars} ⭐</div>
                        <span class="gift-status ${status}">${statusLabels[status]}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Форма добавления/редактирования
function initGiftForm() {
    const form = document.getElementById('gift-form');
    const priceInput = document.getElementById('gift-price');
    const currencySelect = document.getElementById('gift-currency');
    const photoInput = document.getElementById('gift-photo');
    const deleteBtn = document.getElementById('delete-gift-btn');
    
    form.addEventListener('submit', saveGift);
    priceInput.addEventListener('input', updateStarsPreview);
    currencySelect.addEventListener('change', updateStarsPreview);
    
    photoInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        selectedPhoto = await resizeImage(file);
        document.getElementById('photo-preview').innerHTML = `<img src="${selectedPhoto}" alt="">`;
    });
    
    deleteBtn.addEventListener('click', deleteGift);
}

function updateStarsPreview() {
    const price = parseFloat(document.getElementById('gift-price').value) || 0;
    const currency = document.getElementById('gift-currency').value;
    const stars = convertToStars(price, currency);
    document.getElementById('stars-preview').textContent = formatNumber(stars.total);
}

async function saveGift(e) {
    e.preventDefault();
    
    const name = document.getElementById('gift-name').value;
    const description = document.getElementById('gift-description').value;
    const price = parseFloat(document.getElementById('gift-price').value);
    const currency = document.getElementById('gift-currency').value;
    const url = document.getElementById('gift-url').value;
    
    if (!name || !price || !url) {
        alert('Заполните обязательные поля');
        return;
    }
    
    const stars = convertToStars(price, currency);
    const data = {
        name,
        description,
        url,
        price,
        currency,
        baseStars: stars.base,
        feeStars: stars.fee,
        totalStars: stars.total,
        photos: selectedPhoto ? [selectedPhoto] : []
    };
    
    try {
        if (editingGiftId) {
            await apiRequest(`/wishlist/items/${editingGiftId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            await apiRequest('/wishlist/items', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }
        
        await loadMyGifts();
        closeAddGift();
    } catch (e) {
        console.error('Error saving gift:', e);
        alert('Ошибка: ' + (e.message || 'Не удалось сохранить'));
    }
}

async function deleteGift() {
    if (!editingGiftId) return;
    if (!confirm('Удалить этот подарок?')) return;
    
    try {
        await apiRequest(`/wishlist/items/${editingGiftId}`, { method: 'DELETE' });
        await loadMyGifts();
        closeAddGift();
    } catch (e) {
        console.error('Error deleting gift:', e);
        alert('Ошибка: ' + (e.message || 'Не удалось удалить'));
    }
}

// =====================================================
// Поступления
// =====================================================

async function loadEvents() {
    try {
        const data = await apiRequest('/orders/received/list');
        events = Array.isArray(data) ? data : [];
    } catch (e) {
        events = [];
    }
    renderEvents();
}

function renderEvents() {
    const container = document.getElementById('events-feed');
    
    if (events.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💫</div>
                <div class="empty-title">Пока нет поступлений</div>
                <div class="empty-text">Поделитесь ссылкой на вишлист</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = events.map(ev => `
        <div class="feed-item">
            <div class="feed-icon">🎁</div>
            <div class="feed-content">
                <div class="feed-title">${escapeHtml(ev.gift)}</div>
                <div class="feed-meta">от ${escapeHtml(ev.from)}</div>
                ${ev.message ? `<div class="feed-message">"${escapeHtml(ev.message)}"</div>` : ''}
            </div>
            <div class="feed-amount">${ev.amount} ⭐</div>
        </div>
    `).join('');
}

function initFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // TODO: фильтрация по дате
        });
    });
}

// =====================================================
// Баланс
// =====================================================

async function loadBalance() {
    try {
        const profile = await apiRequest('/models/me');
        if (profile?.balance) {
            balance = {
                pending: profile.balance.pending ?? 0,
                available: profile.balance.available ?? 0,
                withdrawn: profile.balance.withdrawn ?? 0
            };
        } else {
            balance = { pending: 0, available: 0, withdrawn: 0 };
        }
    } catch (e) {
        balance = { pending: 0, available: 0, withdrawn: 0 };
    }
    renderBalance();
}

function renderBalance() {
    document.getElementById('balance-pending').textContent = `${balance.pending} ⭐`;
    document.getElementById('balance-available').textContent = `${balance.available} ⭐`;
    document.getElementById('balance-withdrawn').textContent = `${balance.withdrawn} ⭐`;
    
    const withdrawBtn = document.getElementById('withdraw-btn');
    const withdrawHint = document.getElementById('withdraw-hint');
    const minWithdraw = 1000;
    
    if (balance.available >= minWithdraw) {
        withdrawBtn.disabled = false;
        withdrawHint.textContent = '';
    } else {
        withdrawBtn.disabled = true;
        const remaining = minWithdraw - balance.available;
        withdrawHint.textContent = `Ещё ${remaining} ⭐ до вывода`;
    }
}

// =====================================================
// Настройки
// =====================================================

async function loadSettings() {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    settings = stored.settings || { name: '', bio: '', isPublic: true, invites: [] };
    
    try {
        const profile = await apiRequest('/models/me');
        if (profile) {
            settings.name = profile.firstName || '';
            settings.bio = profile.profile?.bio || '';
            document.getElementById('settings-name').value = profile.firstName || '';
            document.getElementById('settings-bio').value = profile.profile?.bio || '';
        } else {
            document.getElementById('settings-name').value = settings.name || '';
            document.getElementById('settings-bio').value = settings.bio || '';
        }
    } catch (_) {
        document.getElementById('settings-name').value = settings.name || '';
        document.getElementById('settings-bio').value = settings.bio || '';
    }
    
    const toggle = document.getElementById('privacy-toggle');
    if (settings.isPublic) {
        toggle.classList.add('active');
        document.getElementById('invites-section').classList.add('hidden');
    } else {
        toggle.classList.remove('active');
        document.getElementById('invites-section').classList.remove('hidden');
    }
    
    renderInvites();
}

async function saveSettings() {
    settings.name = document.getElementById('settings-name').value;
    settings.bio = document.getElementById('settings-bio').value;
    
    try {
        await apiRequest('/models/me', {
            method: 'PUT',
            body: JSON.stringify({
                firstName: settings.name,
                bio: settings.bio
            })
        });
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        stored.settings = settings;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        alert('Сохранено!');
    } catch (e) {
        alert('Ошибка: ' + (e.message || 'Не удалось сохранить'));
    }
}

function togglePrivacy() {
    settings.isPublic = !settings.isPublic;
    
    const toggle = document.getElementById('privacy-toggle');
    const invitesSection = document.getElementById('invites-section');
    
    if (settings.isPublic) {
        toggle.classList.add('active');
        invitesSection.classList.add('hidden');
    } else {
        toggle.classList.remove('active');
        invitesSection.classList.remove('hidden');
    }
    
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    stored.settings = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

function createInvite() {
    const token = generateToken(12);
    const invite = {
        token,
        link: `t.me/WishlistttGiftBot?start=${token}`,
        createdAt: new Date().toISOString()
    };
    
    settings.invites = settings.invites || [];
    settings.invites.push(invite);
    
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    stored.settings = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    
    renderInvites();
}

function revokeInvite(token) {
    settings.invites = (settings.invites || []).filter(i => i.token !== token);
    
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    stored.settings = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    
    renderInvites();
}

function renderInvites() {
    const container = document.getElementById('invites-list');
    const invites = settings.invites || [];
    
    if (invites.length === 0) {
        container.innerHTML = '<div class="text-sm text-secondary">Нет активных ссылок</div>';
        return;
    }
    
    container.innerHTML = invites.map(inv => `
        <div class="invite-item">
            <div class="invite-link">${inv.link}</div>
            <button class="invite-revoke" onclick="revokeInvite('${inv.token}')">Отозвать</button>
        </div>
    `).join('');
}

// =====================================================
// Копирование ссылки
// =====================================================

async function copyLink() {
    let link = 'https://t.me/WishlistttGiftBot/app?startapp=me';
    try {
        const profile = await apiRequest('/models/me').catch(() => null);
        const cfg = await fetch((window.API_BASE_URL || '/api') + '/config').then(r => r.json());
        const bot = (cfg.botUsername || 'WishlistttGiftBot').trim().replace(/^@/, '');
        const slug = (profile?.profile?.publicSlug || profile?.profile?.publicLink || 'me').trim();
        link = `https://t.me/${bot}/app?startapp=${slug}`;
        const el = document.getElementById('public-link');
        if (el) {
            el.textContent = link.replace('https://', '');
            el.title = link;
        }
    } catch (_) {}

    let copied = false;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(link);
            copied = true;
        }
    } catch (_) {}
    if (!copied) {
        const ta = document.createElement('textarea');
        ta.value = link;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, link.length);
        try {
            copied = document.execCommand('copy');
        } catch (_) {}
        document.body.removeChild(ta);
    }
    if (copied && tg?.showAlert) {
        tg.showAlert('Ссылка скопирована');
    } else if (copied) {
        alert('Ссылка скопирована!');
    } else if (tg?.showPopup) {
        tg.showPopup({ title: 'Ссылка на вишлист', message: link + '\n\nНажмите и удерживайте ссылку, чтобы скопировать.', buttons: [{ type: 'ok' }] });
    } else {
        prompt('Скопируйте ссылку:', link);
    }
}

async function loadShareLink() {
    try {
        const [cfg, profile] = await Promise.all([
            fetch((window.API_BASE_URL || '/api') + '/config').then(r => r.json()),
            apiRequest('/models/me').catch(() => null)
        ]);
        const bot = (cfg.botUsername || 'WishlistttGiftBot').trim().replace(/^@/, '');
        const slug = (profile?.profile?.publicSlug || profile?.profile?.publicLink || 'me').trim();
        const link = `https://t.me/${bot}/app?startapp=${slug}`;
        window.__BOT_USERNAME__ = bot;
        const el = document.getElementById('public-link');
        if (el) {
            el.textContent = link.replace('https://', '');
            el.title = link;
        }
    } catch (_) {
        const el = document.getElementById('public-link');
        if (el) {
            el.textContent = 't.me/WishlistttGiftBot/app?startapp=me';
            el.title = 'https://t.me/WishlistttGiftBot/app?startapp=me';
        }
    }
}

// =====================================================
// Утилиты
// =====================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function generateToken(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

async function resizeImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = function() {
            URL.revokeObjectURL(url);
            const MAX = 800;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w > h) { h = (h * MAX) / w; w = MAX; } 
                else { w = (w * MAX) / h; h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
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

// =====================================================
// Авторизация через Telegram
// =====================================================

async function initAuth() {
    if (!tg?.initData) {
        showAuthError('Откройте приложение через Telegram: нажмите меню бота или перейдите по ссылке t.me/YourBot/app?startapp=me');
        return false;
    }

    try {
        const res = await fetch((window.API_BASE_URL || '/api') + '/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
        });
        const data = await res.json();

        if (!res.ok) {
            showAuthError(data.error || 'Ошибка авторизации');
            return false;
        }

        if (data.token) {
            localStorage.setItem('token', data.token);
        }
        return true;
    } catch (e) {
        console.error('Auth error:', e);
        showAuthError('Не удалось авторизоваться. Проверьте интернет и попробуйте снова.');
        return false;
    }
}

function showAuthError(message) {
    document.body.innerHTML = `
        <div class="screen-center" style="padding: 24px; text-align: center;">
            <div class="screen-icon" style="font-size: 48px;">🔐</div>
            <div class="screen-title" style="margin-bottom: 12px;">Требуется Telegram</div>
            <p class="text-secondary" style="margin-bottom: 24px;">${escapeHtml(message)}</p>
            <a href="https://t.me/${(window.__BOT_USERNAME__ || 'WishlistttGiftBot')}" class="btn btn-primary">Открыть в Telegram</a>
        </div>
    `;
}

// =====================================================
// Инициализация
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    if (tg) {
        tg.ready();
        tg.expand();
    }

    const authed = await initAuth();
    if (!authed) return;

    loadShareLink();
    loadMyGifts();
    loadEvents();
    loadBalance();
    loadSettings();
    initGiftForm();
    initFilterTabs();
});
