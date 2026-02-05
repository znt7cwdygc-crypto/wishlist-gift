const { Pool } = require('pg');
require('dotenv').config();

// Render, Railway, Heroku и др. передают DATABASE_URL
const config = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
} : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'wishlist_gift',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(config);

const utf8Clients = new WeakSet();

async function ensureUtf8(client) {
    if (utf8Clients.has(client)) return;
    await client.query("SET client_encoding TO 'UTF8'");
    utf8Clients.add(client);
}

async function query(text, params) {
    const client = await pool.connect();
    try {
        await ensureUtf8(client);
        return await client.query(text, params);
    } finally {
        client.release();
    }
}

pool.on('connect', (client) => {
    console.log('✅ Database connected');
});

pool.on('error', (err) => {
    console.error('❌ Database connection error:', err);
});

async function connect() {
    const client = await pool.connect();
    await ensureUtf8(client);
    return client;
}

module.exports = {
    query,
    connect,
    pool
};


