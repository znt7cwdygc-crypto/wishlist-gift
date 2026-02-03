/**
 * Авторизация через Telegram Web App initData
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'wishlist-gift-secret-change-in-production';
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const AUTH_MAX_AGE = 24 * 60 * 60; // 24 часа

/**
 * Валидация Telegram initData
 * @param {string} initData - query string от Telegram.WebApp.initData
 * @param {string} botToken - токен бота
 * @returns {object|null} - распарсенные данные user или null
 */
function validateInitData(initData, botToken) {
    if (!initData || !botToken) return null;

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    const dataCheckArr = [];
    for (const [key, value] of params.entries()) {
        if (key !== 'hash') dataCheckArr.push(`${key}=${value}`);
    }
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

    const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

    if (calculatedHash !== hash) return null;

    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > AUTH_MAX_AGE) return null;

    const userStr = params.get('user');
    if (!userStr) return null;

    try {
        const user = JSON.parse(userStr);
        if (!user?.id) return null;
        return user;
    } catch {
        return null;
    }
}

router.post('/telegram', async (req, res) => {
    try {
        const { initData } = req.body;

        if (!initData || typeof initData !== 'string') {
            return res.status(400).json({ error: 'initData обязателен' });
        }

        const botToken = BOT_TOKEN;
        if (!botToken) {
            console.warn('BOT_TOKEN не задан — авторизация через initData отключена');
            return res.status(503).json({
                error: 'Авторизация временно недоступна. Настройте BOT_TOKEN на сервере.',
            });
        }

        const tgUser = validateInitData(initData, botToken);
        if (!tgUser) {
            return res.status(401).json({ error: 'Неверные данные. Откройте приложение через Telegram.' });
        }

        let user;
        const existing = await db.query(
            'SELECT * FROM users WHERE telegram_id = $1',
            [tgUser.id]
        );

        if (existing.rows.length > 0) {
            user = existing.rows[0];
            await db.query(
                `UPDATE users SET
                    username = COALESCE($2, username),
                    first_name = COALESCE($3, first_name),
                    last_name = COALESCE($4, last_name),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1`,
                [
                    user.id,
                    tgUser.username || user.username,
                    tgUser.first_name || user.first_name,
                    tgUser.last_name || user.last_name,
                ]
            );
        } else {
            const insert = await db.query(
                `INSERT INTO users (telegram_id, username, first_name, last_name, role)
                 VALUES ($1, $2, $3, $4, 'model')
                 RETURNING *`,
                [
                    tgUser.id,
                    tgUser.username || null,
                    tgUser.first_name || null,
                    tgUser.last_name || null,
                ]
            );
            user = insert.rows[0];

            await db.query(
                `INSERT INTO model_profiles (user_id, public_slug, public_link)
                 VALUES ($1, $2, $2)
                 ON CONFLICT (user_id) DO NOTHING`,
                [user.id, `u${user.id}`]
            );
            await db.query(
                'INSERT INTO model_balances (model_id) VALUES ($1) ON CONFLICT (model_id) DO NOTHING',
                [user.id]
            );
        }

        const token = jwt.sign(
            { userId: user.id, telegramId: user.telegram_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                telegramId: user.telegram_id,
                username: user.username,
                firstName: user.first_name,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Auth telegram error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
module.exports.validateInitData = validateInitData;
