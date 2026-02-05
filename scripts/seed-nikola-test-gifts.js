/**
 * Добавить 3 тестовых подарка в профиль Nikola (model_id=2): 1, 2, 3 звезды.
 * Запуск: node scripts/seed-nikola-test-gifts.js
 * На сервере: cd /opt/wishlist-gift-v2 && node scripts/seed-nikola-test-gifts.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../server/db');

const NIKOLA_MODEL_ID = 2;
const TEST_GIFTS = [
    { name: 'Test 1 star', stars: 1 },
    { name: 'Test 2 stars', stars: 2 },
    { name: 'Test 3 stars', stars: 3 }
];

async function run() {
    try {
        for (const g of TEST_GIFTS) {
            const exists = await db.query(
                'SELECT id FROM wishlist_items WHERE model_id = $1 AND name = $2',
                [NIKOLA_MODEL_ID, g.name]
            );
            if (exists.rows.length === 0) {
                await db.query(
                    `INSERT INTO wishlist_items (model_id, name, description, url, price, currency, base_stars, fee_stars, total_stars, photos, item_status, is_active)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $7, '[]', 'available', true)`,
                    [NIKOLA_MODEL_ID, g.name, `Test gift ${g.stars} star(s)`, 'https://wishliststars.com', 0.01, 'USD', g.stars]
                );
            }
        }
        const check = await db.query(
            'SELECT id, name, total_stars FROM wishlist_items WHERE model_id = $1 AND name LIKE $2 ORDER BY total_stars',
            [NIKOLA_MODEL_ID, 'Test %']
        );
        console.log('✅ Добавлены тестовые подарки для Nikola (model_id=2):');
        check.rows.forEach(r => console.log('   ', r.id, r.name, r.total_stars + ' ⭐'));
    } catch (e) {
        console.error('Ошибка:', e.message);
        if (e.detail) console.error('Detail:', e.detail);
        process.exit(1);
    } finally {
        db.pool.end();
    }
}

run();
