/**
 * Telegram Stars: sendInvoice, webhook pre_checkout / successful_payment
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

let ordersRouter = null;
router.setOrdersRouter = (r) => { ordersRouter = r; };

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

async function telegramApi(method, body) {
    if (!BOT_TOKEN) return { ok: false };
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res.json();
}

// Создать Invoice для заказа (вишлист)
router.post('/invoice', async (req, res) => {
    try {
        const { item_id: itemId, order_id: orderId, amount_xtr: amountXtr, title } = req.body;

        if (!itemId || !orderId || !amountXtr) {
            return res.status(400).json({ error: 'item_id, order_id, amount_xtr обязательны' });
        }

        const order = ordersRouter?.findOrderByPayload
            ? await ordersRouter.findOrderByPayload(`order:${orderId}`)
            : null;
        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        if (!BOT_TOKEN) {
            return res.status(503).json({ error: 'BOT_TOKEN не настроен' });
        }

        const payload = `order:${orderId}`;
        const result = await telegramApi('sendInvoice', {
            chat_id: order.donor_telegram_id,
            title: title || 'Подарок',
            description: 'Оплата через Telegram Stars',
            payload,
            currency: 'XTR',
            prices: [{ label: 'Stars', amount: parseInt(amountXtr) }]
        });

        if (!result.ok) {
            return res.status(500).json({ error: result.description || 'Ошибка Telegram' });
        }

        res.json({ success: true, order_id: orderId, amount_xtr: parseInt(amountXtr) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Webhook от Telegram (setWebhook на боте → этот URL)
router.post('/telegram-webhook', async (req, res) => {
    res.sendStatus(200);

    try {
        const body = req.body;

        if (body.pre_checkout_query) {
            const pq = body.pre_checkout_query;
            const payload = pq.invoice_payload;
            const amount = pq.total_amount;

            let ok = false;
            let errorMsg = 'Ошибка';

            if (payload.startsWith('donate:')) {
                const r = await db.query(
                    'SELECT id, amount_xtr, status FROM donations WHERE payload = $1',
                    [payload]
                );
                const d = r.rows[0];
                if (d && d.status === 'pending' && d.amount_xtr === amount) {
                    ok = true;
                } else if (!d) errorMsg = 'Донат не найден';
                else if (d.status !== 'pending') errorMsg = 'Уже оплачено';
            } else if (payload.startsWith('order:') && ordersRouter?.findOrderByPayload) {
                const order = await ordersRouter.findOrderByPayload(payload);
                if (order && order.status === 'reserved' && order.amount_xtr === amount) {
                    ok = true;
                } else if (!order) errorMsg = 'Заказ не найден';
                else if (order.status !== 'reserved') errorMsg = 'Позиция уже занята';
            }

            await telegramApi('answerPreCheckoutQuery', {
                pre_checkout_query_id: pq.id,
                ok,
                error_message: ok ? undefined : errorMsg
            });
        }

        if (body.message?.successful_payment) {
            const sp = body.message.successful_payment;
            const payload = sp.invoice_payload;
            const chargeId = sp.telegram_payment_charge_id;

            if (payload.startsWith('donate:')) {
                await db.query(
                    `UPDATE donations SET status = 'paid', telegram_payment_charge_id = $2, paid_at = CURRENT_TIMESTAMP
                     WHERE payload = $1 AND status = 'pending'`,
                    [payload, chargeId]
                );
            } else if (payload.startsWith('order:') && ordersRouter?.markOrderPaid) {
                const order = await ordersRouter.findOrderByPayload(payload);
                if (order) await ordersRouter.markOrderPaid(order.id, chargeId);
            }
        }
    } catch (e) {
        console.error('Webhook error:', e);
    }
});

router.post('/initiate', (req, res) => {
    res.json({ success: true, message: 'Используйте POST /invoice или /api/stars/send' });
});

module.exports = router;
