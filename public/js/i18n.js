// Internationalization
const translations = {
    ru: {
        'app.name': 'Wishlist Gift',
        'common.back': 'Назад',
        'common.save': 'Сохранить',
        'common.cancel': 'Отмена',
        'common.loading': 'Загрузка...',
    },
    en: {
        'app.name': 'Wishlist Gift',
        'common.back': 'Back',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.loading': 'Loading...',
    }
};

let currentLang = localStorage.getItem('language') || 'ru';

function t(key) {
    return translations[currentLang]?.[key] || key;
}

function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('language', lang);
        document.documentElement.lang = lang;
        updateTranslations();
    }
}

function updateTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = t(key);
    });
    
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(currentLang.toUpperCase())) {
            btn.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateTranslations();
});


