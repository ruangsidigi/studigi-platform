const express = require('express');
const multer = require('multer');

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
