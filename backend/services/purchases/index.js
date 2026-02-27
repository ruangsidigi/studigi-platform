const express = require('express');

const router = express.Router();

const getRoleNames = (user) => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles.map((role) => String(role?.name || role?.role || '').toLowerCase()).filter(Boolean);
};

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  const roles = getRoleNames(req.user);
  const isAdmin =
    roles.includes('admin') ||
    String(req.user.role || '').toLowerCase() === 'admin' ||
    String(req.user.email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase();
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin only' });
  return next();
};

router.get('/purchases', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(
      `SELECT p.*, pkg.id AS package_ref_id, pkg.name AS package_name, pkg.type AS package_type
       FROM purchases p
       LEFT JOIN packages pkg ON pkg.id = p.package_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC NULLS LAST, p.id DESC`,
      [req.user.id]
    );

    const rows = (result.rows || []).map((row) => ({
      ...row,
      packages: row.package_ref_id
        ? {
            id: row.package_ref_id,
            name: row.package_name,
            type: row.package_type,
          }
        : null,
    }));

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/purchases', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { packageIds, totalPrice, paymentMethod = 'transfer' } = req.body || {};

    if (!Array.isArray(packageIds) || packageIds.length === 0) {
      return res.status(400).json({ error: 'Package IDs array is required' });
    }

    const normalizedPackageIds = [...new Set(packageIds.map((item) => Number(item)).filter((id) => Number.isInteger(id) && id > 0))];
    if (normalizedPackageIds.length === 0) {
      return res.status(400).json({ error: 'No valid package IDs' });
    }

    const pricePerPackage = Number(totalPrice || 0) / normalizedPackageIds.length;
    const inserted = [];

    for (const packageId of normalizedPackageIds) {
      const result = await db.query(
        `INSERT INTO purchases (user_id, package_id, payment_method, payment_status, total_price, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [req.user.id, packageId, paymentMethod, 'completed', Number.isFinite(pricePerPackage) ? pricePerPackage : 0]
      );
      if (result.rows[0]) inserted.push(result.rows[0]);
    }

    return res.json({
      message: 'Purchase successful',
      purchases: inserted,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/purchases/admin/all', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(
      `SELECT
         p.*,
         u.id AS user_ref_id,
         COALESCE(u.display_name, u.name, u.email) AS user_name,
         u.email AS user_email,
         pkg.id AS package_ref_id,
         pkg.name AS package_name,
         pkg.type AS package_type
       FROM purchases p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN packages pkg ON pkg.id = p.package_id
       ORDER BY p.created_at DESC NULLS LAST, p.id DESC`
    );

    const rows = (result.rows || []).map((row) => ({
      ...row,
      users: row.user_ref_id
        ? { id: row.user_ref_id, name: row.user_name, email: row.user_email }
        : null,
      packages: row.package_ref_id
        ? { id: row.package_ref_id, name: row.package_name, type: row.package_type }
        : null,
    }));

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
