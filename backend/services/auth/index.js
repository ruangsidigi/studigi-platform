// backend/services/auth/index.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../../shared/config');

const router = express.Router();

// POST /auth/register (mounted under /api)
router.post('/auth/register', async (req, res, next) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }

  const db = req.app.locals.db;
  const jwtSecret = config.jwtSecret || config.jwtSecretFallback;

  try {
    const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    if (existing.rows?.[0]) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let inserted;

    const insertAttempts = [
      {
        text: `INSERT INTO users (email, password_hash, display_name, created_at, updated_at)
               VALUES ($1, $2, $3, NOW(), NOW())
               RETURNING id, email, display_name, created_at`,
        values: [email, hashedPassword, name],
      },
      {
        text: `INSERT INTO users (email, password_hash, display_name, created_at)
               VALUES ($1, $2, $3, NOW())
               RETURNING id, email, display_name, created_at`,
        values: [email, hashedPassword, name],
      },
      {
        text: `INSERT INTO users (email, password, name, role, created_at, updated_at)
               VALUES ($1, $2, $3, 'user', NOW(), NOW())
               RETURNING id, email, name, role, created_at`,
        values: [email, hashedPassword, name],
      },
      {
        text: `INSERT INTO users (email, password, name, role, created_at)
               VALUES ($1, $2, $3, 'user', NOW())
               RETURNING id, email, name, role, created_at`,
        values: [email, hashedPassword, name],
      },
      {
        text: `INSERT INTO users (email, password, name, created_at)
               VALUES ($1, $2, $3, NOW())
               RETURNING id, email, name, created_at`,
        values: [email, hashedPassword, name],
      },
    ];

    let lastInsertError;
    for (const attempt of insertAttempts) {
      try {
        inserted = await db.query(attempt.text, attempt.values);
        if (inserted?.rows?.[0]) break;
      } catch (insertErr) {
        lastInsertError = insertErr;
      }
    }

    if (!inserted?.rows?.[0]) {
      throw lastInsertError || new Error('Failed to create user');
    }

    const user = inserted.rows?.[0];
    if (!user) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    try {
      const userRole = await db.query(`SELECT id FROM roles WHERE name = 'user' LIMIT 1`);
      if (userRole.rows?.[0]?.id) {
        await db.query(
          `INSERT INTO user_roles (user_id, role_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [user.id, userRole.rows[0].id]
        );
      }
    } catch (_) {
      // optional role mapping for schema that has roles table
    }

    const role = 'user';
    const token = jwt.sign({ sub: user.id, id: user.id, email: user.email, role }, jwtSecret, { expiresIn: '7d' });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name || user.name || name,
        role,
      },
    });
  } catch (err) {
    if (err && err.message && err.message.toLowerCase().includes('db unavailable')) {
      return res.status(503).json({ error: 'Database unavailable' });
    }
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
});

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
