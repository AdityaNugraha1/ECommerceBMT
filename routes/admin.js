const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'images');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
    cb(null, safe);
  }
});
const upload = multer({ storage });

router.post('/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'admin only' });
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const url = '/images/' + req.file.filename;
  res.json({ success: true, url });
});

router.get('/products', authMiddleware, (req, res) => {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'admin only' });
  db.all('SELECT * FROM products ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ items: rows });
  });
});

router.post('/products', authMiddleware, (req, res) => {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'admin only' });
  const { name, price, stock, description, image } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
  db.run(`INSERT INTO products(name, price, stock, description, image) VALUES(?, ?, ?, ?, ?)`,
    [name, price, stock || 0, description || null, image || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
});

router.put('/products/:id', authMiddleware, (req, res) => {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'admin only' });
  const id = req.params.id;
  const { name, price, stock, description, image } = req.body;

  db.get(`SELECT * FROM products WHERE id = ?`, [id], (gErr, existing) => {
    if (gErr) return res.status(500).json({ error: gErr.message });
    if (!existing) return res.status(404).json({ error: 'product not found' });

    const newName = (name != null && name !== '') ? name : existing.name;
    const newPrice = (price != null && price !== '') ? price : existing.price;
    const newStock = (stock != null && stock !== '') ? stock : existing.stock;
    const newDesc = (description != null) ? description : existing.description;
    const newImage = (image != null && image !== '') ? image : existing.image;

    db.run(`UPDATE products SET name = ?, price = ?, stock = ?, description = ?, image = ? WHERE id = ?`,
      [newName, newPrice, newStock, newDesc, newImage, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
      });
  });
});

router.delete('/products/:id', authMiddleware, (req, res) => {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'admin only' });
  const id = req.params.id;
  db.run(`DELETE FROM products WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
});

module.exports = router;
