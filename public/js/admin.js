// Admin Page JavaScript
// Functions are available from app.js

// Tab management
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    if (tabName === 'overview') loadOverview();
    if (tabName === 'models') loadModels();
    if (tabName === 'transactions') loadTransactions();
}

// Load overview stats
async function loadOverview() {
    try {
        const stats = await apiRequest('/admin/stats');
        document.getElementById('total-models').textContent = formatNumber(stats.totalModels || 0);
        document.getElementById('total-gifts').textContent = formatNumber(stats.totalGifts || 0);
        document.getElementById('total-stars').textContent = formatNumber(stats.totalStars || 0);
        document.getElementById('total-revenue').textContent = formatNumber(stats.totalRevenue || 0);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

let _adminModels = [];
const ADMIN_PAGE_SIZE = 10;
let adminModelsPage = 1;
let adminTransactionsPage = 1;

// Load models (с пагинацией)
async function loadModels() {
    try {
        const models = await apiRequest('/admin/models');
        _adminModels = models;
        adminModelsPage = 1;
        renderModels(models);
    } catch (error) {
        console.error('Error loading models:', error);
    }
}

function renderModels(models) {
    const container = document.getElementById('models-list');
    if (!models || models.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Нет моделей</div></div>';
        return;
    }
    const to = adminModelsPage * ADMIN_PAGE_SIZE;
    const visible = models.slice(0, to);
    const hasMore = models.length > to;
    const escapeHtml = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    container.innerHTML = visible.map(model => `
        <div class="card mb-2 model-card" style="cursor: pointer;" onclick="showModelGifts(${model.id})">
            <div class="flex justify-between items-center">
                <div>
                    <h4>${escapeHtml(model.firstName || 'Без имени')}</h4>
                    <p class="text-secondary">ID: ${model.id}${model.username ? ' · @' + escapeHtml(model.username) : ''}</p>
                </div>
                <span class="badge badge-success">Активна</span>
            </div>
        </div>
    `).join('') + (hasMore ? `
        <button type="button" class="btn btn-ghost pagination-more w-full" onclick="adminModelsPage++; renderModels(_adminModels);">
            Показать ещё (${models.length - to} из ${models.length})
        </button>
    ` : '');
}

async function showModelGifts(modelId) {
    const modal = document.getElementById('model-gifts-modal');
    const titleEl = document.getElementById('model-gifts-title');
    const listEl = document.getElementById('model-gifts-list');
    const model = _adminModels.find(m => m.id === modelId);
    const modelName = model ? (model.firstName || model.username || 'Модель') : 'Модель';
    titleEl.textContent = 'Подарки: ' + modelName;
    listEl.innerHTML = '<div class="empty-state-text">Загрузка...</div>';
    modal.style.display = 'flex';
    try {
        const gifts = await apiRequest('/wishlist/model/' + modelId);
        if (gifts.length === 0) {
            listEl.innerHTML = '<div class="empty-state"><div class="empty-state-text">Нет подарков</div></div>';
            return;
        }
        const statusLabels = { available: 'Свободно', reserved: 'Зарезервировано', gifted: 'Подарено' };
        listEl.innerHTML = gifts.map(g => `
            <div class="flex justify-between items-center p-2 mb-2" style="background: var(--bg-secondary, #f5f5f5); border-radius: 8px;">
                <div>
                    <strong>${(g.name || 'Подарок').replace(/</g, '&lt;')}</strong>
                    <span class="text-secondary ml-2">${g.totalStars || 0} ⭐</span>
                </div>
                <span class="badge ${g.status === 'gifted' ? 'badge-success' : g.status === 'reserved' ? 'badge-warning' : 'badge-secondary'}">${statusLabels[g.status] || g.status}</span>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = '<div class="empty-state-text text-danger">Ошибка загрузки</div>';
        console.error(e);
    }
}

function closeModelGiftsModal() {
    document.getElementById('model-gifts-modal').style.display = 'none';
}

let _adminTransactions = [];

// Load transactions (с пагинацией)
async function loadTransactions() {
    try {
        const transactions = await apiRequest('/admin/transactions');
        _adminTransactions = transactions || [];
        adminTransactionsPage = 1;
        renderTransactions(_adminTransactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function renderTransactions(transactions) {
    const container = document.getElementById('transactions-list');
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Нет транзакций</div></div>';
        return;
    }
    const to = adminTransactionsPage * ADMIN_PAGE_SIZE;
    const visible = transactions.slice(0, to);
    const hasMore = transactions.length > to;
    container.innerHTML = visible.map(t => `
        <div class="card mb-2">
            <div class="flex justify-between items-center">
                <div>
                    <h4>${(t.itemName || 'Подарок').replace(/</g, '&lt;')} → ${(t.modelName || '-').replace(/</g, '&lt;')}</h4>
                    <p class="text-secondary">${t.starsAmount} ⭐ от ${(t.donor || '-').replace(/</g, '&lt;')}</p>
                    <p class="text-secondary small">${t.paidAt ? new Date(t.paidAt).toLocaleString('ru') : ''}</p>
                </div>
                <span class="badge badge-success">Оплачено</span>
            </div>
        </div>
    `).join('') + (hasMore ? `
        <button type="button" class="btn btn-ghost pagination-more w-full" onclick="adminTransactionsPage++; renderTransactions(_adminTransactions);">
            Показать ещё (${transactions.length - to} из ${transactions.length})
        </button>
    ` : '');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadOverview();
});

