#!/usr/bin/env node
/**
 * Запуск: инициализация БД + сервер
 */
const { spawn } = require('child_process');

async function main() {
    // 1. Инициализация БД
    const init = spawn('node', ['scripts/init-db.js'], {
        stdio: 'inherit',
        env: process.env
    });
    const initCode = await new Promise(r => init.on('close', r));
    if (initCode !== 0) {
        console.warn('⚠️ DB init failed (tables may already exist), continuing...');
    }

    // 2. Запуск сервера
    const server = spawn('node', ['server/index.js'], {
        stdio: 'inherit',
        env: process.env
    });
    server.on('close', code => process.exit(code || 0));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
