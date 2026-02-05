/**
 * Показать товары вишлиста для model_id=1 (проверка, что seed применился к этой БД)
 * node scripts/list-wishlist.js
 * DATABASE_URL=... node scripts/list-wishlist.js  — для прод/удалённой БД
 */
require('dotenv').config();
const { Pool } = require('pg');

const config = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
} : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'wishlist_gift',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
};

async function run() {
    const pool = new Pool(config);
    try {
        const r = await pool.query(
            'SELECT id, name, total_stars, item_status, is_active FROM wishlist_items WHERE model_id = 1 ORDER BY id'
        );
        console.log('Товары model_id=1:', r.rows.length);
        r.rows.forEach(row => console.log('  ', row.id, row.name, row.total_stars + '⭐', row.item_status, row.is_active ? 'active' : 'hidden'));
    } catch (err) {
        console.error('Ошибка:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
