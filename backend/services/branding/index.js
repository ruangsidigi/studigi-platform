// backend/services/branding/index.js
const express = require('express');
const multer = require('multer');
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
});

const FAVICON_ALLOWED_MIME = new Set([
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/png',
]);

const normalizeLogoUrl = (rawUrl) => {
  if (!rawUrl || String(rawUrl).startsWith('data:')) return rawUrl || null;

  try {
    const parsed = new URL(String(rawUrl));
    if (!/supabase\.co$/i.test(parsed.hostname)) return rawUrl;

    if (/^\/storage\/v1\/object\/public\//i.test(parsed.pathname)) {
      return rawUrl;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const [bucket, ...rest] = parts;
      return `${parsed.origin}/storage/v1/object/public/${bucket}/${rest.join('/')}`;
    }
  } catch (_) {
    return rawUrl;
  }

  return rawUrl;
};

const upsertBrandingColors = async (db, colors) => {
  const headerColor = colors.header_color;
  const buttonColor = colors.button_color;
  const lineColor = colors.line_color;

  try {
    await db.query(
      `WITH updated AS (
         UPDATE branding_settings
         SET header_color = COALESCE($1, header_color),
             button_color = COALESCE($2, button_color),
             line_color = COALESCE($3, line_color),
             updated_at = NOW()
         RETURNING id
       )
       INSERT INTO branding_settings (header_color, button_color, line_color, created_at, updated_at)
       SELECT COALESCE($1, '#103c21'), COALESCE($2, '#007bff'), COALESCE($3, '#dddddd'), NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM updated)`,
      [headerColor, buttonColor, lineColor]
    );
    return;
  } catch (_) {}

  await db.query(
    `INSERT INTO branding_settings (header_color, button_color, line_color, created_at, updated_at)
     VALUES (COALESCE($1, '#103c21'), COALESCE($2, '#007bff'), COALESCE($3, '#dddddd'), NOW(), NOW())
     ON CONFLICT ((1)) DO UPDATE
       SET header_color = COALESCE(EXCLUDED.header_color, branding_settings.header_color),
           button_color = COALESCE(EXCLUDED.button_color, branding_settings.button_color),
           line_color = COALESCE(EXCLUDED.line_color, branding_settings.line_color),
           updated_at = NOW()`,
    [headerColor, buttonColor, lineColor]
  );
};

const upsertFaviconUrl = async (db, faviconUrl) => {
  await db.query('ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS favicon_url TEXT');

  await db.query(
    `WITH updated AS (
       UPDATE branding_settings
       SET favicon_url = $1,
           updated_at = NOW()
       RETURNING id
     )
     INSERT INTO branding_settings (favicon_url, header_color, button_color, line_color, created_at, updated_at)
     SELECT $1, '#103c21', '#007bff', '#dddddd', NOW(), NOW()
     WHERE NOT EXISTS (SELECT 1 FROM updated)`,
    [faviconUrl]
  );
};

const isAdminUser = (user) => {
  if (!user) return false;
  if (String(user.role || '').toLowerCase() === 'admin') return true;

  const roleNames = Array.isArray(user.roles)
    ? user.roles
        .map((role) => String(role?.name || role?.role || '').toLowerCase())
        .filter(Boolean)
    : [];
  if (roleNames.includes('admin')) return true;

  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase();
  return String(user.email || '').toLowerCase() === adminEmail;
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Access token required' });
  if (!isAdminUser(req.user)) return res.status(403).json({ error: 'Forbidden - admin only' });
  return next();
};

router.get('/branding', async (req, res) => {
  const db = req.app.locals.db;
  const { rows } = await db.query('SELECT * FROM branding_settings ORDER BY created_at DESC LIMIT 1');
  if (!rows[0]) {
    return res.json({
      logo: null,
      logoUrl: null,
      faviconUrl: null,
      header_color: '#103c21',
      headerColor: '#103c21',
      buttonColor: '#007bff',
      lineColor: '#dddddd',
    });
  }
  const logoValue = normalizeLogoUrl(rows[0].logo_key || rows[0].logo_url || null);
  res.json({
    logo: logoValue,
    logoUrl: logoValue,
    faviconUrl: rows[0].favicon_url || null,
    favicon_url: rows[0].favicon_url || null,
    header_color: rows[0].header_color,
    headerColor: rows[0].header_color,
    buttonColor: rows[0].button_color || '#007bff',
    lineColor: rows[0].line_color || '#dddddd',
    updatedAt: rows[0].updated_at,
  });
});

router.put('/branding', async (req, res) => {
  const headerColor = req.body?.header_color || req.body?.headerColor || null;
  const buttonColor = req.body?.button_color || req.body?.buttonColor || null;
  const lineColor = req.body?.line_color || req.body?.lineColor || null;

  const db = req.app.locals.db;
  await upsertBrandingColors(db, {
    header_color: headerColor,
    button_color: buttonColor,
    line_color: lineColor,
  });
  res.json({
    ok: true,
    settings: {
      headerColor: headerColor || '#103c21',
      buttonColor: buttonColor || '#007bff',
      lineColor: lineColor || '#dddddd',
    },
  });
});

router.post('/branding/favicon', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File favicon wajib diisi' });
    }

    const mimeType = String(req.file.mimetype || '').toLowerCase();
    if (!FAVICON_ALLOWED_MIME.has(mimeType)) {
      return res.status(400).json({ error: 'Format favicon harus ICO atau PNG' });
    }

    const dataUrl = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;
    const db = req.app.locals.db;
    await upsertFaviconUrl(db, dataUrl);

    return res.json({
      message: 'Favicon uploaded',
      faviconUrl: dataUrl,
      persisted: true,
      source: 'database',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Gagal upload favicon' });
  }
});

module.exports = router;
