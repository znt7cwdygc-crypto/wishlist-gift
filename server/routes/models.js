/**
 * Models API — данные из PostgreSQL
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

// Профиль текущей модели (по умолчанию id=1)
router.get('/me', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.id, u.telegram_id, u.username, u.first_name, u.avatar_url, mp.public_slug, mp.bio, mp.banner_url
             FROM users u
             LEFT JOIN model_profiles mp ON u.id = mp.user_id
             WHERE u.id = 1`
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
             WHERE mp.public_slug = $1 OR mp.public_link = $1 OR u.id = 1`,
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

// Обновить профиль
router.put('/me', async (req, res) => {
    try {
        const { firstName, bio, avatar, banner } = req.body;
        
        await db.query(
            `UPDATE users SET first_name = COALESCE($2, first_name), avatar_url = COALESCE($3, avatar_url), updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
            [1, firstName, avatar]
        );
        
        await db.query(
            `INSERT INTO model_profiles (user_id, bio, banner_url) VALUES (1, $2, $3)
             ON CONFLICT (user_id) DO UPDATE SET bio = COALESCE($2, bio), banner_url = COALESCE($3, banner_url)`,
            [1, bio, banner]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
