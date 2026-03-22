// backend/shared/middleware/auth.js
// Parses Bearer JWT, verifies and loads user + roles into req.user
const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();
  const token = header.slice(7);

  // Step 1: verify JWT signature/expiry.
  // Do NOT reject here — let individual routes enforce auth so public endpoints
  // (like GET /api/packages) still work even when the client sends an expired token.
  let payload;
  try {
    const jwtSecret = config.jwtSecret || config.jwtSecretFallback;
    payload = jwt.verify(token, jwtSecret);
  } catch (err) {
    console.warn('auth middleware: invalid/expired token, skipping user load', err.message);
    return next(); // skip req.user; protected routes will respond with 401 themselves
  }

  // Step 2: enrich with DB data. Fall back to JWT payload if DB is unavailable
  // so infra issues do not block all authenticated requests with false 401s.
  try {
    const db = req.app.locals.db;
    console.log('auth middleware: token verified, loading user', { sub: payload && payload.sub });
    const userId = payload && (payload.sub || payload.id);
    const { rows } = await db.query('SELECT * FROM users WHERE id=$1 LIMIT 1', [userId]);
    if (!rows[0]) return res.status(401).json({ error: 'Invalid token' });
    const rowUser = rows[0];
    const user = {
      id: rowUser.id,
      email: rowUser.email,
      display_name: rowUser.display_name || rowUser.name || rowUser.email,
      role: rowUser.role || (payload && payload.role) || 'user',
    };
    console.log('auth middleware: loading roles for user', { userId: user.id });
    try {
      const r = await db.query('SELECT roles.* FROM roles JOIN user_roles ur ON ur.role_id=roles.id WHERE ur.user_id=$1', [user.id]);
      user.roles = r.rows || [];
      const adminRole = user.roles.find(function(role) { return String(role && role.name || '').toLowerCase() === 'admin'; });
      if (adminRole) {
        user.role = 'admin';
      } else if (!rowUser.role && payload && payload.role) {
        user.role = payload.role;
      }
    } catch (_) {
      user.roles = [];
      if (!rowUser.role && payload && payload.role) {
        user.role = payload.role;
      }
    }
    req.user = user;
  } catch (dbErr) {
    // DB unavailable -- use JWT payload so requests are not blocked by infra issues.
    console.warn('auth middleware: DB unavailable, using JWT payload fallback', dbErr.message);
    req.user = {
      id: payload && (payload.sub || payload.id),
      email: (payload && payload.email) || '',
      display_name: (payload && (payload.display_name || payload.email)) || '',
      role: (payload && payload.role) || 'user',
      roles: [],
    };
  }
  next();
};
