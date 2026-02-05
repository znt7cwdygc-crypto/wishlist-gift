/**
 * Telegram Bot + Stars: /start с кнопками, callback → invoice, pre_checkout, successful_payment
 */

const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const db = require('../db');

let ordersRouter = null;
router.setOrdersRouter = (r) => { ordersRouter = r; };

const { getBotToken } = require('../bot-token');
const BOT_TOKEN = getBotToken();
const FAST_PRECHECKOUT = process.env.FAST_PRECHECKOUT === 'true';
const STAR_AMOUNTS = [50, 100, 250, 500, 1000];

async function telegramApi(method, body) {
    if (!BOT_TOKEN) return { ok: false };
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res.json();
}

// Создать Invoice для заказа (вишлист). Инвойс уходит в ТГ бота; факт оплаты узнаём только из webhook (successful_payment), не из веб-приложения.
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

        const itemRow = await db.query('SELECT name FROM wishlist_items WHERE id = $1', [order.item_id]);
        const modelRow = await db.query('SELECT first_name, username FROM users WHERE id = $1', [order.model_id]);
        const itemName = itemRow.rows[0]?.name || title || 'Подарок';
        const modelName = modelRow.rows[0]?.first_name || modelRow.rows[0]?.username || 'Модель';
        const recipientLabel = modelName.startsWith('@') ? modelName : (modelName || 'получатель');

        // ID подарка (wishlist_items.id) — уникальный, привязан к модели-создателю
        const giftId = order.item_id;
        const invoiceTitle = `Подарок #${giftId}: ${itemName}`;
        const invoiceDesc = `ID подарка: ${giftId}. Для: ${recipientLabel}. Оплата через Telegram Stars.`;

        const payload = `order:${orderId}`;
        const result = await telegramApi('sendInvoice', {
            chat_id: order.donor_telegram_id,
            provider_token: '',
            title: invoiceTitle,
            description: invoiceDesc,
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

// Webhook от Telegram (setWebhook на боте → этот URL).
// Оплату учитываем только по событию successful_payment из бота, не из веб-приложения.
// КРИТИЧНО: answerPreCheckoutQuery — в течение 10 сек, иначе BOT_PRECHECKOUT_TIMEOUT
const PRECHECKOUT_TIMEOUT_MS = 8000;

router.get('/telegram-webhook', (req, res) => {
    res.status(200).json({ ok: true, webhook: 'use POST for Telegram updates' });
});

function withTimeout(promise, ms, fallback) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]).catch(e => { if (e.message === 'timeout') return fallback; throw e; });
}

