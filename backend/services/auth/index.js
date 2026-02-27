// backend/services/auth/index.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../../shared/config');

const router = express.Router();

// POST /auth/login (mounted under /api)
router.post('/auth/login', async (req, res, next) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
  const db = req.app.locals.db;
  const jwtSecret = config.jwtSecret || config.jwtSecretFallback;
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1 LIMIT 1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const storedHash = user.password_hash || user.password || '';
    const ok = await bcrypt.compare(password, storedHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    let role = user.role || 'user';
    try {
      const roleResult = await db.query(
        `SELECT r.name
         FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = $1
         ORDER BY r.name = 'admin' DESC, r.name ASC
         LIMIT 1`,
        [user.id]
      );
      if (roleResult.rows[0]?.name) role = roleResult.rows[0].name;
    } catch (_) {
      role = user.role || 'user';
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase();
    if (String(user.email || '').toLowerCase() === adminEmail) {
      role = 'admin';
    }

    const token = jwt.sign({ sub: user.id, id: user.id, email: user.email, role }, jwtSecret, { expiresIn: '7d' });
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name || user.name || user.email,
        role,
      },
    });
  } catch (err) {
    // handle DB unavailable or other errors gracefully
    if (err && err.message && err.message.toLowerCase().includes('db unavailable')) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    return next(err);
  }
});

module.exports = router;
