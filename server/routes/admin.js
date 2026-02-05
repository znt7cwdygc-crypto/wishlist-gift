const express = require('express');
const router = express.Router();
const db = require('../db');
const { getBotToken } = require('../bot-token');

router.get('/stats', async (req, res) => {
    try {
        const modelsRes = await db.query('SELECT COUNT(*) AS c FROM model_profiles');
        const ordersRes = await db.query(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_xtr), 0) AS total FROM orders WHERE status = 'paid'"
        );
        const totalModels = parseInt(modelsRes.rows[0]?.c, 10) || 0;
        const totalGifts = parseInt(ordersRes.rows[0]?.cnt, 10) || 0;
        const totalStars = parseInt(ordersRes.rows[0]?.total, 10) || 0;
        res.json({
            totalModels,
            totalGifts,
            totalStars,
            totalRevenue: totalStars
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/models', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.id, u.first_name AS "firstName", u.username, u.telegram_id
             FROM users u
             JOIN model_profiles mp ON mp.user_id = u.id
             ORDER BY u.id`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Текущий webhook бота — куда Telegram присылает pre_checkout и successful_payment
router.get('/webhook-info', async (req, res) => {
    try {
        const botToken = getBotToken();
        const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
        const expectedUrl = appUrl ? `${appUrl}/api/payments/telegram-webhook` : null;

        if (!botToken) {
            return res.json({ error: 'BOT_TOKEN не задан', expected: expectedUrl });
        }
        const r = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
        const data = await r.json();
        const currentUrl = data.result?.url || null;
        const ok = currentUrl === expectedUrl;
        res.json({
            current_webhook_url: currentUrl,
            expected_webhook_url: expectedUrl,
            app_url: appUrl,
            match: ok,
            hint: !currentUrl ? 'Webhook не установлен — оплаты не будут записываться.' : (!ok ? 'Webhook указывает на другой URL — оплаты уходят на другой сервер!' : null)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Принудительно установить webhook на APP_URL (если оплаты не записывались — часто webhook указывал на старый URL)
router.post('/set-webhook', async (req, res) => {
    try {
        const botToken = getBotToken();
        const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
        const webhookUrl = appUrl ? `${appUrl}/api/payments/telegram-webhook` : null;
        if (!botToken || !webhookUrl) {
            return res.status(400).json({ error: 'Нужны BOT_TOKEN и APP_URL в .env', app_url: appUrl || null });
        }
        const r = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
        const data = await r.json();
        if (data.ok) {
            return res.json({ success: true, webhook_url: webhookUrl, message: 'Webhook установлен. Новые оплаты будут записываться сюда.' });
        }
        res.status(400).json({ ok: false, description: data.description, webhook_url: webhookUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Вручную отметить заказ как оплаченный (если webhook не сработал) + отправить уведомление модели
router.post('/mark-order-paid', async (req, res) => {
    try {
        const { order_id: orderId, telegram_payment_charge_id: chargeId } = req.body;
        if (!orderId) return res.status(400).json({ error: 'order_id обязателен' });
        const ordersRouter = require('./orders');
        const botToken = getBotToken();
        const paidChargeId = chargeId || `manual-${Date.now()}`;
        await ordersRouter.markOrderPaid(orderId, paidChargeId);
        await sendModelGiftNotification(orderId, botToken);
        res.json({ success: true, message: 'Заказ отмечен как оплаченный, уведомление модели отправлено (если возможно)' });
    } catch (error) {
        console.error('Admin mark-order-paid error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Найти последний заказ по названию подарка и model_id, отметить оплаченным и отправить уведомление модели
router.post('/mark-order-paid-by-item', async (req, res) => {
    try {
        const { item_name: itemName, model_id: modelId } = req.body;
        if (!itemName || !modelId) return res.status(400).json({ error: 'item_name и model_id обязательны' });
        const orderRow = await db.query(
            `SELECT o.id, o.status FROM orders o
             JOIN wishlist_items w ON w.id = o.item_id
             WHERE o.model_id = $1 AND LOWER(w.name) LIKE $2
             ORDER BY o.reserved_at DESC LIMIT 1`,
            [modelId, '%' + String(itemName).toLowerCase().trim() + '%']
        );
        const order = orderRow.rows[0];
        if (!order) return res.status(404).json({ error: 'Заказ не найден по названию подарка и модели' });
        const ordersRouter = require('./orders');
        const paidChargeId = `manual-${Date.now()}`;
        await ordersRouter.markOrderPaid(order.id, paidChargeId);
        const botToken = getBotToken();
        await sendModelGiftNotification(order.id, botToken);
        res.json({ success: true, order_id: order.id, message: 'Заказ отмечен как оплаченный, уведомление модели отправлено' });
    } catch (error) {
        console.error('Admin mark-order-paid-by-item error:', error);
        res.status(500).json({ error: error.message });
    }
});

async function sendModelGiftNotification(orderId, botToken) {
    if (!botToken) return;
    const orderRow = await db.query(
        'SELECT o.model_id, o.item_id, o.amount_xtr FROM orders o WHERE o.id = $1',
        [orderId]
    );
    const order = orderRow.rows[0];
    if (!order) return;
    const itemR = await db.query('SELECT name FROM wishlist_items WHERE id = $1', [order.item_id]);
    const modelR = await db.query('SELECT first_name, username, telegram_id FROM users WHERE id = $1', [order.model_id]);
    const itemName = itemR.rows[0]?.name || 'Подарок';
    const rawTid = modelR.rows[0]?.telegram_id;
    const modelTelegramId = rawTid != null ? String(rawTid).trim() : null;
    if (!modelTelegramId) {
        console.warn('[Notify model] Нет telegram_id у модели', order.model_id, '— уведомление не отправлено');
        return;
    }
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: modelTelegramId,
            text: `🎁 Вам подарили: «${itemName}». Стоимость: ${order.amount_xtr} ⭐`
        })
    });
    const data = await r.json();
    if (data.ok) {
        console.log('[Notify model] OK:', order.model_id, itemName);
    } else {
        console.warn('[Notify model] FAIL:', data.description, { model_id: order.model_id, chat_id: modelTelegramId });
    }
}

// Синхронизация: для всех оплаченных заказов — статус подарка «gifted» и баланс модели
router.post('/sync-paid-orders', async (req, res) => {
    try {
        const client = await require('../db').connect();
        try {
            await client.query('BEGIN');
            const r1 = await client.query(
                `UPDATE wishlist_items w SET item_status = 'gifted', updated_at = CURRENT_TIMESTAMP
                 FROM orders o WHERE w.id = o.item_id AND o.status = 'paid' AND w.item_status != 'gifted'
                 RETURNING w.id`
            );
            await client.query(
                `INSERT INTO model_balances (model_id, total_stars_earned, pending_21_days, updated_at)
                 SELECT model_id, SUM(amount_xtr::int), SUM(amount_xtr::int), CURRENT_TIMESTAMP
                 FROM orders WHERE status = 'paid' GROUP BY model_id
                 ON CONFLICT (model_id) DO UPDATE SET
                   total_stars_earned = EXCLUDED.total_stars_earned,
                   pending_21_days = EXCLUDED.pending_21_days,
                   updated_at = EXCLUDED.updated_at`
            );
            await client.query('COMMIT');
            res.json({
                success: true,
                itemsUpdated: r1.rowCount || 0,
                message: 'Статусы подарков и балансы синхронизированы с оплаченными заказами'
            });
        } catch (e) {
            await client.query('ROLLBACK').catch(() => {});
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Admin sync-paid-orders error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/transactions', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT o.id, o.amount_xtr AS "starsAmount", o.paid_at AS "paidAt", o.telegram_payment_charge_id,
                    w.name AS "itemName",
                    u_model.first_name AS "modelName", u_model.username AS "modelUsername",
                    o.donor_username AS "donorUsername", o.donor_telegram_id AS "donorTelegramId"
             FROM orders o
             JOIN wishlist_items w ON w.id = o.item_id
             JOIN users u_model ON u_model.id = o.model_id
             WHERE o.status = 'paid'
             ORDER BY o.paid_at DESC
             LIMIT 200`
        );
        res.json(result.rows.map(r => ({
            id: r.id,
            starsAmount: r.starsAmount,
            paidAt: r.paidAt,
            itemName: r.itemName,
            modelName: r.modelName || r.modelUsername || `ID ${r.model_id}`,
            donor: r.donorUsername ? `@${r.donorUsername}` : `id:${r.donorTelegramId}`
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
