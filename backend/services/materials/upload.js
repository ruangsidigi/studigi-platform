// backend/services/materials/upload.js
const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const config = require('../../shared/config');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const s3 = new S3Client({
  endpoint: config.storageEndpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.storageKey || '',
    secretAccessKey: config.storageSecret || ''
  },
  forcePathStyle: true
});

async function uploadToStorage({ buffer, mimeType, folder = 'materials' }) {
  const key = `${folder}/${Date.now()}-${uuidv4()}`;
  const command = new PutObjectCommand({
    Bucket: config.storageBucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType
  });
  await s3.send(command);
  return `${config.cdnUrl.replace(/\/$/, '')}/${config.storageBucket}/${key}`;
}

// Admin-only: upload PDF material (mounted under /api)
router.post('/materials', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const allowed = ['application/pdf'];
    if (!allowed.includes(req.file.mimetype)) return res.status(400).json({ error: 'Invalid file type' });
    const url = await uploadToStorage({ buffer: req.file.buffer, mimeType: req.file.mimetype, folder: 'materials' });
    const db = req.app.locals.db;
    const result = await db.query(
      `INSERT INTO materials (title, storage_key, storage_bucket, mime_type, size_bytes, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.body.title || req.file.originalname, url, config.storageBucket, req.file.mimetype, req.file.size]
    );
    await db.query(`INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, after) VALUES ($1,$2,$3,$4,$5)`,
      [req.user?.id || null, 'create_material', 'material', result.rows[0].id, { url }]);
    res.json({ id: result.rows[0].id, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Branding logo upload (png/jpg) (mounted under /api)
router.post('/branding/logo', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(req.file.mimetype)) return res.status(400).json({ error: 'Invalid image type' });
    if (req.file.size > 2 * 1024 * 1024) return res.status(400).json({ error: 'Image too large' });
    const url = await uploadToStorage({ buffer: req.file.buffer, mimeType: req.file.mimetype, folder: 'branding' });
    const db = req.app.locals.db;
    await db.query(`
      INSERT INTO branding_settings (id, logo_key, header_color)
      VALUES ((select id from branding_settings limit 1), $1, $2)
      ON CONFLICT (id) DO UPDATE SET logo_key = EXCLUDED.logo_key, updated_at = now()
    `, [url, req.body.header_color || null]);
    await db.query(`INSERT INTO audit_logs (actor_id, action, resource_type, after) VALUES ($1,$2,$3)`,
      [req.user?.id || null, 'update_branding', 'branding', ]).catch(()=>{});
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
