#!/usr/bin/env node
/**
 * Настройка Render: добавляет BOT_TOKEN и JWT_SECRET в переменные окружения сервиса.
 * 
 * Использование:
 *   RENDER_API_KEY=xxx BOT_TOKEN=xxx node scripts/setup-render.js
 *   RENDER_API_KEY=xxx BOT_TOKEN=xxx SERVICE_NAME=wishlist-gift node scripts/setup-render.js
 * 
 * RENDER_API_KEY — получить: dashboard.render.com → Account Settings → API Keys
 */

const RENDER_API = 'https://api.render.com/v1';

async function request(method, path, apiKey, body = null) {
    const url = `${RENDER_API}${path}`;
    const opts = {
        method,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.message || data?.error || text || `HTTP ${res.status}`);
    }
    return data;
}

async function main() {
    const apiKey = process.env.RENDER_API_KEY;
    const botToken = process.env.BOT_TOKEN;
    const serviceName = process.env.SERVICE_NAME || 'wishlist-gift';

    if (!apiKey) {
        console.error('Ошибка: нужен RENDER_API_KEY');
        console.error('  RENDER_API_KEY=xxx BOT_TOKEN=xxx node scripts/setup-render.js');
        process.exit(1);
    }
    if (!botToken) {
        console.error('Ошибка: нужен BOT_TOKEN (токен от @BotFather)');
        process.exit(1);
    }

    console.log('Ищем сервис...');
    const services = await request('GET', '/services', apiKey);
    const svc = services.find(s => s.service?.name === serviceName)?.service
        || services.find(s => s.name === serviceName);
    
    if (!svc) {
        console.error(`Сервис "${serviceName}" не найден. Доступные:`, 
            services.map(s => s.service?.name || s.name).join(', ') || '(нет)');
        process.exit(1);
    }
    const serviceId = svc.id;
    console.log(`Сервис: ${svc.name} (${serviceId})`);

    console.log('Читаю текущие переменные...');
    const envVars = await request('GET', `/services/${serviceId}/env-vars`, apiKey);
    const list = Array.isArray(envVars) ? envVars : (envVars.envVars || []);
    
    const existing = new Map();
    for (const ev of list) {
        const key = ev.envVar?.key || ev.key;
        if (key) existing.set(key, ev.envVar?.value ?? ev.value ?? '');
    }

    existing.set('BOT_TOKEN', botToken);
    if (!existing.has('JWT_SECRET')) {
        const crypto = await import('crypto');
        existing.set('JWT_SECRET', crypto.randomBytes(32).toString('hex'));
    }

    const payload = Array.from(existing.entries()).map(([key, value]) => ({
        key,
        value,
        sync: false,
    }));

    console.log('Обновляю переменные (BOT_TOKEN, JWT_SECRET)...');
    await request('PUT', `/services/${serviceId}/env-vars`, apiKey, payload);
    console.log('Готово. BOT_TOKEN и JWT_SECRET добавлены.');
    console.log('Render перезапустит сервис автоматически.');
}

main().catch(err => {
    console.error('Ошибка:', err.message);
    process.exit(1);
});
