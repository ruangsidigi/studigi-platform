const express = require('express');

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const isMissingCampaignTable = (message) => {
  const msg = String(message || '').toLowerCase();
  return msg.includes('campaign') || msg.includes('relation') || msg.includes('does not exist');
};

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
