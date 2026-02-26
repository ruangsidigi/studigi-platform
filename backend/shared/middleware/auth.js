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
    const { rows } = await db.query('SELECT id, email, display_name FROM users WHERE id=$1 AND deleted_at IS NULL', [payload.sub]);
    if (!rows[0]) return res.status(401).json({ error: 'Invalid token' });
    const user = rows[0];
    console.log('auth middleware: loading roles for user', { userId: user.id });
    const r = await db.query('SELECT roles.* FROM roles JOIN user_roles ur ON ur.role_id=roles.id WHERE ur.user_id=$1', [user.id]);
    user.roles = r.rows || [];
    req.user = user;
    next();
  } catch (err) {
    console.warn('auth middleware token error', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
