const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    fieldSize: 10 * 1024 * 1024,
  },
});

const getUserRoleNames = (user) => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles
    .map((role) => String(role?.name || role?.role || '').toLowerCase())
    .filter(Boolean);
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  const roleNames = getUserRoleNames(req.user);
  const isAdmin =
    roleNames.includes('admin') ||
    String(req.user.role || '').toLowerCase() === 'admin' ||
    String(req.user.email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase();
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin only' });
  return next();
};

router.get('/questions/package/:packageId', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const packageId = Number(req.params.packageId);
    if (!Number.isInteger(packageId)) return res.status(400).json({ error: 'Invalid package id' });

    const result = await db.query(
      'SELECT * FROM questions WHERE package_id = $1 ORDER BY number ASC, id ASC',
      [packageId]
    );

    return res.json(result.rows || []);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/questions/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId)) return res.status(400).json({ error: 'Invalid question id' });

    const result = await db.query('SELECT * FROM questions WHERE id = $1 LIMIT 1', [questionId]);
    const question = result.rows[0];
    if (!question) return res.status(404).json({ error: 'Question not found' });
    return res.json(question);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/questions/upload', requireAdmin, upload.single('file'), async (req, res) => {
  const db = req.app.locals.db;
  const packageId = Number(req.body?.packageId);

  if (!Number.isInteger(packageId)) {
    return res.status(400).json({ error: 'Invalid package id' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    if (!rows.length) {
      return res.status(400).json({ error: 'No rows found in Excel' });
    }

    await db.query('BEGIN');

    let insertedCount = 0;
    for (const row of rows) {
      const number = Number(row.number);
      const questionText = row.question_text ? String(row.question_text).trim() : '';

      if (!Number.isInteger(number) || !questionText) {
        continue;
      }

      await db.query(
        `INSERT INTO questions (
          package_id, number, question_text,
          option_a, option_b, option_c, option_d, option_e,
          correct_answer, explanation, category,
          point_a, point_b, point_c, point_d, point_e,
          image_url, created_at, updated_at
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, NOW(), NOW()
        )`,
        [
          packageId,
          number,
          questionText,
          row.option_a ? String(row.option_a) : null,
          row.option_b ? String(row.option_b) : null,
          row.option_c ? String(row.option_c) : null,
          row.option_d ? String(row.option_d) : null,
          row.option_e ? String(row.option_e) : null,
          row.correct_answer ? String(row.correct_answer).toUpperCase() : null,
          row.explanation ? String(row.explanation) : null,
          row.category ? String(row.category).toUpperCase() : null,
          Number.isFinite(Number(row.point_a)) ? Number(row.point_a) : null,
          Number.isFinite(Number(row.point_b)) ? Number(row.point_b) : null,
          Number.isFinite(Number(row.point_c)) ? Number(row.point_c) : null,
          Number.isFinite(Number(row.point_d)) ? Number(row.point_d) : null,
          Number.isFinite(Number(row.point_e)) ? Number(row.point_e) : null,
          row.image_url ? String(row.image_url) : null,
        ]
      );

      insertedCount += 1;
    }

    if (insertedCount === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'No valid rows to import. Check number and question_text columns.' });
    }

    await db.query('COMMIT');

    await db.query(
      'UPDATE packages SET question_count = (SELECT COUNT(*) FROM questions WHERE package_id = $1), updated_at = NOW() WHERE id = $1',
      [packageId]
    ).catch(() => {});

    return res.json({
      message: `${insertedCount} questions imported successfully`,
      count: insertedCount,
    });
  } catch (error) {
    try { await db.query('ROLLBACK'); } catch (_) {}
    return res.status(500).json({ error: error.message });
  }
});

router.post('/questions/:id/image', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const questionId = Number(req.params.id);
    if (!Number.isInteger(questionId)) return res.status(400).json({ error: 'Invalid question id' });

    let finalImageUrl = req.body?.imageUrl || null;

    if (req.file) {
      const mimeType = req.file.mimetype || 'image/jpeg';
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
      if (!allowed.includes(mimeType)) {
        return res.status(400).json({ error: 'Invalid image type' });
      }
      finalImageUrl = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;
    }

    if (!finalImageUrl) {
      return res.status(400).json({ error: 'Image URL or file is required' });
    }

    const result = await db.query(
      'UPDATE questions SET image_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [finalImageUrl, questionId]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Question not found' });

    return res.json({
      message: 'Image updated successfully',
      image_url: finalImageUrl,
      question: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