async function processUpdate(body) {
    if (!body) return;
    const updateType = body.pre_checkout_query ? 'pre_checkout_query'
        : (body.message?.successful_payment ? 'successful_payment' : 'other');
    console.log('[Updates] update_id=', body.update_id, 'type=', updateType);
    try {
        if (body.message?.text?.startsWith('/start')) {
            const chatId = body.message.chat.id;
            console.log('[Updates] /start from chat', chatId);
            const keyboard = {
                inline_keyboard: [
                    STAR_AMOUNTS.map(a => ({ text: `⭐ ${a}`, callback_data: `stars_${a}` }))
                ]
            };
            const sendRes = await telegramApi('sendMessage', {
                chat_id: chatId,
                text: '⭐ Отправить Telegram Stars\n\nВыберите сумму:',
                reply_markup: JSON.stringify(keyboard)
            });
            if (!sendRes.ok) console.error('[Updates] sendMessage failed:', sendRes);
        }

        // callback_query — нажатие кнопки (stars_50, stars_100, ...)
        if (body.callback_query) {
            const cq = body.callback_query;
            const data = cq.data || '';
            const chatId = cq.message?.chat?.id;
            const userId = cq.from?.id;
            const username = cq.from?.username;

            await telegramApi('answerCallbackQuery', { callback_query_id: cq.id });

            if (data.startsWith('stars_')) {
                const amount = parseInt(data.replace('stars_', ''), 10) || 100;
                if (amount < 1) return;

                const payload = `donate:${randomUUID()}`;
                await db.query(
                    `INSERT INTO donations (payload, amount_xtr, donor_telegram_id, donor_username, status)
                     VALUES ($1, $2, $3, $4, 'pending')`,
                    [payload, amount, userId, username || null]
                );

                const inv = await telegramApi('sendInvoice', {
                    chat_id: chatId,
                    provider_token: '',
                    title: 'Stars',
                    description: 'Оплата через Telegram Stars',
                    payload,
                    currency: 'XTR',
                    prices: [{ label: 'Stars', amount }]
                });
                if (!inv.ok) {
                    await telegramApi('sendMessage', {
                        chat_id: chatId,
                        text: `Ошибка: ${inv.description || 'не удалось создать счёт'}`
                    });
                }
            }
        }

        if (body.pre_checkout_query) {
            const pq = body.pre_checkout_query;
            const payload = typeof pq.invoice_payload === 'string' ? pq.invoice_payload.trim() : String(pq.invoice_payload || '');
            const amount = parseInt(pq.total_amount, 10) || 0;
            const t0 = Date.now();
            console.log('[pre_checkout]', { id: pq.id, payload: payload.slice(0, 30), amount, currency: pq.currency });

            let ok = false;
            let errorMsg = 'Ошибка';

            if (FAST_PRECHECKOUT && payload.startsWith('donate:')) {
                ok = true;
                console.log('[pre_checkout] FAST mode — skip DB');
            } else try {
                if (payload.startsWith('donate:')) {
                    const r = await withTimeout(
                        db.query('SELECT id, amount_xtr, status FROM donations WHERE payload = $1', [payload]),
                        PRECHECKOUT_TIMEOUT_MS,
                        { rows: [] }
                    );
                    const d = r.rows?.[0];
                    const dbAmount = parseInt(d?.amount_xtr, 10) || 0;
                    if (d && d.status === 'pending' && dbAmount === amount) ok = true;
                    else if (!d) errorMsg = 'Донат не найден';
                    else if (d.status !== 'pending') errorMsg = 'Уже оплачено';
                    else if (dbAmount !== amount) errorMsg = 'Сумма не совпадает';
                } else if (payload.startsWith('order:') && ordersRouter?.findOrderByPayload) {
                    const order = await withTimeout(
                        ordersRouter.findOrderByPayload(payload),
                        PRECHECKOUT_TIMEOUT_MS,
                        null
                    );
                    const orderAmount = parseInt(order?.amount_xtr, 10) || 0;
                    if (order && order.status === 'reserved' && orderAmount === amount) ok = true;
                    else if (!order) errorMsg = 'Заказ не найден';
                    else if (order.status !== 'reserved') errorMsg = 'Позиция уже занята';
                    else if (orderAmount !== amount) errorMsg = 'Сумма не совпадает';
                } else errorMsg = 'Неизвестный payload';
            } catch (dbErr) {
                console.error('[pre_checkout] DB/timeout error:', dbErr.message);
                errorMsg = 'Попробуйте через минуту';
            }

            const answerRes = await telegramApi('answerPreCheckoutQuery', {
                pre_checkout_query_id: pq.id,
                ok,
                error_message: ok ? undefined : errorMsg
            });
            const elapsed = Date.now() - t0;
            console.log('[Updates] pre_checkout answer', ok ? 'OK' : 'REJECT', `${elapsed}ms`, answerRes.ok ? '' : answerRes);
            if (!answerRes.ok) console.error('answerPreCheckoutQuery failed:', answerRes);
        }

        if (body.message?.successful_payment) {
            const msg = body.message;
            const sp = msg.successful_payment;
            const payload = typeof sp.invoice_payload === 'string' ? sp.invoice_payload.trim() : String(sp.invoice_payload || '');
            const chargeId = sp.telegram_payment_charge_id;
            const chatId = msg.chat?.id;
            const amount = sp.total_amount || 0;
            const fromUser = msg.from;
            const username = fromUser?.username ? `@${fromUser.username}` : (fromUser?.first_name || 'Пользователь');

            if (payload.startsWith('donate:')) {
                await db.query(
                    `UPDATE donations SET status = 'paid', telegram_payment_charge_id = $2, paid_at = CURRENT_TIMESTAMP
                     WHERE payload = $1 AND status = 'pending'`,
                    [payload, chargeId]
                );
                if (chatId) {
                    await telegramApi('sendMessage', {
                        chat_id: chatId,
                        text: `✅ Спасибо! Оплата ${amount} Stars получена.`
                    });
                }
                const adminChatId = process.env.ADMIN_CHAT_ID;
                if (adminChatId) {
                    await telegramApi('sendMessage', {
                        chat_id: adminChatId,
                        text: `💰 Донат: ${amount} Stars от ${username} (id: ${fromUser?.id || '-'})`
                    });
                }
            } else if (payload.startsWith('order:')) {
                console.log('[Updates] successful_payment payload=', JSON.stringify(payload), 'len=', payload.length, 'amount=', amount);
                let order = ordersRouter?.findOrderByPayload
                    ? await ordersRouter.findOrderByPayload(payload)
                    : null;
                if (!order) {
                    const orderIdFromPayload = payload.replace(/^order:/, '').trim();
                    if (orderIdFromPayload) {
                        const byId = await db.query('SELECT * FROM orders WHERE id = $1', [orderIdFromPayload]);
                        order = byId.rows[0] || null;
                        if (order) console.log('[Updates] Order found by id from payload:', orderIdFromPayload);
                    }
                }
                if (!order) {
                    console.error('[Updates] Order not found for payload:', payload);
                    try {
                        const allPayloads = await db.query('SELECT id, telegram_invoice_payload, status FROM orders WHERE telegram_invoice_payload LIKE $1 LIMIT 5', ['order:%']);
                        console.error('[Updates] Sample payloads in DB:', allPayloads.rows.map(r => ({ id: r.id, payload: r.telegram_invoice_payload, status: r.status })));
                    } catch (e) { /* ignore */ }
                } else {
                    try {
                        await ordersRouter.markOrderPaid(order.id, chargeId);
                        const itemR = await db.query('SELECT name FROM wishlist_items WHERE id = $1', [order.item_id]);
                        const modelR = await db.query('SELECT first_name, username, telegram_id FROM users WHERE id = $1', [order.model_id]);
                        const itemName = itemR.rows[0]?.name || 'Подарок';
                        const modelName = modelR.rows[0]?.first_name || modelR.rows[0]?.username || 'получатель';
                        const rawTid = modelR.rows[0]?.telegram_id;
                        const modelChatId = rawTid != null ? String(rawTid).trim() : null;

                        // Сначала уведомление модели (получателю подарка) — не должно зависеть от отправки дарителю
                        if (modelChatId) {
                            const donorLabel = username !== 'Пользователь' ? ` от ${username}` : '';
                            try {
                                const modelSendRes = await telegramApi('sendMessage', {
                                    chat_id: modelChatId,
                                    text: `🎁 Вам подарили: «${itemName}». Стоимость: ${amount} ⭐${donorLabel}`
                                });
                                if (modelSendRes.ok) {
                                    console.log('[Updates] Notify model sent OK:', order.model_id, itemName);
                                } else {
                                    console.warn('[Updates] Notify model failed:', modelSendRes.description, { model_id: order.model_id, chat_id: modelChatId });
                                }
                            } catch (notifyErr) {
                                console.error('[Updates] Notify model error:', notifyErr.message, { model_id: order.model_id });
                            }
                        } else {
                            console.warn('[Updates] No telegram_id for model_id:', order.model_id, '— уведомление не отправлено');
                        }

                        // Затем сообщение дарителю (не блокирует уведомление модели при ошибке)
                        if (chatId) {
                            try {
                                const donorRes = await telegramApi('sendMessage', {
                                    chat_id: chatId,
                                    text: `✅ Подарок «${itemName}» для ${modelName} оплачен! ${amount} ⭐`
                                });
                                if (!donorRes.ok) console.warn('[Updates] Notify donor failed:', donorRes.description);
                            } catch (donorErr) {
                                console.error('[Updates] Notify donor error:', donorErr.message);
                            }
                        }
                    } catch (err) {
                        console.error('[Updates] markOrderPaid failed:', err.message, { orderId: order.id });
                    }
                }
            }
        }
    } catch (e) {
        console.error('[Updates] error:', e);
        if (body?.pre_checkout_query?.id && BOT_TOKEN) {
            try {
                await telegramApi('answerPreCheckoutQuery', {
                    pre_checkout_query_id: body.pre_checkout_query.id,
                    ok: false,
                    error_message: 'Временная ошибка, попробуйте позже'
                });
            } catch (e2) {
                console.error('answerPreCheckoutQuery fallback error:', e2);
            }
        }
    }
}

router.post('/telegram-webhook', async (req, res) => {
    res.sendStatus(200);
    processUpdate(req.body).catch(e => console.error('[Webhook]', e));
});

router.post('/initiate', (req, res) => {
    res.json({ success: true, message: 'Используйте POST /invoice или /api/stars/send' });
});

router.processUpdate = processUpdate;
module.exports = router;
