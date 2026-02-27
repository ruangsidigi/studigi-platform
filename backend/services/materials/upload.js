// backend/services/materials/upload.js
const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const config = require('../../shared/config');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const getUserRoleNames = (user) => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles
    .map((role) => String(role?.name || role?.role || '').toLowerCase())
    .filter(Boolean);
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Access token required' });
  const roleNames = getUserRoleNames(req.user);
  const isAdmin =
    roleNames.includes('admin') ||
    String(req.user.role || '').toLowerCase() === 'admin' ||
    String(req.user.email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase();
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin only' });
  return next();
};

const parsePackageIds = (body) => {
  const values = [];
  if (body?.packageId) values.push(body.packageId);
  if (Array.isArray(body?.packageIds)) values.push(...body.packageIds);
  if (typeof body?.packageIds === 'string' && body.packageIds.trim()) {
    try {
      const parsed = JSON.parse(body.packageIds);
      if (Array.isArray(parsed)) values.push(...parsed);
      else values.push(body.packageIds);
    } catch (_) {
      values.push(...body.packageIds.split(','));
    }
  }
  return [...new Set(values
    .map((item) => Number(item))
    .filter((value) => Number.isInteger(value) && value > 0))];
};

const loadPackageMap = async (db) => {
  try {
    const links = await db.query(
      `SELECT
         pm.material_id,
         pm.package_id,
         p.name AS package_name,
         p.type AS package_type
       FROM package_materials pm
       LEFT JOIN packages p ON p.id = pm.package_id`
    );

    const map = new Map();
    for (const row of links.rows || []) {
      if (!map.has(row.material_id)) map.set(row.material_id, []);
      map.get(row.material_id).push({
        package_id: row.package_id,
        package: {
          id: row.package_id,
          name: row.package_name || null,
          type: row.package_type || null,
        },
      });
    }
    return map;
  } catch (_) {
    const fallback = await db.query('SELECT id, package_id FROM materials WHERE package_id IS NOT NULL');
    if (!fallback.rows?.length) return new Map();

    const packageIds = [...new Set(fallback.rows.map((row) => Number(row.package_id)).filter((id) => Number.isInteger(id)))];
    const packages = packageIds.length
      ? await db.query('SELECT id, name, type FROM packages WHERE id = ANY($1::int[])', [packageIds])
      : { rows: [] };

    const packageById = new Map((packages.rows || []).map((pkg) => [Number(pkg.id), pkg]));
    const map = new Map();
    for (const row of fallback.rows || []) {
      const packageId = Number(row.package_id);
      if (!Number.isInteger(packageId)) continue;
      map.set(row.id, [
        {
          package_id: packageId,
          package: packageById.get(packageId) || { id: packageId, name: null, type: null },
        },
      ]);
    }
    return map;
  }
};

const withMaterialPackages = (materials, packageMap) => {
  return (materials || []).map((item) => {
    const attached = packageMap.get(item.id) || [];
    return {
      ...item,
      file_url: item.file_url || item.storage_key || null,
      attached_packages: attached,
      package_ids: attached.map((row) => row.package_id),
    };
  });
};

console.log('materials/upload: initializing S3 client', { endpoint: config.storageEndpoint, bucket: config.storageBucket });
let s3;
try {
  s3 = new S3Client({
    endpoint: config.storageEndpoint,
    region: 'us-east-1',
    credentials: {
      accessKeyId: config.storageKey || '',
      secretAccessKey: config.storageSecret || ''
    },
    forcePathStyle: true
  });
} catch (e) {
  console.error('materials/upload: failed to create S3 client', e && e.stack ? e.stack : e);
  s3 = null;
}

async function uploadToStorage({ buffer, mimeType, folder = 'materials' }) {
  const key = `${folder}/${Date.now()}-${uuidv4()}`;
  const command = new PutObjectCommand({
    Bucket: config.storageBucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType
  });
  console.log('materials/upload: sending PutObjectCommand', { key, mimeType, size: buffer && buffer.length });
  if (!s3) throw new Error('S3 client not initialized');
  await s3.send(command);
  return `${config.cdnUrl.replace(/\/$/, '')}/${config.storageBucket}/${key}`;
}

