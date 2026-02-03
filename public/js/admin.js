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

// Load models
async function loadModels() {
    try {
        const models = await apiRequest('/admin/models');
        const container = document.getElementById('models-list');
        
        if (models.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Нет моделей</div></div>';
            return;
        }
        
        container.innerHTML = models.map(model => `
            <div class="card mb-2">
                <div class="flex justify-between items-center">
                    <div>
                        <h4>${model.firstName}</h4>
                        <p class="text-secondary">ID: ${model.id}</p>
                    </div>
                    <span class="badge badge-success">Активна</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading models:', error);
    }
}

// Load transactions
async function loadTransactions() {
    try {
        const transactions = await apiRequest('/admin/transactions');
        const container = document.getElementById('transactions-list');
        
        if (transactions.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Нет транзакций</div></div>';
            return;
        }
        
        container.innerHTML = transactions.map(t => `
            <div class="card mb-2">
                <div class="flex justify-between items-center">
                    <div>
                        <h4>Транзакция #${t.id}</h4>
                        <p class="text-secondary">${t.starsAmount} Stars</p>
                    </div>
                    <span class="badge badge-success">Завершено</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadOverview();
});

