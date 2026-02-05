/**
 * Long Polling (getUpdates) — приём оплат без webhook.
 * Telegram может отдавать обновления либо на webhook, либо через getUpdates.
 * Мы снимаем webhook и забираем обновления сами, чтобы оплаты всегда обрабатывались.
 */

const { getBotToken } = require('./bot-token');
const db = require('./db');

let ordersRouter = null;
let processUpdate = null;

function setOrdersRouter(r) { ordersRouter = r; }
function setProcessUpdate(fn) { processUpdate = fn; }

async function getUpdates(offset, timeout = 50) {
    const token = getBotToken();
    if (!token) return { ok: false, result: [] };
    const res = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=${timeout}`
    );
    return res.json();
}

async function deleteWebhook() {
    const token = getBotToken();
    if (!token) return;
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
    const data = await res.json();
    if (data.ok) {
        console.log('[Polling] Webhook снят, используем getUpdates');
    } else {
        console.warn('[Polling] deleteWebhook:', data.description);
    }
}

function startPolling() {
    const token = getBotToken();
    if (!token || !processUpdate || !ordersRouter) {
        if (!token) console.log('[Polling] BOT_TOKEN не задан — опрос не запущен');
        return;
    }

    let offset = 0;

    const poll = async () => {
        try {
            const data = await getUpdates(offset, 50);
            if (!data.ok || !Array.isArray(data.result)) {
                setTimeout(poll, 2000);
                return;
            }
            for (const update of data.result) {
                offset = update.update_id + 1;
                try {
                    await processUpdate(update);
                } catch (e) {
                    console.error('[Polling] processUpdate error:', e.message);
                }
            }
        } catch (e) {
            console.warn('[Polling] getUpdates error:', e.message);
        }
        setImmediate(poll);
    };

    deleteWebhook().then(() => {
        console.log('[Polling] Запуск опроса getUpdates для приёма оплат');
        poll();
    }).catch(e => {
        console.warn('[Polling] start failed:', e.message);
    });
}

module.exports = { startPolling, setOrdersRouter, setProcessUpdate };
