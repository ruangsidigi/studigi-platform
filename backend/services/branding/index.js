// backend/services/branding/index.js
const express = require('express');
const router = express.Router();

const upsertHeaderColor = async (db, headerColor) => {
  try {
    await db.query(
      `WITH updated AS (
         UPDATE branding_settings
         SET header_color = $1, updated_at = NOW()
         RETURNING id
       )
       INSERT INTO branding_settings (header_color, created_at, updated_at)
       SELECT $1, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM updated)`,
      [headerColor]
    );
    return;
  } catch (_) {}

  await db.query(
    `INSERT INTO branding_settings (header_color, created_at, updated_at)
     VALUES ($1, NOW(), NOW())
     ON CONFLICT ((1)) DO UPDATE
       SET header_color = EXCLUDED.header_color,
           updated_at = NOW()`,
    [headerColor]
  );
};

router.get('/branding', async (req, res) => {
  const db = req.app.locals.db;
  const { rows } = await db.query('SELECT * FROM branding_settings ORDER BY created_at DESC LIMIT 1');
  if (!rows[0]) {
    return res.json({
      logo: null,
      logoUrl: null,
      header_color: '#0b5fff',
      headerColor: '#0b5fff',
      buttonColor: '#007bff',
      lineColor: '#dddddd',
    });
  }
  const logoValue = rows[0].logo_key || rows[0].logo_url || null;
  res.json({
    logo: logoValue,
    logoUrl: logoValue,
    header_color: rows[0].header_color,
    headerColor: rows[0].header_color,
    buttonColor: rows[0].button_color || '#007bff',
    lineColor: rows[0].line_color || '#dddddd',
    updatedAt: rows[0].updated_at,
  });
});

router.put('/branding', async (req, res) => {
  const { header_color } = req.body;
  const db = req.app.locals.db;
  await upsertHeaderColor(db, header_color);
  res.json({ ok: true });
});

module.exports = router;
