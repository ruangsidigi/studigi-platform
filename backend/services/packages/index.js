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

let packageSchemaReady = false;
const ensurePackageSchema = async (db) => {
  if (packageSchemaReady) return;
  await safeExec(
    db,
    `ALTER TABLE packages
       ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 100`
  );
  packageSchemaReady = true;
};

const normalizeIncludedPackageIds = (rawValue) => {
  if (Array.isArray(rawValue)) {
    return JSON.stringify(
      rawValue
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    );
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) return JSON.stringify([]);

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return JSON.stringify(
          parsed
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item > 0)
        );
      }
    } catch (_) {
      const splitValues = trimmed
        .split(',')
        .map((item) => Number(String(item).trim()))
        .filter((item) => Number.isInteger(item) && item > 0);
      return JSON.stringify(splitValues);
    }
  }

  return JSON.stringify([]);
};

const normalizeCurrencyNumber = (rawValue) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }

  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) ? rawValue : null;
  }

  const digitsOnly = String(rawValue).replace(/[^\d]/g, '');
  if (!digitsOnly) return null;

  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeOriginalPrice = (originalPrice, price) => {
  if (originalPrice === undefined || originalPrice === null || originalPrice === '') {
    return null;
  }

  const normalizedOriginalPrice = normalizeCurrencyNumber(originalPrice);
  const normalizedPrice = normalizeCurrencyNumber(price) || 0;

  if (!Number.isFinite(normalizedOriginalPrice) || normalizedOriginalPrice <= normalizedPrice) {
    return null;
  }

  return normalizedOriginalPrice;
};

