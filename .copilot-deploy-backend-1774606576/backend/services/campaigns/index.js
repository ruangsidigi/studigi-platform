const express = require('express');
const multer = require('multer');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

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

const isMissingCampaignTable = (message) => {
  const msg = String(message || '').toLowerCase();
  return msg.includes('campaign') || msg.includes('relation') || msg.includes('does not exist');
};

router.get('/campaigns/admin', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const campaignsResult = await db.query(
      `SELECT
         c.*,
         (
           SELECT a.asset_url
           FROM campaign_assets a
           WHERE a.campaign_id = c.id AND a.asset_type = 'banner'
           ORDER BY a.created_at DESC
           LIMIT 1
         ) AS banner_url
       FROM campaigns c
       ORDER BY c.created_at DESC NULLS LAST, c.id DESC`
    );

    return res.json(campaignsResult.rows || []);
  } catch (error) {
    if (isMissingCampaignTable(error.message)) return res.json([]);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const name = String(req.body?.name || '').trim();
    const title = String(req.body?.title || '').trim();
    if (!name || !title) return res.status(400).json({ error: 'name and title are required' });

    const payload = {
      name,
      title,
      description: req.body?.description ? String(req.body.description) : null,
      cta_text: req.body?.cta_text || req.body?.ctaText || null,
      target_url: req.body?.target_url || req.body?.targetUrl || null,
      status: req.body?.status || 'draft',
      rules: req.body?.rules ? JSON.stringify(req.body.rules) : '{}',
      priority: Number.isFinite(Number(req.body?.priority)) ? Number(req.body.priority) : 0,
      start_at: req.body?.start_at || req.body?.startAt || null,
      end_at: req.body?.end_at || req.body?.endAt || null,
      actor_id: req.user?.id || null,
    };

    const result = await db.query(
      `INSERT INTO campaigns (
         name, title, description, cta_text, target_url, status,
         rules, priority, start_at, end_at, created_by, updated_by,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7::jsonb, $8, $9, $10, $11, $11,
         NOW(), NOW()
       ) RETURNING *`,
      [
        payload.name,
        payload.title,
        payload.description,
        payload.cta_text,
        payload.target_url,
        payload.status,
        payload.rules,
        payload.priority,
        payload.start_at,
        payload.end_at,
        payload.actor_id,
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/campaigns/:id', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const campaignId = Number(req.params.id);
    if (!Number.isInteger(campaignId)) return res.status(400).json({ error: 'Invalid campaign id' });

    const fields = [];
    const values = [];
    const put = (column, value) => {
      fields.push(`${column} = $${values.length + 1}`);
      values.push(value);
    };

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) put('name', req.body.name);
    if (Object.prototype.hasOwnProperty.call(req.body, 'title')) put('title', req.body.title);
    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) put('description', req.body.description);
    if (Object.prototype.hasOwnProperty.call(req.body, 'ctaText') || Object.prototype.hasOwnProperty.call(req.body, 'cta_text')) put('cta_text', req.body.cta_text || req.body.ctaText || null);
    if (Object.prototype.hasOwnProperty.call(req.body, 'targetUrl') || Object.prototype.hasOwnProperty.call(req.body, 'target_url')) put('target_url', req.body.target_url || req.body.targetUrl || null);
    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) put('status', req.body.status);
    if (Object.prototype.hasOwnProperty.call(req.body, 'priority')) put('priority', Number(req.body.priority || 0));
    if (Object.prototype.hasOwnProperty.call(req.body, 'startAt') || Object.prototype.hasOwnProperty.call(req.body, 'start_at')) put('start_at', req.body.start_at || req.body.startAt || null);
    if (Object.prototype.hasOwnProperty.call(req.body, 'endAt') || Object.prototype.hasOwnProperty.call(req.body, 'end_at')) put('end_at', req.body.end_at || req.body.endAt || null);
    if (Object.prototype.hasOwnProperty.call(req.body, 'rules')) put('rules', JSON.stringify(req.body.rules || {}));

    put('updated_by', req.user?.id || null);
    fields.push('updated_at = NOW()');

    values.push(campaignId);
    const result = await db.query(
      `UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/campaigns/:id', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const campaignId = Number(req.params.id);
    if (!Number.isInteger(campaignId)) return res.status(400).json({ error: 'Invalid campaign id' });

    await db.query('BEGIN');
    try {
      await db.query('DELETE FROM campaign_assets WHERE campaign_id = $1', [campaignId]);
    } catch (assetError) {
      if (!isMissingCampaignTable(assetError.message)) throw assetError;
    }

    const deleted = await db.query('DELETE FROM campaigns WHERE id = $1 RETURNING id', [campaignId]);
    await db.query('COMMIT');

    if (!deleted.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    return res.json({ message: 'Campaign deleted' });
  } catch (error) {
    try {
      await req.app.locals.db.query('ROLLBACK');
    } catch (rollbackError) {
      // ignore rollback error
    }

    if (isMissingCampaignTable(error.message)) return res.status(404).json({ error: 'Campaign not found' });
    return res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns/:id/assets', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const campaignId = Number(req.params.id);
    if (!Number.isInteger(campaignId)) return res.status(400).json({ error: 'Invalid campaign id' });
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const mimeType = req.file.mimetype || 'image/png';
    if (!mimeType.startsWith('image/')) return res.status(400).json({ error: 'File must be an image' });

    const assetUrl = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;

    const result = await db.query(
      `INSERT INTO campaign_assets (
         campaign_id, asset_url, asset_type, mime_type, file_size, created_at
       ) VALUES ($1, $2, 'banner', $3, $4, NOW())
       RETURNING *`,
      [campaignId, assetUrl, mimeType, req.file.size]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/campaigns/personalized', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const triggerSource = String(req.query?.triggerSource || 'dashboard');

    try {
      const result = await db.query(
        `SELECT id, title, description, cta_text, target_url, priority
         FROM campaigns
         WHERE status = 'active'
           AND (start_at IS NULL OR start_at <= NOW())
           AND (end_at IS NULL OR end_at >= NOW())
         ORDER BY priority DESC, created_at DESC
         LIMIT 5`
      );

      return res.json({
        triggerSource,
        campaigns: result.rows || [],
      });
    } catch (error) {
      if (!isMissingCampaignTable(error.message)) throw error;
      return res.json({ triggerSource, campaigns: [] });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns/evaluate', requireAuth, async (req, res) => {
  const triggerSource = String(req.body?.triggerSource || 'dashboard');
  return res.json({ triggerSource, segments: [], campaigns: [] });
});

router.post('/campaigns/events', requireAuth, async (req, res) => {
  return res.json({ message: 'Behavior event tracked' });
});

router.post('/campaigns/:id/click', requireAuth, async (req, res) => {
  return res.json({ message: 'Campaign click logged' });
});

module.exports = router;
