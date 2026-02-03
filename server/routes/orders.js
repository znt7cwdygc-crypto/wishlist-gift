/**
 * Orders API — данные из PostgreSQL
 */

const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

const RESERVE_MINUTES = 10;

// Создать заказ (резерв позиции)
router.post('/', optionalAuth, async (req, res) => {
    try {
        let { item_id: itemId, model_id: modelId, donor_telegram_id: donorTelegramId, donor_username: donorUsername, amount_xtr: amountXtr, message } = req.body;
        
        if (!itemId || !modelId || amountXtr == null || amountXtr === '') {
            return res.status(400).json({ error: 'item_id, model_id, donor_telegram_id, amount_xtr обязательны' });
        }
        
        if (req.user?.telegramId != null) {
            donorTelegramId = req.user.telegramId;
        }
        if (donorTelegramId == null) {
            return res.status(400).json({ error: 'donor_telegram_id обязателен. Откройте приложение через Telegram.' });
        }
        
        const orderId = randomUUID();
        const now = new Date();
        const reservedUntil = new Date(now.getTime() + RESERVE_MINUTES * 60 * 1000);
        const invoicePayload = `order:${orderId}`;
        
        // Проверяем активный резерв
        const existing = await db.query(
            `SELECT id FROM orders WHERE item_id = $1 AND status IN ('created', 'reserved') AND reserved_until > NOW()`,
            [parseInt(itemId)]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: 'Позиция зарезервирована',
                reserved_until: existing.rows[0].reserved_until
            });
        }
        
        await db.query(
            `INSERT INTO orders 
            (id, item_id, model_id, donor_telegram_id, donor_username, amount_xtr, status, reserved_at, reserved_until, telegram_invoice_payload, gift_message)
            VALUES ($1, $2, $3, $4, $5, $6, 'reserved', $7, $8, $9, $10)`,
            [orderId, parseInt(itemId), parseInt(modelId), donorTelegramId, donorUsername || null, parseInt(amountXtr), now, reservedUntil, invoicePayload, message || null]
        );
        
        // Резервируем позицию
        await db.query(
            "UPDATE wishlist_items SET item_status = 'reserved', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [parseInt(itemId)]
        );
        
        res.json({
            success: true,
            order_id: orderId,
            invoice_payload: invoicePayload,
            reserved_until: reservedUntil.toISOString()
        });
    } catch (error) {
        console.error('Orders POST error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить заказ
router.get('/:orderId', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.orderId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Для payments webhook
router.findOrderByPayload = async (payload) => {
    const result = await db.query('SELECT * FROM orders WHERE telegram_invoice_payload = $1', [payload]);
    return result.rows[0] || null;
};

router.markOrderPaid = async (orderId, telegramPaymentChargeId) => {
    const client = await db.pool.connect();
    try {
        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
        if (orderResult.rows.length === 0) return false;
        const order = orderResult.rows[0];
        if (order.telegram_payment_charge_id) return true; // идемпотентность
        
        await client.query(
            `UPDATE orders SET status = 'paid', telegram_payment_charge_id = $2, paid_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [orderId, telegramPaymentChargeId]
        );
        await client.query(
            "UPDATE wishlist_items SET item_status = 'gifted', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [order.item_id]
        );
        return true;
    } finally {
        client.release();
    }
};

module.exports = router;
