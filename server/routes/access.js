/**
 * Доступ к вишлисту — данные из PostgreSQL
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

// Проверка доступа
router.get('/', async (req, res) => {
    try {
        const { slug, telegram_id: telegramId, invite_token: inviteToken } = req.query;
        
        if (!slug && !inviteToken) {
            return res.status(400).json({ error: 'Укажите slug или invite_token' });
        }
        
        let modelId = 1;
        
        if (inviteToken) {
            const tokenResult = await db.query(
                `SELECT model_id FROM invite_tokens 
                 WHERE token = $1 AND expires_at > NOW() AND used_count < max_uses
                 AND (allowed_telegram_id IS NULL OR allowed_telegram_id = $2)`,
                [inviteToken, telegramId || 0]
            );
            if (tokenResult.rows.length === 0) {
                return res.json({
                    has_access: false,
                    access_type: 'invite_expired',
                    message: 'Ссылка устарела. Попросите новую у владельца.'
                });
            }
            modelId = tokenResult.rows[0].model_id;
            return res.json({ has_access: true, access_type: 'invite_token', model_id: modelId });
        }
        
        if (slug) {
            const profileResult = await db.query(
                'SELECT user_id, privacy_mode FROM model_profiles WHERE public_slug = $1 OR public_link = $1',
                [slug]
            );
            if (profileResult.rows.length > 0) {
                modelId = profileResult.rows[0].user_id;
                const privacy = profileResult.rows[0].privacy_mode || 'public';
                
                if (privacy === 'public') {
                    return res.json({ has_access: true, access_type: 'public', model_id: modelId });
                }
                if (privacy === 'allowlist' && telegramId) {
                    const allowed = await db.query(
                        'SELECT 1 FROM wishlist_allowed_users WHERE model_id = $1 AND telegram_id = $2',
                        [modelId, telegramId]
                    );
                    if (allowed.rows.length > 0) {
                        return res.json({ has_access: true, access_type: 'allowlist', model_id: modelId });
                    }
                    return res.json({
                        has_access: false,
                        access_type: 'request_access',
                        message: 'Это приватный вишлист. Запросить доступ?'
                    });
                }
            }
        }
        
        res.json({ has_access: true, access_type: 'public', model_id: modelId });
    } catch (error) {
        console.error('Access GET error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Запрос доступа
router.post('/request', async (req, res) => {
    try {
        const { model_id: modelId, telegram_id: telegramId, username } = req.body;
        if (!modelId || !telegramId) {
            return res.status(400).json({ error: 'model_id и telegram_id обязательны' });
        }
        
        await db.query(
            `INSERT INTO wishlist_access_requests (model_id, requester_telegram_id, requester_username)
             VALUES ($1, $2, $3)
             ON CONFLICT (model_id, requester_telegram_id) DO UPDATE SET status = 'pending'`,
            [modelId, telegramId, username]
        );
        
        res.json({ success: true, status: 'pending', message: 'Запрос отправлен владельцу' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Одобрить/отклонить
router.post('/approve', async (req, res) => {
    try {
        const { model_id: modelId, requester_telegram_id: telegramId, action } = req.body;
        if (!modelId || !telegramId || !['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'model_id, requester_telegram_id, action (approve|reject)' });
        }
        
        await db.query(
            'UPDATE wishlist_access_requests SET status = $3 WHERE model_id = $1 AND requester_telegram_id = $2',
            [modelId, telegramId, action === 'approve' ? 'approved' : 'rejected']
        );
        
        if (action === 'approve') {
            await db.query(
                `INSERT INTO wishlist_allowed_users (model_id, telegram_id, username)
                 VALUES ($1, $2, $3) ON CONFLICT (model_id, telegram_id) DO NOTHING`,
                [modelId, telegramId, req.body.username]
            );
        }
        
        res.json({ success: true, status: action === 'approve' ? 'approved' : 'rejected' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
