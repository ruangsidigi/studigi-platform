// backend/services/materials/upload.js
const express = require('express');
const multer = require('multer');
const axios = require('axios');
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

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const isAdminUser = (user) => {
  const roleNames = getUserRoleNames(user);
  return (
    roleNames.includes('admin') ||
    String(user?.role || '').toLowerCase() === 'admin' ||
    String(user?.email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase()
  );
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
  const map = new Map();
  const packageById = new Map();

  const pushMapping = (materialId, packageId) => {
    const normalizedMaterialId = Number(materialId);
    const normalizedPackageId = Number(packageId);
    if (!Number.isInteger(normalizedMaterialId) || normalizedMaterialId <= 0) return;
    if (!Number.isInteger(normalizedPackageId) || normalizedPackageId <= 0) return;

    if (!map.has(normalizedMaterialId)) map.set(normalizedMaterialId, []);
    const existing = map.get(normalizedMaterialId);
    if (existing.some((item) => Number(item.package_id) === normalizedPackageId)) return;

    const pkg = packageById.get(normalizedPackageId) || { id: normalizedPackageId, name: null, type: null };
    existing.push({
      package_id: normalizedPackageId,
      package: {
        id: normalizedPackageId,
        name: pkg.name || null,
        type: pkg.type || null,
      },
    });
  };

  // Primary source: explicit many-to-many relation.
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

    for (const row of links.rows || []) {
      const packageId = Number(row.package_id);
      if (Number.isInteger(packageId) && packageId > 0) {
        packageById.set(packageId, {
          id: packageId,
          name: row.package_name || null,
          type: row.package_type || null,
        });
      }
      pushMapping(row.material_id, row.package_id);
    }
  } catch (_) {
    // Ignore and continue with legacy mapping fallback.
  }

  // Legacy source: single package link on materials.package_id.
  try {
    const legacy = await db.query('SELECT id, package_id FROM materials WHERE package_id IS NOT NULL');
    const legacyPackageIds = [...new Set(
      (legacy.rows || [])
        .map((row) => Number(row.package_id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];

    const missingIds = legacyPackageIds.filter((id) => !packageById.has(id));
    if (missingIds.length) {
      const packages = await db.query('SELECT id, name, type FROM packages WHERE id = ANY($1::int[])', [missingIds]);
      for (const pkg of packages.rows || []) {
        const id = Number(pkg.id);
        if (!Number.isInteger(id) || id <= 0) continue;
        packageById.set(id, {
          id,
          name: pkg.name || null,
          type: pkg.type || null,
        });
      }
    }

    for (const row of legacy.rows || []) {
      pushMapping(row.id, row.package_id);
    }
  } catch (_) {
    // Ignore when legacy column does not exist.
  }

  return map;
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

const getOwnedPackageIds = async (db, userId) => {
  const completedStatuses = ['paid', 'completed', 'success', 'settlement'];

  const result = await db.query(
    `SELECT package_id
     FROM purchases
     WHERE user_id = $1
       AND LOWER(COALESCE(payment_status, '')) = ANY($2::text[])
       AND package_id IS NOT NULL`,
    [userId, completedStatuses]
  );

  const owned = new Set(
    (result.rows || [])
      .map((row) => Number(row.package_id))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  if (!owned.size) return [];

  const ownedIds = [...owned];

  // Include sub-packages from bundle_packages when user owns bundle package(s).
  try {
    const bundleLinks = await db.query(
      'SELECT package_id FROM bundle_packages WHERE bundle_id = ANY($1::int[])',
      [ownedIds]
    );
    for (const row of bundleLinks.rows || []) {
      const subPackageId = Number(row.package_id);
      if (Number.isInteger(subPackageId) && subPackageId > 0) owned.add(subPackageId);
    }
  } catch (_) {
    // Ignore when bundle_packages table does not exist.
  }

  // Fallback expansion using packages.included_package_ids for legacy data.
  try {
    const pkgRows = await db.query(
      'SELECT id, included_package_ids FROM packages WHERE id = ANY($1::int[])',
      [ownedIds]
    );
    for (const row of pkgRows.rows || []) {
      const included = Array.isArray(row.included_package_ids) ? row.included_package_ids : [];
      for (const includedId of included) {
        const normalized = Number(includedId);
        if (Number.isInteger(normalized) && normalized > 0) owned.add(normalized);
      }
    }
  } catch (_) {
    // Ignore legacy schema mismatches.
  }

  return [...owned];
};

const filterMaterialsByAccessiblePackages = (materials, packageMap, allowedPackageIds) => {
  const allowed = new Set((allowedPackageIds || []).map((id) => Number(id)));
  const normalized = withMaterialPackages(materials, packageMap);

  return normalized.filter((material) => {
    const packageIds = material.package_ids || [];
    if (packageIds.length === 0) return false;
    return packageIds.some((packageId) => allowed.has(Number(packageId)));
  });
};

const getBundleRelatedPackageIds = async (db, packageId) => {
  const ids = new Set([Number(packageId)]);

  try {
    const bundleLinks = await db.query(
      'SELECT package_id FROM bundle_packages WHERE bundle_id = $1',
      [packageId]
    );
    for (const row of bundleLinks.rows || []) {
      const childId = Number(row.package_id);
      if (Number.isInteger(childId) && childId > 0) ids.add(childId);
    }
  } catch (_) {
    // Ignore when bundle_packages relation is unavailable.
  }

  try {
    const packageResult = await db.query(
      'SELECT included_package_ids FROM packages WHERE id = $1 LIMIT 1',
      [packageId]
    );
    const included = Array.isArray(packageResult.rows?.[0]?.included_package_ids)
      ? packageResult.rows[0].included_package_ids
      : [];
    for (const item of included) {
      const includedId = Number(item);
      if (Number.isInteger(includedId) && includedId > 0) ids.add(includedId);
    }
  } catch (_) {
    // Ignore schema drift.
  }

  return [...ids];
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

function buildPublicStorageUrl(bucket, key) {
  const base = (config.cdnUrl || config.storageEndpoint || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  if (!base) return `${bucket}/${key}`;

  if (/supabase\.co/i.test(base)) {
    if (/\/storage\/v1\/object\/public/i.test(base)) {
      return `${base}/${bucket}/${key}`;
    }
    return `${base}/storage/v1/object/public/${bucket}/${key}`;
  }

  return `${base}/${bucket}/${key}`;
}

function extractSupabasePublicObject(url) {
  try {
    const parsed = new URL(String(url || ''));
    const match = parsed.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i);
    if (!match) return null;
    return {
      origin: parsed.origin,
      bucket: match[1],
      key: match[2],
    };
  } catch (_) {
    return null;
  }
}

function buildSupabasePrivateObjectUrl(base, bucket, key) {
  const b = String(base || '').replace(/\/$/, '');
  if (!b || !bucket || !key) return null;
  if (/\/storage\/v1\/object\//i.test(b)) {
    if (/\/public\//i.test(b)) {
      return b.replace(/\/public\//i, '/').replace(/\/$/, '') + `/${bucket}/${key}`;
    }
    return `${b}/${bucket}/${key}`;
  }
  return `${b}/storage/v1/object/${bucket}/${key}`;
}

function getSupabaseServiceHeaders() {
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '').trim();
  if (!key) return null;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function buildMaterialAccessCandidates(material) {
  const candidates = [];
  const bucketCandidates = [];
  const keyCandidates = [];
  const baseCandidates = [];

  const pushUnique = (list, value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    if (!list.includes(normalized)) list.push(normalized);
  };

  const pushCandidate = (url, options = {}) => {
    const normalized = String(url || '').trim();
    if (!normalized) return;
    if (candidates.some((item) => item.url === normalized)) return;
    candidates.push({
      url: normalized,
      requiresServiceAuth: Boolean(options.requiresServiceAuth),
    });
  };

  const rawValues = [material?.file_url, material?.storage_key]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const raw of rawValues) {
    if (/^data:/i.test(raw)) {
      pushCandidate(raw);
      continue;
    }

    if (/^https?:\/\//i.test(raw)) {
      pushCandidate(raw);
      const parsed = extractSupabasePublicObject(raw);
      if (parsed) {
        pushUnique(bucketCandidates, parsed.bucket);
        pushUnique(keyCandidates, parsed.key);
        pushUnique(baseCandidates, parsed.origin);
        pushCandidate(buildSupabasePrivateObjectUrl(parsed.origin, parsed.bucket, parsed.key), { requiresServiceAuth: true });
      }
      continue;
    }

    const trimmed = raw.replace(/^\/+/, '');
    if (!trimmed) continue;

    const slashIndex = trimmed.indexOf('/');
    if (slashIndex > 0) {
      pushUnique(bucketCandidates, trimmed.slice(0, slashIndex));
      pushUnique(keyCandidates, trimmed.slice(slashIndex + 1));
    }
    pushUnique(keyCandidates, trimmed);
  }

  pushUnique(bucketCandidates, material?.storage_bucket);
  pushUnique(bucketCandidates, config.storageBucket);
  pushUnique(bucketCandidates, 'materials');
  pushUnique(bucketCandidates, 'materials-pdf');
  pushUnique(bucketCandidates, 'public');

  const defaultBase = (config.cdnUrl || config.storageEndpoint || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  pushUnique(baseCandidates, defaultBase);
  pushUnique(baseCandidates, process.env.SUPABASE_URL);

  const buildFromBaseBucketKey = (base, bucket, key) => {
    const b = String(base || '').replace(/\/$/, '');
    if (!b || !bucket || !key) return null;

    if (/supabase\.co/i.test(b)) {
      if (/\/storage\/v1\/object\/public/i.test(b)) {
        return `${b}/${bucket}/${key}`;
      }
      return `${b}/storage/v1/object/public/${bucket}/${key}`;
    }

    return `${b}/${bucket}/${key}`;
  };

  for (const base of baseCandidates) {
    for (const bucket of bucketCandidates) {
      for (const key of keyCandidates) {
        pushCandidate(buildFromBaseBucketKey(base, bucket, key));
        pushCandidate(buildSupabasePrivateObjectUrl(base, bucket, key), { requiresServiceAuth: true });
      }
    }
  }

  if (config.storageBucket) {
    for (const key of keyCandidates) {
      pushCandidate(buildPublicStorageUrl(config.storageBucket, key));
    }
  }

  return candidates;
}

async function resolveMaterialAccessUrl(material) {
  const candidates = buildMaterialAccessCandidates(material);
  if (!candidates.length) return null;

  const serviceHeaders = getSupabaseServiceHeaders();

  for (const candidate of candidates) {
    if (/^data:/i.test(candidate.url)) return candidate.url;
    if (!/^https?:\/\//i.test(candidate.url)) return candidate.url;

    const headers = candidate.requiresServiceAuth && serviceHeaders
      ? { ...serviceHeaders, Range: 'bytes=0-0' }
      : { Range: 'bytes=0-0' };

    try {
      const probe = await axios.request({
        url: candidate.url,
        method: 'GET',
        headers,
        responseType: 'arraybuffer',
        timeout: 7000,
        validateStatus: () => true,
      });

      if (probe.status >= 200 && probe.status < 400) {
        return candidate.url;
      }
    } catch (_) {
      // Try next candidate.
    }
  }

  return candidates[0].url;
}

async function fetchMaterialStream(material) {
  const candidates = buildMaterialAccessCandidates(material);
  if (!candidates.length) return null;

  const serviceHeaders = getSupabaseServiceHeaders();

  for (const candidate of candidates) {
    const url = String(candidate.url || '');
    if (!url) continue;

    if (/^data:application\/pdf;base64,/i.test(url)) {
      const payload = url.replace(/^data:application\/pdf;base64,/i, '');
      return {
        type: 'buffer',
        body: Buffer.from(payload, 'base64'),
        contentType: 'application/pdf',
      };
    }

    if (!/^https?:\/\//i.test(url)) continue;

    const headers = candidate.requiresServiceAuth && serviceHeaders ? { ...serviceHeaders } : undefined;

    try {
      const response = await axios.request({
        url,
        method: 'GET',
        headers,
        responseType: 'stream',
        timeout: 15000,
        validateStatus: () => true,
      });

      if (response.status >= 200 && response.status < 400) {
        return {
          type: 'stream',
          body: response.data,
          contentType: response.headers?.['content-type'] || 'application/pdf',
          contentLength: response.headers?.['content-length'] || null,
        };
      }
    } catch (_) {
      // Try next candidate.
    }
  }

  return null;
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
  return buildPublicStorageUrl(config.storageBucket, key);
}

async function handleMaterialUpload(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const allowed = ['application/pdf'];
    if (!allowed.includes(req.file.mimetype)) return res.status(400).json({ error: 'Invalid file type' });
    const url = await uploadToStorage({ buffer: req.file.buffer, mimeType: req.file.mimetype, folder: 'materials' });
    const db = req.app.locals.db;
    const materialColumnsResult = await db.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'materials'`
    );
    const materialColumns = new Set((materialColumnsResult.rows || []).map((row) => String(row.column_name || '').toLowerCase()));

    const insertColumns = [];
    const insertValues = [];

    const pushInsert = (column, value) => {
      if (!materialColumns.has(column)) return;
      insertColumns.push(column);
      insertValues.push(value);
    };

    const parseOptionalInt = (value) => {
      const n = Number(value);
      return Number.isInteger(n) && n > 0 ? n : null;
    };

    const packageIds = parsePackageIds(req.body || {});
    const title = (req.body?.title || req.file.originalname || '').trim() || 'Untitled Material';

    pushInsert('title', title);
    pushInsert('description', req.body?.description || null);
    pushInsert('category_id', parseOptionalInt(req.body?.categoryId || req.body?.category_id));
    pushInsert('package_id', packageIds.length ? packageIds[0] : parseOptionalInt(req.body?.packageId || req.body?.package_id));
    pushInsert('storage_key', url);
    pushInsert('storage_bucket', config.storageBucket || null);
    pushInsert('mime_type', req.file.mimetype || 'application/pdf');
    pushInsert('size_bytes', req.file.size || null);
    pushInsert('created_by', req.user?.id || null);
    pushInsert('file_url', url);
    pushInsert('file_path', url);

    if (!insertColumns.length) {
      return res.status(500).json({ error: 'Table materials tidak memiliki kolom yang didukung untuk upload' });
    }

    const valuePlaceholders = insertColumns.map((_, index) => `$${index + 1}`).join(',');
    const result = await db.query(
      `INSERT INTO materials (${insertColumns.join(', ')}) VALUES (${valuePlaceholders}) RETURNING id`,
      insertValues
    );
    try {
      await db.query(`INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, after) VALUES ($1,$2,$3,$4,$5)`,
        [req.user?.id || null, 'create_material', 'material', result.rows[0].id, { url }]);
    } catch (_) {}
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
      try {
        await db.query(
          'INSERT INTO package_materials (material_id, package_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [materialId, packageId]
        );
      } catch (_) {
        await db.query('UPDATE materials SET package_id = $1, updated_at = NOW() WHERE id = $2', [packageId, materialId]);
      }
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

router.get('/materials/my', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const packageMap = await loadPackageMap(db);
    const allMaterialsResult = await db.query('SELECT * FROM materials ORDER BY created_at DESC NULLS LAST, id DESC');

    if (isAdminUser(req.user)) {
      return res.json(withMaterialPackages(allMaterialsResult.rows || [], packageMap));
    }

    const ownedPackageIds = await getOwnedPackageIds(db, req.user.id);
    if (!ownedPackageIds.length) return res.json([]);

    return res.json(filterMaterialsByAccessiblePackages(allMaterialsResult.rows || [], packageMap, ownedPackageIds));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/materials/package/:packageId', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const packageId = Number(req.params.packageId);
    if (!Number.isInteger(packageId)) return res.status(400).json({ error: 'Invalid package id' });

    const targetPackageIds = await getBundleRelatedPackageIds(db, packageId);

    const packageMap = await loadPackageMap(db);
    const allMaterialsResult = await db.query('SELECT * FROM materials ORDER BY created_at DESC NULLS LAST, id DESC');
    const allNormalized = withMaterialPackages(allMaterialsResult.rows || [], packageMap);

    if (!isAdminUser(req.user)) {
      const ownedPackageIds = await getOwnedPackageIds(db, req.user.id);
      const hasAccess = targetPackageIds.some((id) => ownedPackageIds.includes(id));
      if (!hasAccess) return res.status(403).json({ error: 'No access to this package materials' });
    }

    const targetSet = new Set(targetPackageIds.map((id) => Number(id)));
    const filtered = allNormalized.filter((material) =>
      (material.package_ids || []).some((id) => targetSet.has(Number(id)))
    );
    return res.json(filtered);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/materials/:id/access', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId)) return res.status(400).json({ error: 'Invalid material id' });

    const materialResult = await db.query('SELECT * FROM materials WHERE id = $1 LIMIT 1', [materialId]);
    const material = materialResult.rows[0];
    if (!material) return res.status(404).json({ error: 'Material not found' });

    if (!isAdminUser(req.user)) {
      const packageMap = await loadPackageMap(db);
      const attached = packageMap.get(materialId) || [];
      const materialPackageIds = attached.map((item) => Number(item.package_id)).filter((id) => Number.isInteger(id));

      if (!materialPackageIds.length) return res.status(403).json({ error: 'No access to this material' });

      const ownedPackageIds = await getOwnedPackageIds(db, req.user.id);
      const hasAccess = materialPackageIds.some((id) => ownedPackageIds.includes(id));
      if (!hasAccess) return res.status(403).json({ error: 'No access to this material' });
    }

    const accessUrl = await resolveMaterialAccessUrl(material);
    if (!accessUrl) return res.status(404).json({ error: 'Material URL not found' });
    return res.json({ access_url: accessUrl });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/materials/:id/file', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId)) return res.status(400).json({ error: 'Invalid material id' });

    const materialResult = await db.query('SELECT * FROM materials WHERE id = $1 LIMIT 1', [materialId]);
    const material = materialResult.rows[0];
    if (!material) return res.status(404).json({ error: 'Material not found' });

    if (!isAdminUser(req.user)) {
      const packageMap = await loadPackageMap(db);
      const attached = packageMap.get(materialId) || [];
      const materialPackageIds = attached.map((item) => Number(item.package_id)).filter((id) => Number.isInteger(id));

      if (!materialPackageIds.length) return res.status(403).json({ error: 'No access to this material' });

      const ownedPackageIds = await getOwnedPackageIds(db, req.user.id);
      const hasAccess = materialPackageIds.some((id) => ownedPackageIds.includes(id));
      if (!hasAccess) return res.status(403).json({ error: 'No access to this material' });
    }

    const fetched = await fetchMaterialStream(material);
    if (!fetched) return res.status(404).json({ error: 'Material file could not be resolved' });

    const fileName = `${String(material.title || 'material').replace(/[^a-z0-9-_]+/gi, '_') || 'material'}.pdf`;
    res.setHeader('Content-Type', fetched.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    if (fetched.contentLength) {
      res.setHeader('Content-Length', String(fetched.contentLength));
    }

    if (fetched.type === 'buffer') {
      return res.status(200).send(fetched.body);
    }

    fetched.body.on('error', () => {
      if (!res.headersSent) res.status(500).end('Failed to stream file');
    });
    return fetched.body.pipe(res);
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

    let logoValue;
    let usedStorageFallback = false;
    try {
      logoValue = await uploadToStorage({ buffer: req.file.buffer, mimeType: req.file.mimetype, folder: 'branding' });

      if (typeof logoValue === 'string' && /^https?:\/\//i.test(logoValue)) {
        const check = await axios.get(logoValue, {
          timeout: 7000,
          responseType: 'arraybuffer',
          validateStatus: () => true,
        });

        if (check.status >= 400) {
          throw new Error(`Public logo URL unreachable (status ${check.status})`);
        }
      }
    } catch (storageError) {
      console.warn('branding/logo: storage upload failed, fallback to data URL', storageError && storageError.message ? storageError.message : storageError);
      logoValue = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      usedStorageFallback = true;
    }

    const db = req.app.locals.db;
    const headerColor = req.body.header_color || '#103c21';

    const upsertLogoWithColumn = async (columnName) => {
      await db.query(
        `WITH updated AS (
           UPDATE branding_settings
           SET ${columnName} = $1,
               header_color = COALESCE($2, header_color),
               updated_at = NOW()
           RETURNING id
         )
         INSERT INTO branding_settings (${columnName}, header_color, created_at, updated_at)
         SELECT $1, $2, NOW(), NOW()
         WHERE NOT EXISTS (SELECT 1 FROM updated)`,
        [logoValue, headerColor]
      );
    };

    try {
      await upsertLogoWithColumn('logo_key');
    } catch (firstError) {
      await upsertLogoWithColumn('logo_url');
    }

    await db.query(
      `INSERT INTO audit_logs (actor_id, action, resource_type, after)
       VALUES ($1, $2, $3, $4)`,
      [req.user?.id || null, 'update_branding', 'branding', { url: logoValue }]
    ).catch(() => {});
    res.json({ url: logoValue, fallback: usedStorageFallback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed', detail: err && err.message ? err.message : String(err) });
  }
});

module.exports = router;
