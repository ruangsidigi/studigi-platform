const express = require('express');
const multer = require('multer');
const supabase = require('../config/supabase');
const fileStorageService = require('../services/fileStorageService');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { ensureMaterialAccess, getPurchasedPackageIds } = require('../middleware/materialAccess');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const isMissingPackageMaterialsTable = (message) =>
  String(message || '').includes("Could not find the table 'public.package_materials'");

const getAccessiblePackageIds = async (user) => {
  if (user?.role === 'admin') return null;

  const ownedPackageIds = await getPurchasedPackageIds(user.id);
  const accessible = new Set(ownedPackageIds);

  if (!ownedPackageIds.length) {
    return accessible;
  }

  // Include sub-packages when user owns a bundle package
  const { data: bundleLinks, error: bundleLinkError } = await supabase
    .from('bundle_packages')
    .select('bundle_id, package_id')
    .in('bundle_id', ownedPackageIds);

  if (!bundleLinkError) {
    for (const link of bundleLinks || []) {
      if (Number.isInteger(Number(link.package_id))) {
        accessible.add(Number(link.package_id));
      }
    }
  }

  // Include included_package_ids fallback
  const { data: ownedPackages, error: ownedPackagesError } = await supabase
    .from('packages')
    .select('id, included_package_ids')
    .in('id', ownedPackageIds);

  if (!ownedPackagesError) {
    for (const pkg of ownedPackages || []) {
      const included = Array.isArray(pkg.included_package_ids)
        ? pkg.included_package_ids
        : [];

      for (const includedId of included) {
        const normalized = Number(includedId);
        if (Number.isInteger(normalized)) {
          accessible.add(normalized);
        }
      }
    }
  }

  return accessible;
};

const parsePackageIds = (body) => {
  const values = [];

  if (body.packageId) {
    values.push(body.packageId);
  }

  if (Array.isArray(body.packageIds)) {
    values.push(...body.packageIds);
  } else if (typeof body.packageIds === 'string') {
    const raw = body.packageIds.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          values.push(...parsed);
        } else {
          values.push(raw);
        }
      } catch {
        values.push(...raw.split(','));
      }
    }
  }

  return [...new Set(values
    .map((item) => Number(item))
    .filter((value) => Number.isInteger(value) && value > 0))];
};

const loadPackageMap = async () => {
  const { data, error } = await supabase
    .from('package_materials')
    .select('material_id, package_id, packages(id, name, type)');

  if (error) {
    if (!isMissingPackageMaterialsTable(error.message)) {
      throw new Error(error.message);
    }

    const { data: legacyMaterials, error: legacyError } = await supabase
      .from('materials')
      .select('id, package_id, packages(id, name, type)')
      .not('package_id', 'is', null);

    if (legacyError) throw new Error(legacyError.message);

    const legacyMap = new Map();
    for (const row of legacyMaterials || []) {
      legacyMap.set(row.id, [
        {
          package_id: row.package_id,
          package: row.packages || null,
        },
      ]);
    }

    return legacyMap;
  }

  const result = new Map();
  for (const row of data || []) {
    if (!result.has(row.material_id)) {
      result.set(row.material_id, []);
    }
    result.get(row.material_id).push({
      package_id: row.package_id,
      package: row.packages || null,
    });
  }
  return result;
};

const attachPackagesToMaterial = async (materialId, packageIds) => {
  if (!packageIds.length) return;

  const rows = packageIds.map((packageId) => ({
    package_id: packageId,
    material_id: materialId,
    created_at: new Date(),
  }));

  const { error } = await supabase
    .from('package_materials')
    .upsert(rows, { onConflict: 'package_id,material_id' });

  if (error) {
    if (!isMissingPackageMaterialsTable(error.message)) {
      throw new Error(error.message);
    }

    const { error: legacyError } = await supabase
      .from('materials')
      .update({ package_id: packageIds[0], updated_at: new Date() })
      .eq('id', materialId);

    if (legacyError) throw new Error(legacyError.message);
  }
};

