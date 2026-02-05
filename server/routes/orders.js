/**
 * Orders API — данные из PostgreSQL
 */

const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
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

// Получить поступления модели (оплаченные подарки для текущего пользователя)
router.get('/received/list', auth, async (req, res) => {
    try {
        const modelId = req.user.id;
        const result = await db.query(
            `SELECT o.id, o.amount_xtr, o.paid_at, o.gift_message, o.donor_username, o.donor_telegram_id,
                    w.name AS item_name,
                    u.first_name AS donor_name
             FROM orders o
             JOIN wishlist_items w ON w.id = o.item_id
             LEFT JOIN users u ON u.telegram_id = o.donor_telegram_id
             WHERE o.model_id = $1 AND o.status = 'paid'
             ORDER BY o.paid_at DESC`,
            [modelId]
        );
        res.json(result.rows.map(r => ({
            id: r.id,
            gift: r.item_name,
            amount: r.amount_xtr,
            from: r.donor_username ? `@${r.donor_username}` : (r.donor_name || (r.donor_telegram_id ? `id${r.donor_telegram_id}` : 'Даритель')),
            message: r.gift_message || '',
            date: r.paid_at
        })));
    } catch (error) {
        console.error('Orders received error:', error);
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

// Для payments webhook (payload приходит от Telegram как в sendInvoice)
router.findOrderByPayload = async (payload) => {
    const p = typeof payload === 'string' ? payload.trim() : String(payload || '');
    if (!p) return null;
    const result = await db.query('SELECT * FROM orders WHERE telegram_invoice_payload = $1', [p]);
    return result.rows[0] || null;
};

router.markOrderPaid = async (orderId, telegramPaymentChargeId) => {
    const client = await db.connect();
    try {
        const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
        if (orderResult.rows.length === 0) {
            console.warn('[markOrderPaid] Order not found:', orderId);
            return false;
        }
        const order = orderResult.rows[0];
        if (order.telegram_payment_charge_id) {
            console.log('[markOrderPaid] Already paid (idempotent):', orderId);
            return true;
        }

        const amount = parseInt(order.amount_xtr, 10) || 0;
        await client.query('BEGIN');
        await client.query(
            `UPDATE orders SET status = 'paid', telegram_payment_charge_id = $2, paid_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [orderId, telegramPaymentChargeId]
        );
        await client.query(
            "UPDATE wishlist_items SET item_status = 'gifted', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [order.item_id]
        );
        await client.query(
            `INSERT INTO model_balances (model_id, total_stars_earned, pending_21_days, updated_at)
             VALUES ($1, $2, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (model_id) DO UPDATE SET
               total_stars_earned = model_balances.total_stars_earned + $2,
               pending_21_days = model_balances.pending_21_days + $2,
               updated_at = CURRENT_TIMESTAMP`,
            [order.model_id, amount]
        );
        await client.query('COMMIT');
        console.log('[markOrderPaid] OK:', { orderId, item_id: order.item_id, model_id: order.model_id, amount });
        return true;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[markOrderPaid] Error:', err.message, { orderId });
        throw err;
    } finally {
        client.release();
    }
};

module.exports = router;
