const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Diagnostic: check bundle info (no auth required for debugging)
router.get('/bundle/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get package info
    const { data: pkg, error: pkgError } = await supabase
      .from('packages')
      .select('id, name, type, price, category_id, included_package_ids')
      .eq('id', id)
      .single();

    if (pkgError) {
      return res.status(404).json({ error: 'Package not found', details: pkgError });
    }

    // Check if bundle_packages table exists
    let bundlePackagesData = [];
    let tableMissingError = null;
    try {
      const { data: bp, error: bpError } = await supabase
        .from('bundle_packages')
        .select('id, bundle_id, package_id')
        .eq('bundle_id', id);

      if (bpError) {
        tableMissingError = bpError.message;
      } else {
        bundlePackagesData = bp || [];
      }
    } catch (e) {
      tableMissingError = String(e.message);
    }

    // Get included packages from included_package_ids
    let includedPackages = [];
    if (Array.isArray(pkg.included_package_ids) && pkg.included_package_ids.length > 0) {
      const { data: incPkgs, error: incError } = await supabase
        .from('packages')
        .select('id, name, type, price, question_count')
        .in('id', pkg.included_package_ids);

      if (!incError) {
        includedPackages = incPkgs || [];
      }
    }

    res.json({
      package: pkg,
      bundle_packages_table_exists: !tableMissingError,
      bundle_packages_table_error: tableMissingError || null,
      bundle_packages_records: bundlePackagesData,
      included_packages_from_jsonb: includedPackages,
      diagnostic_summary: {
        is_bundle_type: pkg.type === 'bundle' || pkg.type === 'bundling',
        has_included_package_ids: Array.isArray(pkg.included_package_ids) && pkg.included_package_ids.length > 0,
        bundle_packages_count: bundlePackagesData.length,
        included_packages_count: includedPackages.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
