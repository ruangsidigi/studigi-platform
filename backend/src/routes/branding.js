const express = require('express');
const multer = require('multer');
const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const DEFAULT_SETTINGS = {
  logo_url: null,
  logo_path: null,
  header_color: '#1d7a7a',
  button_color: '#007bff',
  line_color: '#dddddd',
};

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;
const ALLOWED_MIME = ['image/png', 'image/jpg', 'image/jpeg'];

const mapBrandingErrorMessage = (error) => {
  const msg = String(error?.message || 'Unknown error');
  if (msg.toLowerCase().includes('row-level security')) {
    return 'Branding table is blocked by RLS. Apply migration 017_branding_settings_rls_fix.sql, then retry.';
  }
  if (msg.includes("button_color") || msg.includes("line_color")) {
    return 'Branding theme columns are missing. Apply migration 018_branding_theme_colors.sql, then retry.';
  }
  return msg;
};

const getWriteClient = () => {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for branding logo upload. Please set it in backend/.env and restart backend.');
  }
  return supabaseAdmin;
};

const getReadClient = () => {
  return supabaseAdmin || supabase;
};

const getCurrentSettings = async () => {
  const { data, error } = await supabase
    .from('branding_settings')
    .select('*')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    const { data: inserted, error: insertError } = await supabase
      .from('branding_settings')
      .insert([DEFAULT_SETTINGS])
      .select('*')
      .single();

    if (insertError) throw new Error(insertError.message);
    return inserted;
  }

  return data;
};

const saveSettings = async (payload) => {
  const writeClient = supabaseAdmin || supabase;
  const current = await getCurrentSettings();

  const { data, error } = await writeClient
    .from('branding_settings')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
};

router.get('/', async (req, res) => {
  try {
    const current = await getCurrentSettings();
    const hasLogoPath = !!current.logo_path;
    res.json({
      logoUrl: hasLogoPath ? '/api/branding/logo' : (current.logo_url || null),
      headerColor: current.header_color || DEFAULT_SETTINGS.header_color,
      buttonColor: current.button_color || DEFAULT_SETTINGS.button_color,
      lineColor: current.line_color || DEFAULT_SETTINGS.line_color,
      updatedAt: current.updated_at || null,
    });
  } catch (error) {
    res.status(500).json({ error: mapBrandingErrorMessage(error) });
  }
});

router.get('/logo', async (req, res) => {
  try {
    const current = await getCurrentSettings();

    if (!current.logo_path) {
      if (current.logo_url) {
        return res.redirect(current.logo_url);
      }
      return res.status(404).json({ error: 'Logo not found' });
    }

    const readClient = getReadClient();
    const { data, error } = await readClient.storage
      .from('materials')
      .createSignedUrl(current.logo_path, 60 * 60);

    if (error || !data?.signedUrl) {
      if (current.logo_url) {
        return res.redirect(current.logo_url);
      }
      return res.status(404).json({ error: error?.message || 'Logo not found' });
    }

    return res.redirect(data.signedUrl);
  } catch (error) {
    res.status(500).json({ error: mapBrandingErrorMessage(error) });
  }
});

router.put('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const headerColor = String(req.body?.headerColor || '').trim();
    const buttonColor = String(req.body?.buttonColor || '').trim();
    const lineColor = String(req.body?.lineColor || '').trim();

    if (!HEX_COLOR_REGEX.test(headerColor)) {
      return res.status(400).json({ error: 'headerColor must be a valid hex color (e.g. #1d7a7a)' });
    }
    if (!HEX_COLOR_REGEX.test(buttonColor)) {
      return res.status(400).json({ error: 'buttonColor must be a valid hex color (e.g. #007bff)' });
    }
    if (!HEX_COLOR_REGEX.test(lineColor)) {
      return res.status(400).json({ error: 'lineColor must be a valid hex color (e.g. #dddddd)' });
    }

    const updated = await saveSettings({
      header_color: headerColor,
      button_color: buttonColor,
      line_color: lineColor,
      updated_by: req.user.id,
    });

    res.json({
      message: 'Branding settings updated',
      settings: {
        logoUrl: updated.logo_url || null,
        headerColor: updated.header_color,
        buttonColor: updated.button_color || DEFAULT_SETTINGS.button_color,
        lineColor: updated.line_color || DEFAULT_SETTINGS.line_color,
      },
    });
  } catch (error) {
    res.status(500).json({ error: mapBrandingErrorMessage(error) });
  }
});

router.post('/logo', authenticateToken, authorizeRole(['admin']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Logo file is required' });
    }

    if (!ALLOWED_MIME.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Only PNG/JPG/JPEG files are allowed' });
    }

    const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
    const filePath = `branding/logo.${ext}`;
    const writeClient = getWriteClient();

    const { error: uploadError } = await writeClient.storage
      .from('materials')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: publicUrlData } = writeClient.storage
      .from('materials')
      .getPublicUrl(filePath);

    const logoUrl = publicUrlData?.publicUrl || null;
    const updated = await saveSettings({
      logo_url: logoUrl,
      logo_path: filePath,
      updated_by: req.user.id,
    });

    res.json({
      message: 'Logo uploaded',
      settings: {
        logoUrl: updated.logo_url || null,
        headerColor: updated.header_color || DEFAULT_SETTINGS.header_color,
        buttonColor: updated.button_color || DEFAULT_SETTINGS.button_color,
        lineColor: updated.line_color || DEFAULT_SETTINGS.line_color,
      },
    });
  } catch (error) {
    res.status(500).json({ error: mapBrandingErrorMessage(error) });
  }
});

module.exports = router;
