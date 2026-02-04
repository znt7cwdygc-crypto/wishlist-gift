/**
 * Простой приём Telegram Stars — без вишлиста
 */

const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const db = require('../db');
const { validateInitData } = require('./auth');

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

async function sendInvoice(chatId, amount, payload, title = 'Stars') {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            title: title,
            description: 'Оплата через Telegram Stars',
            payload: payload,
            currency: 'XTR',
            prices: [{ label: 'Stars', amount: amount }]
        })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || 'Telegram API error');
    return data.result;
}

router.post('/send', async (req, res) => {
    try {
        const { amount, initData } = req.body;

        if (!BOT_TOKEN) {
            return res.status(503).json({ error: 'BOT_TOKEN не настроен на сервере' });
        }
        if (!amount || amount < 1) {
            return res.status(400).json({ error: 'Укажите сумму (минимум 1 Star)' });
        }
        if (!initData) {
            return res.status(400).json({ error: 'Откройте приложение через Telegram' });
        }

        const tgUser = validateInitData(initData, BOT_TOKEN);
        if (!tgUser) {
            return res.status(401).json({ error: 'Неверные данные. Откройте через Telegram.' });
        }

        const payload = `donate:${randomUUID()}`;
        const amountInt = Math.floor(Number(amount));

        await db.query(
            `INSERT INTO donations (payload, amount_xtr, donor_telegram_id, donor_username, status)
             VALUES ($1, $2, $3, $4, 'pending')`,
            [payload, amountInt, tgUser.id, tgUser.username || null]
        );

        await sendInvoice(tgUser.id, amountInt, payload);

        res.json({ success: true, payload, amount: amountInt });
    } catch (e) {
        console.error('Stars send error:', e);
        res.status(500).json({ error: e.message || 'Ошибка отправки счёта' });
    }
});

module.exports = router;
