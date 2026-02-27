const express = require('express');

const router = express.Router();

const getUserRoleNames = (user) => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles
    .map((role) => String(role?.name || role?.role || '').toLowerCase())
    .filter(Boolean);
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Access token required' });
  const roleNames = getUserRoleNames(req.user);
  const isAdmin =
    roleNames.includes('admin') ||
    String(req.user.role || '').toLowerCase() === 'admin' ||
    String(req.user.email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase();

  if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin only' });
  return next();
};

const isMissingRelation = (message) => {
  const msg = String(message || '').toLowerCase();
  return msg.includes('does not exist') || msg.includes('relation') || msg.includes('column');
};

const safeExec = async (db, sql, values = []) => {
  try {
    await db.query(sql, values);
  } catch (error) {
    if (!isMissingRelation(error.message)) throw error;
  }
};

router.get('/packages', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM packages ORDER BY created_at DESC NULLS LAST, id DESC');
    return res.json(result.rows || []);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/packages/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const result = await db.query('SELECT * FROM packages WHERE id = $1 LIMIT 1', [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Package not found' });
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/packages', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const {
      name,
      description = '',
      type = 'tryout',
      price = 0,
      question_count = 0,
      category_id = null,
      included_package_ids = [],
    } = req.body || {};

    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await db.query(
      `INSERT INTO packages (name, description, type, price, question_count, category_id, included_package_ids, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        name,
        description,
        type,
        Number(price || 0),
        Number(question_count || 0),
        category_id || null,
        Array.isArray(included_package_ids) ? included_package_ids : [],
      ]
    );

    return res.json({ message: 'Package created successfully', package: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/packages/:id', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const {
      name,
      description,
      type,
      price,
      question_count,
      category_id,
      included_package_ids,
    } = req.body || {};

    const result = await db.query(
      `UPDATE packages
       SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         type = COALESCE($3, type),
         price = COALESCE($4, price),
         question_count = COALESCE($5, question_count),
         category_id = COALESCE($6, category_id),
         included_package_ids = COALESCE($7, included_package_ids),
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        name ?? null,
        description ?? null,
        type ?? null,
        price !== undefined ? Number(price) : null,
        question_count !== undefined ? Number(question_count) : null,
        category_id ?? null,
        included_package_ids ?? null,
        id,
      ]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Package not found' });
    return res.json({ message: 'Package updated successfully', package: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/packages/:id', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const result = await db.query('DELETE FROM packages WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Package not found' });
    return res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/packages', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    await db.query('BEGIN');

    await safeExec(
      db,
      `DELETE FROM tryout_answers
       WHERE session_id IN (
         SELECT id FROM tryout_sessions WHERE package_id IN (SELECT id FROM packages)
       )`
    );
    await safeExec(db, 'DELETE FROM purchases WHERE package_id IN (SELECT id FROM packages)');
    await safeExec(db, 'DELETE FROM tryout_sessions WHERE package_id IN (SELECT id FROM packages)');
    await safeExec(db, 'DELETE FROM package_materials WHERE package_id IN (SELECT id FROM packages)');
    await safeExec(db, 'DELETE FROM bundle_packages WHERE package_id IN (SELECT id FROM packages)');
    await safeExec(db, 'UPDATE materials SET package_id = NULL WHERE package_id IN (SELECT id FROM packages)');

    const deleted = await db.query('DELETE FROM packages');

    await db.query('COMMIT');
    return res.json({ message: 'All packages deleted successfully', deletedCount: deleted.rowCount || 0 });
  } catch (error) {
    try {
      await req.app.locals.db.query('ROLLBACK');
    } catch (rollbackError) {
      // ignore rollback errors
    }
    return res.status(500).json({ error: error.message });
  }
});

router.get('/packages/:id/leaderboard', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { id } = req.params;
    const result = await db.query(
      `SELECT
         ts.user_id,
         COALESCE(u.display_name, u.name, u.email) AS user_name,
         MAX(ts.total_score) AS best_score,
         MIN(CASE WHEN ts.started_at IS NOT NULL AND ts.finished_at IS NOT NULL
           THEN EXTRACT(EPOCH FROM (ts.finished_at - ts.started_at))
           ELSE NULL END) AS best_duration_seconds
       FROM tryout_sessions ts
       LEFT JOIN users u ON u.id = ts.user_id
       WHERE ts.package_id = $1
         AND ts.status = 'completed'
       GROUP BY ts.user_id, COALESCE(u.display_name, u.name, u.email)
       ORDER BY best_score DESC NULLS LAST, best_duration_seconds ASC NULLS LAST`,
      [id]
    );

    const ranking = (result.rows || []).map((row, index) => ({
      rank: index + 1,
      user_id: row.user_id,
      user_name: row.user_name || '-',
      best_score: Number(row.best_score || 0),
      best_duration_seconds: row.best_duration_seconds !== null ? Number(row.best_duration_seconds) : null,
    }));

    return res.json({ package_id: Number(id), ranking });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
