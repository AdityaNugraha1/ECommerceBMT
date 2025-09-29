const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, (req, res) => {
  const user_id = req.user.id;
  if (req.user && req.user.is_admin) return res.status(403).json({ error: 'admins cannot checkout' });

  db.all(
    `SELECT c.product_id, p.name as product_name, p.price, c.quantity, p.stock
     FROM cart c JOIN products p ON c.product_id = p.id
     WHERE c.user_id = ?`,
    [user_id],
    (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!items || items.length === 0) return res.status(400).json({ error: 'cart empty' });

      for (const it of items) {
        if (it.quantity > it.stock) return res.status(400).json({ error: `Not enough stock for product ${it.product_id}` });
      }

      const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const date = new Date().toISOString();

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(`INSERT INTO transactions(user_id, total, date) VALUES (?, ?, ?)`, [user_id, total, date], function (txErr) {
          if (txErr) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: txErr.message });
          }
          const transaction_id = this.lastID;
          const insertItemStmt = db.prepare(`INSERT INTO transaction_items(transaction_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)`);
          const updateStockStmt = db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`);

          for (const it of items) {
            insertItemStmt.run([transaction_id, it.product_id, it.product_name, it.quantity, it.price]);
            updateStockStmt.run([it.quantity, it.product_id]);
          }

          insertItemStmt.finalize();
          updateStockStmt.finalize();

          db.run(`DELETE FROM cart WHERE user_id = ?`, [user_id], (delErr) => {
            if (delErr) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: delErr.message });
            }
            db.run('COMMIT');
            res.json({ success: true, transaction_id, total });
          });
        });
      });
    }
  );
});

module.exports = router;
