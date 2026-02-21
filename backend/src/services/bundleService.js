const supabase = require('../config/supabase');

const normalizeIds = (rawIds) => {
  const ids = Array.isArray(rawIds)
    ? rawIds
    : rawIds
      ? JSON.parse(rawIds)
      : [];

  return ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
};

const createBundleLinks = async (bundleId, rawPackageIds) => {
  const packageIds = normalizeIds(rawPackageIds);

  await supabase.from('bundle_packages').delete().eq('bundle_id', bundleId);

  if (!packageIds.length) {
    return [];
  }

  const rows = packageIds.map((packageId) => ({
    bundle_id: bundleId,
    package_id: packageId,
  }));

  const { data, error } = await supabase
    .from('bundle_packages')
    .insert(rows)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
};

const getBundlePackages = async (bundleId) => {
  // Step 1: Get bundle_packages mappings
  const { data: mappings, error: mappingError } = await supabase
    .from('bundle_packages')
    .select('id, package_id')
    .eq('bundle_id', bundleId)
    .order('id', { ascending: true });

  if (mappingError) {
    const message = String(mappingError.message || '').toLowerCase();
    if (message.includes('bundle_packages') && message.includes('does not exist')) {
      return [];
    }
    throw new Error(mappingError.message);
  }

  if (!mappings || mappings.length === 0) {
    return [];
  }

  // Step 2: Get package details for each mapping
  const packageIds = mappings.map((m) => m.package_id);
  const { data: packages, error: packagesError } = await supabase
    .from('packages')
    .select('id, name, description, type, price, question_count, category_id')
    .in('id', packageIds);

  if (packagesError) {
    throw new Error(packagesError.message);
  }

  // Step 3: Merge and return in mapping order
  return packageIds
    .map((pkgId) => (packages || []).find((p) => p.id === pkgId))
    .filter(Boolean)
    .map((pkg) => ({
      ...pkg,
      item_type: pkg.type || 'single',
    }));
};

const getBundleDetail = async (bundleId) => {
  const { data: bundle, error: bundleError } = await supabase
    .from('packages')
    .select('id, name, description, type, price, question_count, category_id, included_package_ids')
    .eq('id', bundleId)
    .single();

  if (bundleError || !bundle) {
    throw new Error(bundleError?.message || 'Bundle not found');
  }

  let packages = [];
  try {
    packages = await getBundlePackages(bundleId);
  } catch (error) {
    throw error;
  }

  if (!packages.length && Array.isArray(bundle.included_package_ids) && bundle.included_package_ids.length > 0) {
    const includedIds = bundle.included_package_ids;
    const { data: fallbackItems, error: fallbackError } = await supabase
      .from('packages')
      .select('id, name, description, type, price, question_count, category_id')
      .in('id', includedIds);

    if (fallbackError) {
      throw new Error(fallbackError.message);
    }

    packages = includedIds
      .map((includedId) => (fallbackItems || []).find((item) => String(item.id) === String(includedId)))
      .filter(Boolean)
      .map((item) => ({
        ...item,
        item_type: item.type || 'single',
      }));
  }

  return {
    bundle: {
      ...bundle,
      is_bundle: true,
    },
    packages,
  };
};

const getBundleIds = async () => {
  const { data, error } = await supabase
    .from('bundle_packages')
    .select('bundle_id');

  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (message.includes('bundle_packages') && message.includes('does not exist')) {
      return new Set();
    }
    throw new Error(error.message);
  }

  return new Set((data || []).map((row) => String(row.bundle_id)));
};

module.exports = {
  createBundleLinks,
  getBundlePackages,
  getBundleDetail,
  getBundleIds,
};
