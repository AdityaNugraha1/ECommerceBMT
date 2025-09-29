const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.post('/add', authMiddleware, (req, res) => {
  const user_id = req.user.id;
  if (req.user && req.user.is_admin) return res.status(403).json({ error: 'admins cannot use cart' });

  const { product_id, quantity } = req.body;
  if (!product_id || !quantity) return res.status(400).json({ error: 'product_id and quantity required' });

  db.get('SELECT stock FROM products WHERE id = ?', [product_id], (err, prod) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!prod) return res.status(404).json({ error: 'product not found' });
    if (quantity > prod.stock) return res.status(400).json({ error: 'quantity exceeds stock' });

    db.run(
      `INSERT INTO cart(user_id, product_id, quantity) VALUES(?, ?, ?)
       ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = quantity + excluded.quantity`,
      [user_id, product_id, quantity],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true });
      }
    );
  });
});

router.get('/', authMiddleware, (req, res) => {
  if (req.user && req.user.is_admin) return res.status(403).json({ error: 'admins have no cart' });
  const user_id = req.user.id;
  db.all(
    `SELECT c.product_id, p.name, p.price, c.quantity,
            (CASE WHEN p.price IS NULL THEN 0 ELSE p.price * c.quantity END) as subtotal,
            (CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) as deleted
     FROM cart c LEFT JOIN products p ON c.product_id = p.id
     WHERE c.user_id = ?`,
    [user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const total = rows.reduce((s, r) => s + Number(r.subtotal || 0), 0);
      const deletedCount = rows.filter(r => r.deleted).length;
      res.json({ items: rows, total, deletedCount });
    }
  );
});

router.post('/remove', authMiddleware, (req, res) => {
  if (req.user && req.user.is_admin) return res.status(403).json({ error: 'admins cannot modify cart' });
  const user_id = req.user.id;
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id required' });
  db.run(`DELETE FROM cart WHERE user_id = ? AND product_id = ?`, [user_id, product_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

router.post('/clear', authMiddleware, (req, res) => {
  if (req.user && req.user.is_admin) return res.status(403).json({ error: 'admins cannot clear cart' });
  const user_id = req.user.id;
  db.run(`DELETE FROM cart WHERE user_id = ?`, [user_id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

module.exports = router;
