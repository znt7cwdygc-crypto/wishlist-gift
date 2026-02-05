/**
 * Сброс данных БД: подарки, заказы, донаты, инвайты.
 * Пользователи и профили (users, model_profiles) сохраняются — пользователи заново добавляют подарки.
 * Запуск: node scripts/reset-db.js
 * На сервере: cd /opt/wishlist-gift-v2 && node scripts/reset-db.js
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
        await pool.query('TRUNCATE TABLE donations');
        await pool.query('TRUNCATE TABLE invite_tokens');
        await pool.query('TRUNCATE TABLE wishlist_access_requests');
        await pool.query('TRUNCATE TABLE wishlist_allowed_users');
        await pool.query('TRUNCATE TABLE orders');
        await pool.query('TRUNCATE TABLE wishlist_items RESTART IDENTITY CASCADE');
        await pool.query(
            'UPDATE model_balances SET total_stars_earned = 0, available_for_withdrawal = 0, pending_21_days = 0, withdrawn = 0'
        );
        console.log('✅ БД сброшена: подарки, заказы, донаты, инвайты удалены. Пользователи и профили сохранены.');
    } catch (err) {
        console.error('❌ Ошибка сброса:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
