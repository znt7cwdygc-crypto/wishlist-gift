#!/usr/bin/env node
/**
 * Проверка подарков пользователю Nikola на сервере.
 * Запуск на сервере: cd /opt/wishlist-gift-v2 && node scripts/check-nikola.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../server/db');

async function main() {
    try {
        const usersRes = await db.query(
            `SELECT id, first_name, username, telegram_id FROM users 
             WHERE LOWER(first_name) LIKE '%nikola%' OR LOWER(username) LIKE '%nikola%'`
        );
        console.log('Users (Nikola):', JSON.stringify(usersRes.rows, null, 2));

        if (usersRes.rows.length === 0) {
            console.log('Пользователь Nikola не найден в БД.');
            const allUsers = await db.query('SELECT id, first_name, username FROM users ORDER BY id');
            console.log('Все пользователи:', JSON.stringify(allUsers.rows, null, 2));
        } else {
            const uid = usersRes.rows[0].id;
            const ordersRes = await db.query(
                `SELECT o.id, o.status, o.amount_xtr, o.paid_at, o.telegram_payment_charge_id,
                        w.name AS item_name, w.item_status
                 FROM orders o
                 JOIN wishlist_items w ON w.id = o.item_id
                 WHERE o.model_id = $1
                 ORDER BY o.reserved_at DESC`,
                [uid]
            );
            console.log('\nЗаказы для model_id', uid, '(Nikola):', JSON.stringify(ordersRes.rows, null, 2));

            const paid = ordersRes.rows.filter(r => r.status === 'paid');
            if (paid.length) {
                console.log('\n--- Подарены Nikola (status=paid) ---');
                paid.forEach(o => {
                    console.log(`  • ${o.item_name}, ${o.amount_xtr} ⭐, paid_at: ${o.paid_at}`);
                });
            }
        }

        const paidCount = await db.query("SELECT COUNT(*) AS c FROM orders WHERE status = 'paid'");
        console.log('\nВсего оплаченных заказов в БД:', paidCount.rows[0].c);
    } catch (e) {
        console.error(e);
    } finally {
        db.pool.end();
    }
}

main();
