/**
 * Middleware для проверки JWT
 */

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'wishlist-gift-secret-change-in-production';

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Требуется авторизация. Откройте приложение через Telegram.' });
    }

    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { id: decoded.userId, telegramId: decoded.telegramId };
        next();
    } catch {
        return res.status(401).json({ error: 'Сессия истекла. Откройте приложение заново.' });
    }
}

/** Опциональная авторизация — устанавливает req.user при валидном токене, иначе next() */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { id: decoded.userId, telegramId: decoded.telegramId };
    } catch (_) {}
    next();
}

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuth;
