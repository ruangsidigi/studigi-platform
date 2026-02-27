// backend/shared/middleware/auth.js
// Parses Bearer JWT, verifies and loads user + roles into req.user
const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  const token = header.slice(7);
  try {
    const jwtSecret = config.jwtSecret || config.jwtSecretFallback;
    const payload = jwt.verify(token, jwtSecret);
    // load user with roles from DB
    const db = req.app.locals.db;
    console.log('auth middleware: token verified, loading user', { sub: payload && payload.sub });
    const userId = payload?.sub || payload?.id;
    const { rows } = await db.query('SELECT * FROM users WHERE id=$1 LIMIT 1', [userId]);
    if (!rows[0]) return res.status(401).json({ error: 'Invalid token' });
    const rowUser = rows[0];
    const user = {
      id: rowUser.id,
      email: rowUser.email,
      display_name: rowUser.display_name || rowUser.name || rowUser.email,
      role: rowUser.role || payload?.role || 'user',
    };
    console.log('auth middleware: loading roles for user', { userId: user.id });
    try {
      const r = await db.query('SELECT roles.* FROM roles JOIN user_roles ur ON ur.role_id=roles.id WHERE ur.user_id=$1', [user.id]);
      user.roles = r.rows || [];
      const adminRole = user.roles.find((role) => String(role?.name || '').toLowerCase() === 'admin');
      if (adminRole) {
        user.role = 'admin';
      } else if (!rowUser.role && payload?.role) {
        user.role = payload.role;
      }
    } catch (_) {
      user.roles = [];
      if (!rowUser.role && payload?.role) {
        user.role = payload.role;
      }
    }
    req.user = user;
    next();
  } catch (err) {
    console.warn('auth middleware token error', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
