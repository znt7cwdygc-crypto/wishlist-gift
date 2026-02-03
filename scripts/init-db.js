/**
 * Инициализация БД при деплое
 * node scripts/init-db.js
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

async function init() {
    const pool = new Pool(config);
    try {
        const sql = fs.readFileSync(path.join(__dirname, '../schema/init.sql'), 'utf8');
        await pool.query(sql);
        console.log('✅ Database schema applied');
    } catch (err) {
        console.error('⚠️ Init:', err.message);
        if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            process.exit(1);
        }
    } finally {
        await pool.end();
    }
}

init();
