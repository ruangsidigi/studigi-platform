// backend/shared/middleware/rbac.js
// Simple role-based access control middleware. Expects `req.user.roles` as array of {name}.
module.exports = (requiredRole) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const roles = (req.user.roles || []).map(r => r.name);
  if (!roles.includes(requiredRole)) return res.status(403).json({ error: 'Forbidden' });
  next();
};
