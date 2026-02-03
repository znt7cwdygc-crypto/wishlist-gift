/**
 * Models API — данные из PostgreSQL
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Профиль текущей модели — требует авторизации
router.get('/me', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query(
            `SELECT u.id, u.telegram_id, u.username, u.first_name, u.avatar_url, mp.public_slug, mp.bio, mp.banner_url
             FROM users u
             LEFT JOIN model_profiles mp ON u.id = mp.user_id
             WHERE u.id = $1`,
            [userId]
        );
        const row = result.rows[0];
        if (!row) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        res.json({
            id: row.id,
            telegramId: row.telegram_id,
            username: row.username,
            firstName: row.first_name,
            avatar: row.avatar_url,
            profile: {
                publicSlug: row.public_slug,
                publicLink: row.public_slug || 'me',
                bio: row.bio,
                banner: row.banner_url
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Публичный профиль по slug
router.get('/:publicLink', async (req, res) => {
    try {
        const slug = req.params.publicLink;
        const result = await db.query(
            `SELECT u.id, u.username, u.first_name, u.avatar_url, mp.public_slug, mp.bio, mp.banner_url
             FROM users u
             LEFT JOIN model_profiles mp ON u.id = mp.user_id
             WHERE mp.public_slug = $1 OR mp.public_link = $1 OR ($1 = 'me' AND u.id = 1)`,
            [slug]
        );
        const row = result.rows[0];
        if (!row) {
            return res.status(404).json({ error: 'Model not found' });
        }
        res.json({
            id: row.id,
            username: row.username,
            firstName: row.first_name,
            avatar: row.avatar_url,
            profile: {
                publicLink: row.public_slug || slug,
                bio: row.bio,
                banner: row.banner_url
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Обновить профиль — требует авторизации
router.put('/me', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { firstName, bio, avatar, banner, publicSlug } = req.body;
        
        await db.query(
            `UPDATE users SET first_name = COALESCE($2, first_name), avatar_url = COALESCE($3, avatar_url), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [userId, firstName, avatar]
        );
        
        await db.query(
            `UPDATE model_profiles SET 
                bio = COALESCE($2, bio), 
                banner_url = COALESCE($3, banner_url),
                public_slug = COALESCE(NULLIF($4, ''), public_slug),
                public_link = COALESCE(NULLIF($4, ''), public_link),
                updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1`,
            [userId, bio, banner, publicSlug]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
