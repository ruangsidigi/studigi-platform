// Update sort order of packages (Admin only)
router.patch('/order', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { orders } = req.body; // orders: [{id, sort_order}, ...]
    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders must be an array' });
    }
    const updates = [];
    const updateResults = [];
    for (const item of orders) {
      if (!item.id || typeof item.sort_order !== 'number') continue;
      const updatePromise = supabase.from('packages').update({ sort_order: item.sort_order }).eq('id', item.id)
        .then((result) => {
          if (result.error) {
            console.error('Update sort_order error:', { id: item.id, sort_order: item.sort_order, error: result.error });
          } else {
            console.log('Updated sort_order:', { id: item.id, sort_order: item.sort_order });
          }
          updateResults.push({ id: item.id, sort_order: item.sort_order, error: result.error });
          return result;
        });
      updates.push(updatePromise);
    }
    await Promise.all(updates);
    const failed = updateResults.filter(r => r.error);
    if (failed.length > 0) {
      return res.status(500).json({ error: 'Some updates failed', details: failed });
    }
    res.json({ message: 'Sort order updated', updateResults });
  } catch (error) {
    console.error('PATCH /api/packages/order fatal error:', error);
    res.status(500).json({ error: error.message });
  }
});
const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const bundleService = require('../services/bundleService');

const router = express.Router();

const normalizeCurrencyNumber = (rawValue) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;
  if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : null;

  const digitsOnly = String(rawValue).replace(/[^\d]/g, '');
  if (!digitsOnly) return null;

  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? parsed : null;
};

// Get leaderboard by package (participant-facing)
router.get('/:id/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: sessions, error } = await supabase
      .from('tryout_sessions')
      .select('id, user_id, package_id, started_at, finished_at, total_score, is_passed, participant_name, participant_province, users(name), users(display_name), users(email), packages(name)')
      .eq('package_id', id)
      .eq('status', 'completed');

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const ranking = Array.from(sessions || [])
      .sort((a, b) => {
        const scoreDiff = Number(b.total_score || 0) - Number(a.total_score || 0);
        if (scoreDiff !== 0) return scoreDiff;

        const aDuration = a.started_at && a.finished_at
          ? Math.max(0, new Date(a.finished_at).getTime() - new Date(a.started_at).getTime())
          : Number.MAX_SAFE_INTEGER;
        const bDuration = b.started_at && b.finished_at
          ? Math.max(0, new Date(b.finished_at).getTime() - new Date(b.started_at).getTime())
          : Number.MAX_SAFE_INTEGER;

        return aDuration - bDuration;
      })
      .map((session, index) => {
        const durationMs = session.started_at && session.finished_at
          ? Math.max(0, new Date(session.finished_at).getTime() - new Date(session.started_at).getTime())
          : null;

        return {
          rank: index + 1,
          user_id: session.user_id,
          user_name: session.participant_name || session.users?.display_name || session.users?.name || (session.users?.email ? String(session.users.email).split('@')[0] : 'Peserta'),
          user_province: session.participant_province || null,
          best_score: session.total_score || 0,
          is_passed: session.is_passed,
          duration_ms: durationMs,
          is_me: String(session.user_id) === String(userId),
        };
      });

    res.json({
      package_id: Number(id),
      package_name: ranking[0]?.packages?.name || sessions?.[0]?.packages?.name || '-',
      participant_count: ranking.length,
      ranking,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all packages
router.get('/', async (req, res) => {
  try {
    const { data: packages, error } = await supabase
      .from('packages')
      .select('*, categories(id, name)')
      .order('sort_order', { ascending: true })
      .order('price', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

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

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get bundle details by package ID
router.get('/:id/bundle-details', async (req, res) => {
  try {
    const { id } = req.params;
    const detail = await bundleService.getBundleDetail(id);
    res.json({
      ...detail,
      items: detail.packages,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get package by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: packageData, error } = await supabase
      .from('packages')
      .select('*, categories(id, name)')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.json({
      ...packageData,
      is_bundle:
        packageData.type === 'bundle' ||
        packageData.type === 'bundling' ||
        (Array.isArray(packageData.included_package_ids) && packageData.included_package_ids.length > 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create package (Admin only)
router.post('/', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { name, description, type, price, original_price, duration, question_count, category_id, included_package_ids, pass_score } = req.body;

    if (!name || !type || price === undefined) {
      return res.status(400).json({ error: 'Name, type, and price are required' });
    }

    const normalizedPrice = normalizeCurrencyNumber(price) || 0;
    const normalizedOriginalPrice =
      original_price !== undefined && original_price !== null && original_price !== '' && (normalizeCurrencyNumber(original_price) || 0) > normalizedPrice
        ? normalizeCurrencyNumber(original_price)
        : null;

    const payload = {
      name,
      description,
      type,
      price: normalizedPrice,
      original_price: normalizedOriginalPrice,
      duration: Math.max(1, Number(duration || 100)),
      question_count,
      category_id: category_id ? parseInt(category_id) : null,
      included_package_ids: Array.isArray(included_package_ids) ? included_package_ids : included_package_ids ? JSON.parse(included_package_ids) : [],
      pass_score: pass_score !== undefined && pass_score !== null && pass_score !== '' ? Number(pass_score) : null,
      created_at: new Date(),
    };

    const { data: newPackage, error } = await supabase.from('packages').insert([payload]).select().single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (type === 'bundle' || type === 'bundling') {
      await bundleService.createBundleLinks(newPackage.id, included_package_ids);
    }

    res.json({
      message: 'Package created successfully',
      package: newPackage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update package (Admin only)
router.put('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, price, original_price, duration, question_count, category_id, included_package_ids, pass_score } = req.body;

    const normalizedPrice = price !== undefined ? (normalizeCurrencyNumber(price) || 0) : undefined;
    const normalizedOriginalPrice =
      original_price !== undefined && original_price !== null && original_price !== '' && (normalizeCurrencyNumber(original_price) || 0) > Number(normalizedPrice ?? 0)
        ? normalizeCurrencyNumber(original_price)
        : null;

    const payload = {
      name,
      description,
      type,
      price: normalizedPrice,
      original_price: original_price !== undefined ? normalizedOriginalPrice : undefined,
      duration: duration !== undefined ? Math.max(1, Number(duration || 100)) : undefined,
      question_count,
      category_id: category_id ? parseInt(category_id) : null,
      included_package_ids: Array.isArray(included_package_ids) ? included_package_ids : included_package_ids ? JSON.parse(included_package_ids) : undefined,
      pass_score: pass_score !== undefined ? (pass_score !== null && pass_score !== '' ? Number(pass_score) : null) : undefined,
      updated_at: new Date(),
    };

    // remove undefined keys
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const { data: updatedPackage, error } = await supabase.from('packages').update(payload).eq('id', id).select().single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (Array.isArray(included_package_ids) || typeof included_package_ids === 'string') {
      if (type === 'bundle' || type === 'bundling') {
        await bundleService.createBundleLinks(updatedPackage.id, included_package_ids);
      } else {
        await bundleService.createBundleLinks(updatedPackage.id, []);
      }
    }

    res.json({
      message: 'Package updated successfully',
      package: updatedPackage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete package (Admin only)
router.delete('/:id', authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