async function handleMaterialUpload(req, res) {
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
}

// Admin-only: upload PDF material (mounted under /api)
router.post('/materials', requireAdmin, upload.single('file'), handleMaterialUpload);
router.post('/materials/upload', requireAdmin, upload.single('file'), handleMaterialUpload);

router.get('/materials/admin', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query('SELECT * FROM materials ORDER BY created_at DESC NULLS LAST, id DESC');
    const packageMap = await loadPackageMap(db);
    return res.json(withMaterialPackages(result.rows || [], packageMap));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/materials/:id', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId)) return res.status(400).json({ error: 'Invalid material id' });

    const packageIds = parsePackageIds(req.body || {});
    const updates = {
      title: Object.prototype.hasOwnProperty.call(req.body || {}, 'title') ? (req.body.title || null) : undefined,
      description: Object.prototype.hasOwnProperty.call(req.body || {}, 'description') ? (req.body.description || null) : undefined,
      category_id: Object.prototype.hasOwnProperty.call(req.body || {}, 'categoryId') ? (req.body.categoryId ? Number(req.body.categoryId) : null) : undefined,
      package_id: packageIds.length ? packageIds[0] : undefined,
    };

    const fields = [];
    const values = [];
    if (updates.title !== undefined) { fields.push(`title = $${values.length + 1}`); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push(`description = $${values.length + 1}`); values.push(updates.description); }
    if (updates.category_id !== undefined) { fields.push(`category_id = $${values.length + 1}`); values.push(updates.category_id); }
    if (updates.package_id !== undefined) { fields.push(`package_id = $${values.length + 1}`); values.push(updates.package_id); }
    fields.push('updated_at = NOW()');

    values.push(materialId);
    const result = await db.query(
      `UPDATE materials SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Material not found' });

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'packageIds') || Object.prototype.hasOwnProperty.call(req.body || {}, 'packageId')) {
      try {
        await db.query('DELETE FROM package_materials WHERE material_id = $1', [materialId]);
        if (packageIds.length) {
          await db.query(
            'INSERT INTO package_materials (material_id, package_id, created_at) SELECT $1, UNNEST($2::int[]), NOW()',
            [materialId, packageIds]
          );
        }
      } catch (_) {}
    }

    const packageMap = await loadPackageMap(db);
    const normalized = withMaterialPackages(result.rows, packageMap)[0];
    return res.json({ message: 'Material updated', material: normalized });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/materials/:id', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId)) return res.status(400).json({ error: 'Invalid material id' });

    try {
      await db.query('DELETE FROM package_materials WHERE material_id = $1', [materialId]);
    } catch (_) {}

    const result = await db.query('DELETE FROM materials WHERE id = $1 RETURNING id', [materialId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Material not found' });
    return res.json({ message: 'Material deleted' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/materials/:id/packages', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const materialId = Number(req.params.id);
    const packageId = Number(req.body?.packageId);
    if (!Number.isInteger(materialId) || !Number.isInteger(packageId)) {
      return res.status(400).json({ error: 'Invalid material or package id' });
    }

    try {
      await db.query(
        'INSERT INTO package_materials (material_id, package_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
        [materialId, packageId]
      );
    } catch (_) {
      await db.query('UPDATE materials SET package_id = $1, updated_at = NOW() WHERE id = $2', [packageId, materialId]);
    }

    return res.json({ message: 'Package attached to material' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/materials/:id/packages/:packageId', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const materialId = Number(req.params.id);
    const packageId = Number(req.params.packageId);
    if (!Number.isInteger(materialId) || !Number.isInteger(packageId)) {
      return res.status(400).json({ error: 'Invalid material or package id' });
    }

    try {
      await db.query('DELETE FROM package_materials WHERE material_id = $1 AND package_id = $2', [materialId, packageId]);
    } catch (_) {
      await db.query('UPDATE materials SET package_id = NULL, updated_at = NOW() WHERE id = $1 AND package_id = $2', [materialId, packageId]);
    }

    return res.json({ message: 'Package detached from material' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
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
