// backend/services/auth/index.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../../shared/config');

const router = express.Router();

// POST /api/auth/login
router.post('/api/auth/login', async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
  const db = req.app.locals.db;
  try {
    const { rows } = await db.query('SELECT id, email, password_hash FROM users WHERE email=$1 AND deleted_at IS NULL', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
    return res.json({ token });
  } catch (err) {
    // handle DB unavailable or other errors gracefully
    if (err && err.message && err.message.toLowerCase().includes('db unavailable')) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    return next(err);
  }
});

module.exports = router;
