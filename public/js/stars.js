/**
 * Простое приложение для приёма Telegram Stars
 */

const tg = window.Telegram?.WebApp;
const AMOUNTS = [50, 100, 250, 500, 1000];
let selectedAmount = 0;

function init() {
    if (tg) {
        tg.ready();
        tg.expand();
    }

    const container = document.getElementById('amounts');
    container.innerHTML = AMOUNTS.map(a => 
        `<button class="amount-btn" data-amount="${a}">⭐ ${a}</button>`
    ).join('');

    container.querySelectorAll('.amount-btn').forEach(btn => {
        btn.onclick = () => selectAmount(parseInt(btn.dataset.amount));
    });

    document.getElementById('send-btn').onclick = sendStars;
}

function selectAmount(amount) {
    selectedAmount = amount;
    document.querySelectorAll('.amount-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.amount) === amount);
    });
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = false;
    sendBtn.textContent = `Отправить ⭐ ${amount}`;
}

async function sendStars() {
    if (!selectedAmount) return;
    const sendBtn = document.getElementById('send-btn');
    const hint = document.getElementById('hint');
    sendBtn.disabled = true;

    if (!tg?.initData) {
        hint.textContent = 'Откройте приложение через Telegram';
        sendBtn.disabled = false;
        return;
    }

    try {
        const res = await fetch('/api/stars/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: selectedAmount,
                initData: tg.initData
            })
        });
        const data = await res.json();

        if (!res.ok) {
            hint.textContent = data.error || 'Ошибка';
            sendBtn.disabled = false;
            return;
        }

        hint.textContent = 'Счёт отправлен! Проверьте чат выше и нажмите Pay.';
        if (tg?.showAlert) tg.showAlert('Счёт в чате. Нажмите Pay в сообщении.');
    } catch (e) {
        hint.textContent = 'Ошибка: ' + (e.message || 'проверьте интернет');
        sendBtn.disabled = false;
    }
}

init();
