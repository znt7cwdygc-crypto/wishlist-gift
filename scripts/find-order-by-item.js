#!/usr/bin/env node
const itemName = process.argv[2] || 'macbook2';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../server/db');
db.query(
  `SELECT o.id, o.status, w.name AS item_name, o.model_id
   FROM orders o
   JOIN wishlist_items w ON w.id = o.item_id
   WHERE o.model_id = 2 AND LOWER(w.name) LIKE $1
   ORDER BY o.reserved_at DESC LIMIT 5`,
  ['%' + itemName.toLowerCase() + '%']
).then(r => {
  console.log(JSON.stringify(r.rows, null, 2));
  if (r.rows[0]) console.log('\nOrder ID to mark paid:', r.rows[0].id);
  process.exit(0);
}).catch(e => {
  console.error(e.message);
  process.exit(1);
});
