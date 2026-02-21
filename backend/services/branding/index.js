// backend/services/branding/index.js
const express = require('express');
const router = express.Router();

router.get('/api/branding', async (req, res) => {
  const db = req.app.locals.db;
  const { rows } = await db.query('SELECT * FROM branding_settings ORDER BY created_at DESC LIMIT 1');
  if (!rows[0]) return res.json({ logo: null, header_color: '#0b5fff' });
  res.json({ logo: rows[0].logo_key, header_color: rows[0].header_color });
});

router.put('/api/branding', async (req, res) => {
  const { header_color } = req.body;
  const db = req.app.locals.db;
  await db.query(`
    INSERT INTO branding_settings (id, header_color)
    VALUES ((select id from branding_settings limit 1), $1)
    ON CONFLICT (id) DO UPDATE SET header_color = EXCLUDED.header_color, updated_at = now()
  `, [header_color]);
  res.json({ ok: true });
});

module.exports = router;
