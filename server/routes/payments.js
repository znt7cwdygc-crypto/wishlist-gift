/**
 * Платежи Stars: создание Invoice, webhook pre_checkout / successful_payment
 * MVP: заглушки. В проде — интеграция с Telegram Bot API.
 */

const express = require('express');
const router = express.Router();

let ordersRouter = null;
router.setOrdersRouter = (r) => { ordersRouter = r; };

// Создать Invoice (бот отправит в чат)
router.post('/invoice', async (req, res) => {
    try {
        const { item_id: itemId, order_id: orderId, amount_xtr: amountXtr, title } = req.body;
        
        if (!itemId || !orderId || !amountXtr) {
            return res.status(400).json({ error: 'item_id, order_id, amount_xtr обязательны' });
        }
        
        // TODO: вызвать bot.sendInvoice() с currency: 'XTR'
        // invoice_payload должен содержать order_id для матчинга при pre_checkout
        res.json({
            success: true,
            order_id: orderId,
            invoice_payload: `order:${orderId}`,
            amount_xtr: parseInt(amountXtr),
            message: 'Бот отправит Invoice в чат (интеграция с Telegram Bot API)'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Telegram webhook: pre_checkout_query + successful_payment
router.post('/telegram-webhook', async (req, res) => {
    try {
        const body = req.body;
        res.sendStatus(200); // всегда 200, чтобы Telegram не ретраил
        
        // pre_checkout_query
        if (body.pre_checkout_query) {
            const pq = body.pre_checkout_query;
            const payload = pq.invoice_payload;
            const amount = pq.total_amount; // в минимальных единицах XTR (1 Star = 1)
            
            if (!ordersRouter?.findOrderByPayload) return;
            const order = await ordersRouter.findOrderByPayload(payload);
            if (!order) {
                // TODO: bot.answerPreCheckoutQuery(pq.id, ok: false, error_message: 'Заказ не найден')
                return;
            }
            if (order.status !== 'reserved') {
                // TODO: bot.answerPreCheckoutQuery(pq.id, ok: false, error_message: 'Позиция уже занята')
                return;
            }
            if (amount !== order.amount_xtr) {
                // TODO: bot.answerPreCheckoutQuery(pq.id, ok: false, error_message: 'Сумма изменилась')
                return;
            }
            // TODO: bot.answerPreCheckoutQuery(pq.id, ok: true)
        }
        
        // successful_payment
        if (body.message?.successful_payment) {
            const sp = body.message.successful_payment;
            const payload = sp.invoice_payload;
            const chargeId = sp.telegram_payment_charge_id;
            
            if (!ordersRouter?.findOrderByPayload || !ordersRouter?.markOrderPaid) return;
            const order = await ordersRouter.findOrderByPayload(payload);
            if (!order) return;
            
            await ordersRouter.markOrderPaid(order.id, chargeId);
            // TODO: уведомить владельца, обновить model_balances
        }
    } catch (e) {
        console.error('Payments webhook error:', e);
    }
});

// Legacy
router.post('/initiate', async (req, res) => {
    try {
        const { itemId } = req.body;
        res.json({
            success: true,
            invoiceUrl: 'https://t.me/invoice/test',
            message: 'Используйте POST /invoice с order_id'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
