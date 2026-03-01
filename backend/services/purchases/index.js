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
  return res.status(400).json({
    error: 'Direct purchase is disabled. Use POST /api/payments/checkout to start a payment transaction.',
  });
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
         pkg.type AS package_type,
         pt.id AS payment_tx_id,
         pt.provider_reference AS payment_tx_reference,
         pt.status AS payment_tx_status,
         pt.metadata AS payment_tx_metadata
       FROM purchases p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN packages pkg ON pkg.id = p.package_id
       LEFT JOIN payment_transactions pt ON pt.id = p.payment_transaction_id
       ORDER BY p.created_at DESC NULLS LAST, p.id DESC`
    );

    const rows = (result.rows || []).map((row) => {
      const termsAcceptance = row.payment_tx_metadata?.terms_acceptance || null;

      return {
        ...row,
        users: row.user_ref_id
          ? { id: row.user_ref_id, name: row.user_name, email: row.user_email }
          : null,
        packages: row.package_ref_id
          ? { id: row.package_ref_id, name: row.package_name, type: row.package_type }
          : null,
        payment_transaction: row.payment_tx_id
          ? {
              id: row.payment_tx_id,
              reference: row.payment_tx_reference,
              status: row.payment_tx_status,
              terms_acceptance: termsAcceptance
                ? {
                    accepted: termsAcceptance.accepted === true,
                    accepted_at: termsAcceptance.accepted_at || null,
                    terms_version: termsAcceptance.terms_version || null,
                    terms_file: termsAcceptance.terms_file || null,
                  }
                : null,
            }
          : null,
      };
    });

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
