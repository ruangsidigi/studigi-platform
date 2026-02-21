const express = require('express');
const multer = require('multer');
const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const {
  evaluateCampaignsForUser,
  logCampaignEvents,
  logBehaviorEvent,
} = require('../services/campaignEngine');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const getStorageClient = () => {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for campaign banner upload');
  }
  return supabaseAdmin;
};

const normalizeCampaignPayload = (body = {}) => ({
  name: String(body.name || '').trim(),
  title: String(body.title || '').trim(),
  description: body.description ? String(body.description) : null,
  cta_text: body.ctaText ? String(body.ctaText) : null,
  target_url: body.targetUrl ? String(body.targetUrl) : null,
  status: body.status ? String(body.status) : 'draft',
  rules: body.rules && typeof body.rules === 'object' ? body.rules : {},
  priority: Number(body.priority || 0),
  start_at: body.startAt || null,
  end_at: body.endAt || null,
});

router.post('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const payload = normalizeCampaignPayload(req.body || {});
    if (!payload.name || !payload.title) {
      return res.status(400).json({ error: 'name and title are required' });
    }

    const { data, error } = await supabase
      .from('campaigns')
      .insert([
        {
          ...payload,
          created_by: req.user.id,
          updated_by: req.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select('*')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Campaign created', campaign: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, campaign_assets(id, asset_url, asset_type, created_at)')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const payload = normalizeCampaignPayload(req.body || {});
    const { data, error } = await supabase
      .from('campaigns')
      .update({
        ...payload,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Campaign updated', campaign: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/assets', authenticateToken, authorizeRole(['admin']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Banner file is required' });
    }

    const storage = getStorageClient();
    const ext = req.file.originalname.split('.').pop() || 'png';
    const filePath = `campaigns/${req.params.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await storage.storage
      .from('materials')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: publicUrlData } = storage.storage.from('materials').getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl || null;

    const { data: asset, error } = await supabase
      .from('campaign_assets')
      .insert([
        {
          campaign_id: Number(req.params.id),
          asset_url: publicUrl,
          asset_path: filePath,
          asset_type: 'banner',
          mime_type: req.file.mimetype,
          file_size: req.file.size,
          created_at: new Date().toISOString(),
        },
      ])
      .select('*')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Campaign banner uploaded', asset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/evaluate', authenticateToken, async (req, res) => {
  try {
    const triggerSource = String(req.body?.triggerSource || 'dashboard');
    const result = await evaluateCampaignsForUser({ userId: req.user.id, triggerSource });

    res.json({
      triggerSource,
      segments: result.context.segments,
      campaigns: result.campaigns,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/personalized', authenticateToken, async (req, res) => {
  try {
    const triggerSource = String(req.query?.triggerSource || 'dashboard');
    const result = await evaluateCampaignsForUser({ userId: req.user.id, triggerSource });

    await logCampaignEvents({
      userId: req.user.id,
      campaignIds: result.campaigns.map((campaign) => campaign.id),
      eventType: 'impression',
      triggerSource,
      metadata: { source: 'personalized_api' },
    });

    res.json({
      triggerSource,
      campaigns: result.campaigns,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/click', authenticateToken, async (req, res) => {
  try {
    await logCampaignEvents({
      userId: req.user.id,
      campaignIds: [Number(req.params.id)],
      eventType: 'click',
      triggerSource: String(req.body?.triggerSource || 'dashboard'),
      metadata: {
        destination: req.body?.destination || null,
      },
    });

    await logBehaviorEvent({
      userId: req.user.id,
      eventType: 'campaign_click',
      source: String(req.body?.triggerSource || 'dashboard'),
      eventData: {
        campaignId: Number(req.params.id),
      },
    });

    res.json({ message: 'Campaign click logged' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/events', authenticateToken, async (req, res) => {
  try {
    const eventType = String(req.body?.eventType || '').trim();
    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    await logBehaviorEvent({
      userId: req.user.id,
      eventType,
      source: req.body?.source || null,
      eventData: req.body?.eventData || {},
    });

    res.json({ message: 'Behavior event tracked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
