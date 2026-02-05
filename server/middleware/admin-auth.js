/**
 * Защита админки: вход только по особой ссылке + пароль.
 * Ссылка: /manage?key=ADMIN_ENTRY_KEY
 * Пароль: ADMIN_PASSWORD (env)
 */

const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Q1w2e3r4t5y6';
const ADMIN_ENTRY_KEY = process.env.ADMIN_ENTRY_KEY || 'wishlist-admin-2024';
const COOKIE_NAME = 'admin_session';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 ч
const JWT_SECRET = process.env.JWT_SECRET || 'wishlist-gift-secret-change-in-production';

function sign(value) {
    return crypto.createHmac('sha256', JWT_SECRET).update(String(value)).digest('hex');
}

function getCookie(req, name) {
    const raw = req.headers.cookie;
    if (!raw) return null;
    const match = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1].trim()) : null;
}

/** Проверяет, что запрос с валидной админ-сессией (cookie) */
function requireAdminSession(req, res, next) {
    const value = getCookie(req, COOKIE_NAME);
    if (!value) {
        if (req.xhr || /^application\/json/.test(req.headers.accept || '')) {
            return res.status(401).json({ error: 'Требуется вход в админку' });
        }
        return res.redirect('/');
    }
    const [expiryStr, sig] = value.split('.');
    const expiry = parseInt(expiryStr, 10);
    if (!sig || !Number.isFinite(expiry) || expiry < Date.now() || sign(expiryStr) !== sig) {
        res.clearCookie(COOKIE_NAME, { path: '/' });
        if (req.xhr || /^application\/json/.test(req.headers.accept || '')) {
            return res.status(401).json({ error: 'Сессия истекла' });
        }
        return res.redirect('/');
    }
    req.adminSession = true;
    next();
}

/** Проверяет key из query (для доступа к странице входа) */
function checkEntryKey(key) {
    return key && String(key).trim() === ADMIN_ENTRY_KEY;
}

/** Проверяет пароль */
function checkPassword(password) {
    return password && String(password).trim() === ADMIN_PASSWORD;
}

/** Устанавливает админ-сессию в cookie */
function setAdminCookie(res) {
    const expiry = String(Date.now() + COOKIE_MAX_AGE_MS);
    const value = expiry + '.' + sign(expiry);
    res.cookie(COOKIE_NAME, value, {
        path: '/',
        httpOnly: true,
        maxAge: COOKIE_MAX_AGE_MS,
        sameSite: 'lax'
    });
}

module.exports = {
    requireAdminSession,
    checkEntryKey,
    checkPassword,
    setAdminCookie,
    ADMIN_ENTRY_KEY,
    COOKIE_NAME
};
