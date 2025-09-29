const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  const user_id = req.user.id;
  const sql = `
    SELECT t.id as transaction_id, t.total, t.date,
           ti.product_id, ti.product_name, ti.quantity, ti.price, p.name as current_name
    FROM transactions t
    LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
    LEFT JOIN products p ON p.id = ti.product_id
    WHERE t.user_id = ?
    ORDER BY t.date DESC, t.id DESC
  `;
  db.all(sql, [user_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const map = {};
    for (const r of rows) {
      if (!map[r.transaction_id]) {
        map[r.transaction_id] = { id: r.transaction_id, total: r.total, date: r.date, items: [] };
      }
      if (r.product_id || r.product_name) {
        map[r.transaction_id].items.push({
          product_id: r.product_id,
          name: r.product_name || r.current_name || 'Unknown',
          quantity: r.quantity,
          price: r.price
        });
      }
    }
    const transactions = Object.values(map);
    res.json({ transactions });
  });
});

module.exports = router;
