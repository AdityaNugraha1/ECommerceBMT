const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  try {
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(limit) || limit < 1) limit = 6;
    if (limit > 100) limit = 100;

    const offset = (page - 1) * limit;

    db.get('SELECT COUNT(*) as total FROM products', [], (cntErr, cntRow) => {
      if (cntErr) {
        console.error('Products count error:', cntErr);
        return res.status(500).json({ error: 'Failed to read products count' });
      }
      const total = cntRow ? cntRow.total : 0;
      const totalPages = Math.max(1, Math.ceil(total / limit));

      db.all('SELECT * FROM products ORDER BY id LIMIT ? OFFSET ?', [limit, offset], (err, rows) => {
        if (err) {
          console.error('Products query error:', err);
          return res.status(500).json({ error: 'Failed to load products' });
        }
        res.json({
          items: rows,
          total,
          page,
          totalPages,
          limit
        });
      });
    });
  } catch (e) {
    console.error('Unexpected error in GET /products:', e);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

router.post('/', (req, res) => {
  const { name, price, stock, description, image } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
  db.run(`INSERT INTO products(name, price, stock, description, image) VALUES(?, ?, ?, ?, ?)`, [name, price, stock || 0, description || null, image || null], function (err) {
    if (err) {
      console.error('Insert product error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
});

module.exports = router;
