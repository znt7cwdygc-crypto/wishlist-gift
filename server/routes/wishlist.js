/**
 * Wishlist API — данные из PostgreSQL
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Маппинг для API response
function mapItem(row) {
    return {
        id: row.id,
        modelId: row.model_id,
        name: row.name,
        description: row.description || '',
        url: row.url,
        price: parseFloat(row.price),
        currency: row.currency,
        baseStars: row.base_stars,
        feeStars: row.fee_stars,
        totalStars: row.total_stars,
        photos: row.photos || [],
        status: row.item_status || 'available',
        createdAt: row.created_at
    };
}

// Получить вишлист текущего пользователя (кабинет модели) — требует авторизации
router.get('/', auth, async (req, res) => {
    try {
        const modelId = req.user.id;
        const result = await db.query(
            'SELECT * FROM wishlist_items WHERE model_id = $1 AND is_active = true ORDER BY created_at DESC',
            [modelId]
        );
        res.json(result.rows.map(mapItem));
    } catch (error) {
        console.error('Wishlist GET error:', error);
        res.status(500).json({ error: error.message });
    }
});

// По modelId
router.get('/model/:modelId', async (req, res) => {
    try {
        const modelId = parseInt(req.params.modelId) || 1;
        const result = await db.query(
            'SELECT * FROM wishlist_items WHERE model_id = $1 AND is_active = true ORDER BY created_at DESC',
            [modelId]
        );
        res.json(result.rows.map(mapItem));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// По public_slug
router.get('/by-slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        if (!slug) return res.status(400).json({ error: 'Slug required' });
        
        // Находим model_id по slug
        const profileResult = await db.query(
            'SELECT user_id FROM model_profiles WHERE public_slug = $1 OR public_link = $1',
            [slug, slug]
        );
        const modelId = profileResult.rows[0]?.user_id || 1;
        
        const result = await db.query(
            'SELECT * FROM wishlist_items WHERE model_id = $1 AND is_active = true ORDER BY created_at DESC',
            [modelId]
        );
        res.json(result.rows.map(mapItem));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Создать товар — требует авторизации
router.post('/items', auth, async (req, res, next) => {
    try {
        const { name, description, url, price, currency, baseStars, feeStars, totalStars, photos } = req.body;
        
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: 'Request body is empty' });
        }
        if (!name || typeof name !== 'string') {
            return res.status(400).json({ error: 'Укажите название товара' });
        }
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'Укажите ссылку на товар' });
        }
        if (price === undefined || price === null || isNaN(Number(price))) {
            return res.status(400).json({ error: 'Укажите корректную цену' });
        }
        
        const photosArr = Array.isArray(photos) ? photos : [];
        const modelId = req.user.id;
        
        const result = await db.query(
            `INSERT INTO wishlist_items 
            (model_id, name, description, url, price, currency, base_stars, fee_stars, total_stars, photos)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
                modelId,
                String(name).trim(),
                (description != null ? String(description) : '').trim(),
                String(url).trim(),
                parseFloat(price),
                String(currency || 'USD'),
                Math.floor(Number(baseStars) || 0),
                Math.floor(Number(feeStars) || 0),
                Math.floor(Number(totalStars) || 0),
                JSON.stringify(photosArr)
            ]
        );
        
        const item = mapItem(result.rows[0]);
        res.json({ success: true, id: item.id, item });
    } catch (error) {
        console.error('Wishlist POST error:', error);
        next(error);
    }
});

// Обновить товар — требует авторизации
router.put('/items/:id', auth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const modelId = req.user.id;
        const { name, description, url, price, currency, baseStars, feeStars, totalStars, photos } = req.body;
        
        const result = await db.query(
            `UPDATE wishlist_items SET
                name = COALESCE($2, name),
                description = COALESCE($3, description),
                url = COALESCE($4, url),
                price = COALESCE($5, price),
                currency = COALESCE($6, currency),
                base_stars = COALESCE($7, base_stars),
                fee_stars = COALESCE($8, fee_stars),
                total_stars = COALESCE($9, total_stars),
                photos = COALESCE($10::jsonb, photos),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND model_id = $11 AND is_active = true
            RETURNING *`,
            [
                id,
                name,
                description,
                url,
                price != null ? parseFloat(price) : null,
                currency,
                baseStars != null ? parseInt(baseStars) : null,
                feeStars != null ? parseInt(feeStars) : null,
                totalStars != null ? parseInt(totalStars) : null,
                photos ? JSON.stringify(Array.isArray(photos) ? photos : []) : null,
                modelId
            ]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        res.json({ success: true, item: mapItem(result.rows[0]) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Удалить товар (soft delete) — требует авторизации
router.delete('/items/:id', auth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const modelId = req.user.id;
        const result = await db.query(
            'UPDATE wishlist_items SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND model_id = $2 RETURNING id',
            [id, modelId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
