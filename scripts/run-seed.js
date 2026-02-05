/**
 * Выполнить seed: тестовые товары по 1 звезде
 * node scripts/run-seed.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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
        const sql = fs.readFileSync(path.join(__dirname, 'seed-test-wishlist.sql'), 'utf8');
        const statements = sql
            .split(/;\s*\n/)
            .map(s => s.replace(/--[^\n]*/g, '').trim())
            .filter(s => s.length > 0);
        for (const st of statements) {
            await pool.query(st + ';');
        }
        console.log('✅ Seed выполнен: 5 тестовых товаров по 1 ⭐');
        console.log('   Если не видите их в приложении — приложение может использовать другую БД.');
        console.log('   Для прод/удалённой БД: DATABASE_URL="postgresql://..." node scripts/run-seed.js');
    } catch (err) {
        console.error('❌ Seed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
