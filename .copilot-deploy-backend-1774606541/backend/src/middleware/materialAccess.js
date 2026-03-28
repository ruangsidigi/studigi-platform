const supabase = require('../config/supabase');

const isMissingPackageMaterialsTable = (message) =>
  String(message || '').includes("Could not find the table 'public.package_materials'");

const getPurchasedPackageIds = async (userId) => {
  const { data, error } = await supabase
    .from('purchases')
    .select('package_id, payment_status')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  const packageIds = (data || [])
    .filter((row) => {
      const status = String(row.payment_status || 'completed').toLowerCase();
      return status === 'completed' || status === 'paid' || status === 'success';
    })
    .map((row) => Number(row.package_id))
    .filter((value) => Number.isInteger(value));

  return [...new Set(packageIds)];
};

const ensureMaterialAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    const materialId = Number(req.params.id || req.params.materialId);
    if (!Number.isInteger(materialId)) {
      return res.status(400).json({ error: 'Invalid material id' });
    }

    const { data: packageLinks, error: linkError } = await supabase
      .from('package_materials')
      .select('package_id')
      .eq('material_id', materialId);

    let attachedPackageIds = [];

    if (linkError) {
      if (!isMissingPackageMaterialsTable(linkError.message)) {
        return res.status(400).json({ error: linkError.message });
      }

      const { data: material, error: materialError } = await supabase
        .from('materials')
        .select('package_id')
        .eq('id', materialId)
        .single();

      if (materialError) {
        return res.status(400).json({ error: materialError.message });
      }

      if (Number.isInteger(Number(material.package_id))) {
        attachedPackageIds = [Number(material.package_id)];
      }
    } else {
      attachedPackageIds = (packageLinks || [])
        .map((item) => Number(item.package_id))
        .filter((value) => Number.isInteger(value));
    }

    if (attachedPackageIds.length === 0) {
      return res.status(403).json({ error: 'Material is not attached to any package' });
    }

    const purchasedPackageIds = await getPurchasedPackageIds(req.user.id);
    const allowed = attachedPackageIds.some((packageId) => purchasedPackageIds.includes(packageId));

    if (!allowed) {
      return res.status(403).json({ error: 'You do not have access to this material' });
    }

    req.materialAccess = {
      materialId,
      attachedPackageIds,
      purchasedPackageIds,
    };

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  ensureMaterialAccess,
  getPurchasedPackageIds,
};
