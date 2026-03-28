const express = require('express');

const router = express.Router();

const getUserRoleNames = (user) => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles
    .map((role) => String(role?.name || role?.role || '').toLowerCase())
    .filter(Boolean);
};

const isAdminUser = (user) => {
  if (!user) return false;
  const roleNames = getUserRoleNames(user);
  if (roleNames.includes('admin')) return true;
  if (String(user.role || '').toLowerCase() === 'admin') return true;

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase();
  return String(user.email || '').toLowerCase() === adminEmail;
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Access token required' });
  if (!isAdminUser(req.user)) return res.status(403).json({ error: 'Forbidden - admin only' });
  return next();
};

router.get('/admin/stats', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;

    const [usersCount, packagesCount, purchasesCount, revenueResult, recentPurchasesResult] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM users'),
      db.query('SELECT COUNT(*)::int AS count FROM packages'),
      db.query('SELECT COUNT(*)::int AS count FROM purchases'),
      db.query('SELECT COALESCE(SUM(total_price), 0)::bigint AS total_revenue FROM purchases'),
      db.query(
        `SELECT
           p.id,
           p.total_price,
           p.created_at,
           p.user_id,
           p.package_id,
           COALESCE(u.display_name, u.name, u.email) AS user_name,
           u.email AS user_email,
           pkg.name AS package_name
         FROM purchases p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN packages pkg ON pkg.id = p.package_id
         ORDER BY p.created_at DESC
         LIMIT 5`
      ),
    ]);

    const recentPurchases = (recentPurchasesResult.rows || []).map((row) => ({
      id: row.id,
      total_price: Number(row.total_price || 0),
      created_at: row.created_at,
      user_id: row.user_id,
      package_id: row.package_id,
      users: {
        name: row.user_name || '-',
        email: row.user_email || '-',
      },
      packages: {
        name: row.package_name || '-',
      },
    }));

    return res.json({
      stats: {
        totalUsers: usersCount.rows[0]?.count || 0,
        totalPackages: packagesCount.rows[0]?.count || 0,
        totalPurchases: purchasesCount.rows[0]?.count || 0,
        totalRevenue: Number(revenueResult.rows[0]?.total_revenue || 0),
      },
      recentPurchases,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(
      `SELECT
         u.id,
         COALESCE(u.display_name, u.name, u.email) AS name,
         u.email,
         COALESCE(
           MAX(CASE WHEN r.name = 'admin' THEN 'admin' END),
           MIN(r.name),
           u.role,
           'user'
         ) AS role,
         u.created_at
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id, u.display_name, u.name, u.email, u.role, u.created_at
       ORDER BY u.created_at DESC NULLS LAST`
    );

    return res.json(result.rows || []);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/admin/tryout-results', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(
      `SELECT
         ts.id,
         ts.user_id,
         ts.package_id,
         ts.twk_score,
         ts.tiu_score,
         ts.tkp_score,
         ts.total_score,
         ts.is_passed,
         ts.finished_at,
         ts.status,
         COALESCE(u.display_name, u.name, u.email) AS user_name,
         u.email AS user_email,
         pkg.name AS package_name,
         pkg.type AS package_type
       FROM tryout_sessions ts
       LEFT JOIN users u ON u.id = ts.user_id
       LEFT JOIN packages pkg ON pkg.id = ts.package_id
       WHERE ts.status = 'completed'
       ORDER BY ts.finished_at DESC NULLS LAST`
    );

    const normalized = (result.rows || []).map((row) => ({
      ...row,
      users: {
        name: row.user_name || '-',
        email: row.user_email || '-',
      },
      packages: {
        name: row.package_name || '-',
        type: row.package_type || '-',
      },
    }));

    return res.json(normalized);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/admin/rankings/package/:packageId', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { packageId } = req.params;
    const result = await db.query(
      `SELECT
         ts.id,
         ts.user_id,
         ts.package_id,
         ts.started_at,
         ts.finished_at,
         ts.twk_score,
         ts.tiu_score,
         ts.tkp_score,
         ts.total_score,
         ts.is_passed,
         COALESCE(u.display_name, u.name, u.email) AS user_name,
         u.email AS user_email,
         pkg.name AS package_name
       FROM tryout_sessions ts
       LEFT JOIN users u ON u.id = ts.user_id
       LEFT JOIN packages pkg ON pkg.id = ts.package_id
       WHERE ts.package_id = $1
         AND ts.status = 'completed'`,
      [packageId]
    );

    const bestByUser = new Map();

    for (const session of result.rows || []) {
      const userId = String(session.user_id);
      const current = bestByUser.get(userId);

      const totalScore = Number(session.total_score || 0);
      const currentScore = Number(current?.total_score || 0);

      const sessionDuration = session.started_at && session.finished_at
        ? Math.max(0, new Date(session.finished_at).getTime() - new Date(session.started_at).getTime())
        : Number.MAX_SAFE_INTEGER;
      const currentDuration = current?.started_at && current?.finished_at
        ? Math.max(0, new Date(current.finished_at).getTime() - new Date(current.started_at).getTime())
        : Number.MAX_SAFE_INTEGER;

      if (!current || totalScore > currentScore || (totalScore === currentScore && sessionDuration < currentDuration)) {
        bestByUser.set(userId, session);
      }
    }

    const ranking = Array.from(bestByUser.values())
      .sort((a, b) => {
        const scoreDiff = Number(b.total_score || 0) - Number(a.total_score || 0);
        if (scoreDiff !== 0) return scoreDiff;

        const durationA = a.started_at && a.finished_at
          ? Math.max(0, new Date(a.finished_at).getTime() - new Date(a.started_at).getTime())
          : Number.MAX_SAFE_INTEGER;
        const durationB = b.started_at && b.finished_at
          ? Math.max(0, new Date(b.finished_at).getTime() - new Date(b.started_at).getTime())
          : Number.MAX_SAFE_INTEGER;

        return durationA - durationB;
      })
      .map((session, index) => {
        const durationMs = session.started_at && session.finished_at
          ? Math.max(0, new Date(session.finished_at).getTime() - new Date(session.started_at).getTime())
          : null;

        return {
          rank: index + 1,
          session_id: session.id,
          user_id: session.user_id,
          user_name: session.user_name || '-',
          user_email: session.user_email || '-',
          package_id: session.package_id,
          package_name: session.package_name || '-',
          twk_score: Number(session.twk_score || 0),
          tiu_score: Number(session.tiu_score || 0),
          tkp_score: Number(session.tkp_score || 0),
          total_score: Number(session.total_score || 0),
          is_passed: session.is_passed,
          finished_at: session.finished_at,
          duration_ms: durationMs,
        };
      });

    return res.json({
      packageId: Number(packageId),
      participant_count: ranking.length,
      ranking,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