router.get('/packages', async (req, res) => {
  try {
    const db = req.app.locals.db;
    await ensurePackageSchema(db);
    const result = await db.query('SELECT * FROM packages ORDER BY created_at DESC NULLS LAST, id DESC');
    return res.json(result.rows || []);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/packages/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    await ensurePackageSchema(db);
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
    await ensurePackageSchema(db);
    const {
      name,
      description = '',
      type = 'tryout',
      price = 0,
      original_price = null,
      duration = 100,
      question_count = 0,
      category_id = null,
      included_package_ids = [],
      content_type = 'question',
      visibility = 'visible',
      pdf_file_path = null,
    } = req.body || {};

    if (!name) return res.status(400).json({ error: 'name is required' });

    const normalizedPrice = normalizeCurrencyNumber(price) || 0;
    const normalizedOriginalPrice = normalizeOriginalPrice(original_price, normalizedPrice);

    const result = await db.query(
      `INSERT INTO packages (name, description, type, price, original_price, duration, question_count, category_id, included_package_ids, content_type, visibility, pdf_file_path, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       RETURNING *`,
      [
        name,
        description,
        type,
        normalizedPrice,
        normalizedOriginalPrice,
        Math.max(1, Number(duration || 100)),
        Number(question_count || 0),
        category_id || null,
        normalizeIncludedPackageIds(included_package_ids),
        content_type || 'question',
        visibility || 'visible',
        pdf_file_path || null,
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
    await ensurePackageSchema(db);
    const { id } = req.params;
    const {
      name,
      description,
      type,
      price,
      original_price,
      duration,
      question_count,
      category_id,
      included_package_ids,
      content_type,
      visibility,
      pdf_file_path,
    } = req.body || {};

    const shouldUpdatePdfFilePath = Object.prototype.hasOwnProperty.call(req.body || {}, 'pdf_file_path');

    const normalizedPrice = price !== undefined ? normalizeCurrencyNumber(price) : null;
    const shouldUpdateOriginalPrice = original_price !== undefined;
    const normalizedOriginalPrice =
      shouldUpdateOriginalPrice
        ? normalizeOriginalPrice(original_price, price !== undefined ? normalizedPrice : 0)
        : undefined;

    const result = await db.query(
      `UPDATE packages
       SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         type = COALESCE($3, type),
         price = COALESCE($4, price),
         original_price = CASE WHEN $5::boolean THEN $6::numeric ELSE original_price END,
         duration = COALESCE($7, duration),
         question_count = COALESCE($8, question_count),
         category_id = COALESCE($9, category_id),
         included_package_ids = COALESCE($10, included_package_ids),
         content_type = COALESCE($11, content_type),
         visibility = COALESCE($12, visibility),
         pdf_file_path = CASE WHEN $13::boolean THEN $14 ELSE pdf_file_path END,
         updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [
        name ?? null,
        description ?? null,
        type ?? null,
        normalizedPrice,
        shouldUpdateOriginalPrice,
        normalizedOriginalPrice !== undefined ? normalizedOriginalPrice : null,
        duration !== undefined ? Math.max(1, Number(duration || 100)) : null,
        question_count !== undefined ? Number(question_count) : null,
        category_id ?? null,
        included_package_ids !== undefined ? normalizeIncludedPackageIds(included_package_ids) : null,
        content_type ?? null,
        visibility ?? null,
        shouldUpdatePdfFilePath,
        shouldUpdatePdfFilePath ? (pdf_file_path ?? null) : null,
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
    await db.query('BEGIN');

    await safeExec(
      db,
      `DELETE FROM tryout_answers
       WHERE session_id IN (
         SELECT id FROM tryout_sessions WHERE package_id = $1
       )`,
      [id]
    );
    await safeExec(db, 'DELETE FROM purchases WHERE package_id = $1', [id]);
    await safeExec(db, 'DELETE FROM tryout_sessions WHERE package_id = $1', [id]);
    await safeExec(db, 'DELETE FROM package_materials WHERE package_id = $1', [id]);
    await safeExec(db, 'DELETE FROM bundle_packages WHERE package_id = $1 OR bundle_id = $1', [id]);
    await safeExec(db, 'UPDATE materials SET package_id = NULL WHERE package_id = $1', [id]);

    const result = await db.query('DELETE FROM packages WHERE id = $1 RETURNING id', [id]);
    await db.query('COMMIT');

    if (!result.rows[0]) return res.status(404).json({ error: 'Package not found' });
    return res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    try {
      await req.app.locals.db.query('ROLLBACK');
    } catch (rollbackError) {
      // ignore rollback errors
    }
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
    const scope = String(req.query?.scope || 'national').toLowerCase() === 'province' ? 'province' : 'national';
    const province = String(req.query?.province || '').trim();

    if (scope === 'province' && !province) {
      return res.status(400).json({ error: 'province is required for province leaderboard' });
    }

    const result = await db.query(
      `WITH best_sessions AS (
         SELECT DISTINCT ON (ts.user_id)
           ts.user_id,
           ts.id,
           ts.total_score,
           ts.participant_name,
           ts.participant_province,
           CASE WHEN ts.started_at IS NOT NULL AND ts.finished_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (ts.finished_at - ts.started_at))
             ELSE NULL END AS duration_seconds,
           COALESCE(NULLIF(ts.participant_name, ''), u.display_name, u.name, u.email) AS fallback_name
         FROM tryout_sessions ts
         LEFT JOIN users u ON u.id = ts.user_id
         WHERE ts.package_id = $1
           AND ts.status = 'completed'
           AND ts.total_score IS NOT NULL
         ORDER BY ts.user_id, ts.total_score DESC NULLS LAST, ts.finished_at DESC NULLS LAST, ts.id DESC
       )
       SELECT
         bs.user_id,
         bs.fallback_name AS user_name,
         bs.participant_province AS user_province,
         bs.total_score AS best_score,
         bs.duration_seconds AS best_duration_seconds
       FROM best_sessions bs
       WHERE ($2 = 'national') OR (bs.participant_province = $3)
       ORDER BY bs.total_score DESC NULLS LAST, bs.duration_seconds ASC NULLS LAST, bs.id ASC`,
      [id, scope, province]
    );

    const ranking = (result.rows || []).map((row, index) => ({
      rank: index + 1,
      user_id: row.user_id,
      user_name: row.user_name || '-',
      user_province: row.user_province || null,
      best_score: Number(row.best_score || 0),
      best_duration_seconds: row.best_duration_seconds !== null ? Number(row.best_duration_seconds) : null,
    }));

    return res.json({ package_id: Number(id), scope, province: scope === 'province' ? province : null, ranking });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
