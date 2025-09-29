const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../middleware/auth');

router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });

  const reserved = ['admin', 'admin@example.com'];
  if (reserved.includes(String(email).toLowerCase()) || reserved.includes(String(name).toLowerCase())) {
    return res.status(400).json({ error: 'reserved username/email' });
  }

  db.get(`SELECT id FROM users WHERE email = ?`, [email], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: 'email already registered' });

    bcrypt.hash(password, 10, (hashErr, hash) => {
      if (hashErr) return res.status(500).json({ error: hashErr.message });
      db.run(`INSERT INTO users(name, email, password, is_admin) VALUES(?, ?, ?, 0)`, [name, email, hash], function (insErr) {
        if (insErr) return res.status(500).json({ error: insErr.message });
        const user = { id: this.lastID, email, name, is_admin: 0 };
        const token = jwt.sign(user, SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user });
      });
    });
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email, password required' });

  db.get(`SELECT id, email, password, name, is_admin FROM users WHERE email = ?`, [email], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(400).json({ error: 'invalid credentials' });

    bcrypt.compare(password, row.password, (cmpErr, same) => {
      if (cmpErr) return res.status(500).json({ error: cmpErr.message });
      if (!same) return res.status(400).json({ error: 'invalid credentials' });

      const user = { id: row.id, email: row.email, name: row.name, is_admin: row.is_admin ? 1 : 0 };
      const token = jwt.sign(user, SECRET, { expiresIn: '7d' });
      res.json({ success: true, token, user });
    });
  });
});

module.exports = router;
