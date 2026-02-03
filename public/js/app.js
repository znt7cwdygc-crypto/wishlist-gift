// Main Application JavaScript
const API_BASE_URL = '/api';

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
        });
        
        if (!response.ok) {
            const text = await response.text();
            let errorData = { error: response.statusText };
            try { errorData = JSON.parse(text); } catch (_) {}
            const errorMessage = errorData.error || errorData.message || text || response.statusText;
            throw new Error(`API Error: ${errorMessage}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Request Error:', error);
        console.error('Endpoint:', endpoint);
        console.error('Options:', options);
        throw error;
    }
}

// Utility Functions
function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

function formatCurrency(amount, currency = 'USD') {
    const symbols = {
        'USD': '$',
        'EUR': '€',
        'RUB': '₽'
    };
    return `${symbols[currency] || ''}${formatNumber(amount)}`;
}

function formatLargeNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace('.', ',') + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1).replace('.', ',') + 'K';
    }
    return formatNumber(num);
}

function formatPriceStars(stars, options = {}) {
    const starRate = 0.022;
    const showDollar = options.showDollar !== false;
    const compact = options.compact || false;
    
    const usdValue = parseFloat((stars * starRate).toFixed(2));
    const formattedStars = compact ? formatLargeNumber(stars) : formatNumber(stars);
    
    let formattedUsd = '';
    if (showDollar) {
        if (usdValue >= 1000) {
            formattedUsd = `~$${formatLargeNumber(usdValue)}`;
        } else if (usdValue >= 1) {
            formattedUsd = `~$${usdValue.toFixed(0)}`;
        } else {
            formattedUsd = `~$${usdValue.toFixed(2)}`;
        }
    }
    
    if (compact) {
        return {
            stars: formattedStars,
            usd: formattedUsd,
            full: `${formattedStars} ⭐`
        };
    } else if (showDollar) {
        return {
            stars: formatNumber(stars),
            usd: formatCurrency(usdValue, 'USD'),
            full: `${formatNumber(stars)} ⭐`
        };
    } else {
        return {
            stars: formatNumber(stars),
            usd: '',
            full: `${formatNumber(stars)} ⭐`
        };
    }
}

function convertToStars(price, currency = 'USD') {
    const starRate = 0.022;
    const rates = {
        'USD': 1,
        'EUR': 0.92,
        'RUB': 0.011
    };
    
    const usdPrice = price * (rates[currency] || 1);
    const baseStars = usdPrice / starRate;
    const serviceFee = 0.10;
    const totalStars = baseStars * (1 + serviceFee);
    
    return {
        base: Math.round(baseStars),
        fee: Math.round(baseStars * serviceFee),
        total: Math.round(totalStars)
    };
}

// Make functions available globally
window.apiRequest = apiRequest;
window.formatNumber = formatNumber;
window.formatCurrency = formatCurrency;
window.formatPriceStars = formatPriceStars;
window.convertToStars = convertToStars;

