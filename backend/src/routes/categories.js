const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const bundleService = require('../services/bundleService');

const router = express.Router();

// Get categories that have packages (dynamic participant dashboard)
router.get('/with-packages', async (req, res) => {
  try {
    const { data: categories, error: categoryError } = await supabase
      .from('categories')
      .select('id, name, description')
      .order('name');

    if (categoryError) return res.status(400).json({ error: categoryError.message });

    const { data: packages, error: packageError } = await supabase
      .from('packages')
      .select('id, name, type, price, question_count, category_id, included_package_ids')
      .order('created_at', { ascending: false });

    if (packageError) return res.status(400).json({ error: packageError.message });

    let bundleIds = new Set();
    try {
      bundleIds = await bundleService.getBundleIds();
    } catch (bundleError) {
      console.warn('Failed to load bundle ids', bundleError.message);
    }

    const grouped = (categories || [])
      .map((category) => {
        const categoryPackages = (packages || []).filter(
          (pkg) => String(pkg.category_id) === String(category.id)
        );

        return {
          ...category,
          package_count: categoryPackages.length,
          bundle_count: categoryPackages.filter(
            (pkg) =>
              pkg.type === 'bundle' ||
              pkg.type === 'bundling' ||
              (Array.isArray(pkg.included_package_ids) && pkg.included_package_ids.length > 0) ||
              bundleIds.has(String(pkg.id))
          ).length,
          packages: categoryPackages,
        };
      })
      .filter((category) => category.package_count > 0);

    const uncategorized = (packages || []).filter((pkg) => pkg.category_id === null || pkg.category_id === undefined);
    if (uncategorized.length > 0) {
      grouped.push({
        id: 'uncategorized',
        name: 'Paket Bundling',
        description: 'Kumpulan paket bundling',
        package_count: uncategorized.length,
        bundle_count: uncategorized.filter(
          (pkg) =>
            pkg.type === 'bundle' ||
            pkg.type === 'bundling' ||
            (Array.isArray(pkg.included_package_ids) && pkg.included_package_ids.length > 0) ||
            bundleIds.has(String(pkg.id))
        ).length,
        packages: uncategorized,
      });
    }

    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get packages by category (participant page)
router.get('/:id/packages', async (req, res) => {
  try {
    const { id } = req.params;

    let category = null;
    if (id !== 'uncategorized') {
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id, name, description')
        .eq('id', id)
        .single();

      if (categoryError) return res.status(404).json({ error: 'Category not found' });
      category = categoryData;
    } else {
      category = { id: 'uncategorized', name: 'Paket Bundling', description: 'Kumpulan paket bundling' };
    }

    const packageQuery = supabase
      .from('packages')
      .select('id, name, description, type, price, question_count, category_id, included_package_ids, created_at')
      .order('created_at', { ascending: false });

    const { data: packages, error: packageError } = id === 'uncategorized'
      ? await packageQuery.is('category_id', null)
      : await packageQuery.eq('category_id', id);

    if (packageError) return res.status(400).json({ error: packageError.message });

    let bundleIds = new Set();
    try {
      bundleIds = await bundleService.getBundleIds();
    } catch (bundleError) {
      console.warn('Failed to load bundle ids', bundleError.message);
    }

    const normalized = (packages || []).map((pkg) => ({
      ...pkg,
      is_bundle:
        pkg.type === 'bundle' ||
        pkg.type === 'bundling' ||
        (Array.isArray(pkg.included_package_ids) && pkg.included_package_ids.length > 0) ||
        bundleIds.has(String(pkg.id)),
    }));

    res.json({ category, packages: normalized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all categories
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create category (admin)
router.post('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const { data, error } = await supabase
      .from('categories')
      .insert([{ name, description, created_at: new Date() }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Category created', category: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update category (admin)
router.put('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const { data, error } = await supabase
      .from('categories')
      .update({ name, description, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Category updated', category: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete category (admin)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