// Upload material PDF and associate with category or package
router.post(
  '/upload',
  authenticateToken,
  authorizeRole(['admin']),
  upload.single('file'),
  async (req, res) => {
    try {
      const { categoryId, title, description } = req.body;
      const packageIds = parsePackageIds(req.body);
      if (!req.file) return res.status(400).json({ error: 'File is required' });

      const lowerName = (req.file.originalname || '').toLowerCase();
      const isPdf = lowerName.endsWith('.pdf') || req.file.mimetype === 'application/pdf';
      if (!isPdf) return res.status(400).json({ error: 'Only PDF files are allowed' });

      const uploadResult = await fileStorageService.uploadPDF(
        req.file.buffer,
        req.file.originalname,
        title || 'material'
      );

      // Insert metadata into materials table
      const { data, error } = await supabase.from('materials').insert([
        {
          title: title || req.file.originalname,
          description: description || null,
          category_id: categoryId ? parseInt(categoryId) : null,
          package_id: packageIds[0] || null,
          file_path: uploadResult.path,
          file_url: uploadResult.publicUrl,
          uploaded_by: req.user.id,
          updated_at: new Date(),
          created_at: new Date(),
        },
      ]).select().single();

      if (error) return res.status(400).json({ error: error.message });

      await attachPackagesToMaterial(data.id, packageIds);

      const packageMap = await loadPackageMap();

      res.json({
        message: 'Material uploaded',
        material: {
          ...data,
          attached_packages: packageMap.get(data.id) || [],
          package_ids: (packageMap.get(data.id) || []).map((item) => item.package_id),
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get('/admin', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    const packageMap = await loadPackageMap();
    const response = (data || []).map((item) => ({
      ...item,
      attached_packages: packageMap.get(item.id) || [],
      package_ids: (packageMap.get(item.id) || []).map((link) => link.package_id),
    }));

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId)) return res.status(400).json({ error: 'Invalid material id' });

    const packageIds = parsePackageIds(req.body);
    const payload = {
      updated_at: new Date(),
    };

    if (Object.prototype.hasOwnProperty.call(req.body, 'title')) payload.title = req.body.title || null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'description')) payload.description = req.body.description || null;
    if (Object.prototype.hasOwnProperty.call(req.body, 'categoryId')) {
      payload.category_id = req.body.categoryId ? Number(req.body.categoryId) : null;
    }
    if (packageIds.length) {
      payload.package_id = packageIds[0];
    }

    const { data, error } = await supabase
      .from('materials')
      .update(payload)
      .eq('id', materialId)
      .select('*')
      .single();

    if (error) return res.status(400).json({ error: error.message });

    if (Object.prototype.hasOwnProperty.call(req.body, 'packageIds') || Object.prototype.hasOwnProperty.call(req.body, 'packageId')) {
      const { error: deleteError } = await supabase.from('package_materials').delete().eq('material_id', materialId);
      if (deleteError && !isMissingPackageMaterialsTable(deleteError.message)) {
        return res.status(400).json({ error: deleteError.message });
      }
      await attachPackagesToMaterial(materialId, packageIds);
    }

    const packageMap = await loadPackageMap();
    res.json({
      message: 'Material updated',
      material: {
        ...data,
        attached_packages: packageMap.get(materialId) || [],
        package_ids: (packageMap.get(materialId) || []).map((link) => link.package_id),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!Number.isInteger(materialId)) return res.status(400).json({ error: 'Invalid material id' });

    const { error: mapDeleteError } = await supabase.from('package_materials').delete().eq('material_id', materialId);
    if (mapDeleteError && !isMissingPackageMaterialsTable(mapDeleteError.message)) {
      return res.status(400).json({ error: mapDeleteError.message });
    }
    const { error } = await supabase.from('materials').delete().eq('id', materialId);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'Material deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/packages', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    const packageId = Number(req.body.packageId);
    if (!Number.isInteger(materialId) || !Number.isInteger(packageId)) {
      return res.status(400).json({ error: 'Invalid material or package id' });
    }

    await attachPackagesToMaterial(materialId, [packageId]);
    res.json({ message: 'Package attached to material' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/packages/:packageId', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    const packageId = Number(req.params.packageId);
    if (!Number.isInteger(materialId) || !Number.isInteger(packageId)) {
      return res.status(400).json({ error: 'Invalid material or package id' });
    }

    const { error } = await supabase
      .from('package_materials')
      .delete()
      .eq('material_id', materialId)
      .eq('package_id', packageId);

    if (error && !isMissingPackageMaterialsTable(error.message)) {
      return res.status(400).json({ error: error.message });
    }

    if (error && isMissingPackageMaterialsTable(error.message)) {
      const { error: legacyError } = await supabase
        .from('materials')
        .update({ package_id: null, updated_at: new Date() })
        .eq('id', materialId)
        .eq('package_id', packageId);
      if (legacyError) return res.status(400).json({ error: legacyError.message });
    }

    res.json({ message: 'Package detached from material' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my', authenticateToken, async (req, res) => {
  try {
    const purchasedPackageIds = await getPurchasedPackageIds(req.user.id);
    if (!purchasedPackageIds.length) return res.json([]);

    const { data: links, error: linkError } = await supabase
      .from('package_materials')
      .select('material_id, package_id, packages(id, name, type)')
      .in('package_id', purchasedPackageIds);

    if (linkError) {
      if (!isMissingPackageMaterialsTable(linkError.message)) {
        return res.status(400).json({ error: linkError.message });
      }

      const { data: legacyMaterials, error: legacyError } = await supabase
        .from('materials')
        .select('*, packages(id, name, type)')
        .in('package_id', purchasedPackageIds)
        .order('created_at', { ascending: false });

      if (legacyError) return res.status(400).json({ error: legacyError.message });

      const fallbackResponse = (legacyMaterials || []).map((material) => ({
        ...material,
        attached_packages: material.package_id ? [{ package_id: material.package_id, package: material.packages || null }] : [],
        package_ids: material.package_id ? [material.package_id] : [],
      }));

      return res.json(fallbackResponse);
    }

    const materialIds = [...new Set((links || []).map((item) => Number(item.material_id)).filter((value) => Number.isInteger(value)))];
    if (!materialIds.length) return res.json([]);

    const { data: materials, error } = await supabase
      .from('materials')
      .select('*')
      .in('id', materialIds)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    const grouped = new Map();
    for (const link of links || []) {
      if (!grouped.has(link.material_id)) grouped.set(link.material_id, []);
      grouped.get(link.material_id).push({
        package_id: link.package_id,
        package: link.packages || null,
      });
    }

    const response = (materials || []).map((material) => ({
      ...material,
      attached_packages: grouped.get(material.id) || [],
      package_ids: (grouped.get(material.id) || []).map((item) => item.package_id),
    }));

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/package/:packageId', authenticateToken, async (req, res) => {
  try {
    const packageId = Number(req.params.packageId);
    if (!Number.isInteger(packageId)) {
      return res.status(400).json({ error: 'Invalid package id' });
    }

    const accessiblePackageIds = await getAccessiblePackageIds(req.user);
    if (accessiblePackageIds && !accessiblePackageIds.has(packageId)) {
      return res.status(403).json({ error: 'You do not have access to this package materials' });
    }

    let materials = [];

    const { data: links, error: linkError } = await supabase
      .from('package_materials')
      .select('material_id')
      .eq('package_id', packageId);

    if (linkError && !isMissingPackageMaterialsTable(linkError.message)) {
      return res.status(400).json({ error: linkError.message });
    }

    if (linkError && isMissingPackageMaterialsTable(linkError.message)) {
      const { data: legacy, error: legacyError } = await supabase
        .from('materials')
        .select('*')
        .eq('package_id', packageId)
        .order('created_at', { ascending: false });

      if (legacyError) {
        return res.status(400).json({ error: legacyError.message });
      }

      materials = legacy || [];
    } else {
      const materialIds = [...new Set((links || []).map((item) => Number(item.material_id)).filter((value) => Number.isInteger(value)))];

      if (!materialIds.length) {
        return res.json([]);
      }

      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .in('id', materialIds)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      materials = data || [];
    }

    res.json(materials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/access', authenticateToken, ensureMaterialAccess, async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    const { data: material, error } = await supabase
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single();

    if (error) return res.status(404).json({ error: error.message });

    let accessUrl = material.file_url;

    if (material.file_path && !String(material.file_path).startsWith('/storage/')) {
      const { data: signed, error: signedError } = await supabase.storage
        .from('materials')
        .createSignedUrl(material.file_path, 60 * 60);

      if (!signedError && signed?.signedUrl) {
        accessUrl = signed.signedUrl;
      }
    }

    res.json({
      id: material.id,
      title: material.title,
      description: material.description,
      access_url: accessUrl,
      file_url: material.file_url,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
