const express = require('express');

const router = express.Router();
const BASE_CATEGORY_NAMES = ['CPNS', 'BUMN', 'TOEFL'];

function normalizeCategoryName(name) {
  return String(name || '').trim().toUpperCase();
}

function isBaseCategory(name) {
  return BASE_CATEGORY_NAMES.includes(normalizeCategoryName(name));
}

function isMissingTableError(err) {
  return err && (err.code === '42P01' || (err.message && err.message.toLowerCase().includes('does not exist')));
}

router.get('/categories', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const { rows } = await db.query('SELECT id, name, description, created_at FROM categories ORDER BY id ASC');
    return res.json(rows || []);
  } catch (err) {
    if (isMissingTableError(err)) return res.json([]);
    return next(err);
  }
});

router.get('/categories/with-packages', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const categoryRows = await db.query('SELECT id, name, description FROM categories ORDER BY id ASC');
    const packageRows = await db.query('SELECT id, category_id, type FROM packages');

    const categoryMap = new Map((categoryRows.rows || []).map((category) => [String(category.id), category]));
    const packages = packageRows.rows || [];

    const grouped = {
      CPNS: { package_count: 0, bundle_count: 0, description: 'Kategori persiapan CPNS' },
      BUMN: { package_count: 0, bundle_count: 0, description: 'Kategori persiapan tes BUMN' },
      TOEFL: { package_count: 0, bundle_count: 0, description: 'Kategori persiapan TOEFL' },
      OTHER: { package_count: 0, bundle_count: 0, description: 'Kategori lainnya' },
    };

    for (const pkg of packages) {
      const category = categoryMap.get(String(pkg.category_id));
      const normalized = normalizeCategoryName(category?.name);
      const groupKey = isBaseCategory(normalized) ? normalized : 'OTHER';
      grouped[groupKey].package_count += 1;
      if (pkg.type === 'bundle' || pkg.type === 'bundling') grouped[groupKey].bundle_count += 1;
    }

    for (const category of categoryRows.rows || []) {
      const normalized = normalizeCategoryName(category?.name);
      if (isBaseCategory(normalized) && category.description && !grouped[normalized].description) {
        grouped[normalized].description = category.description;
      }
    }

    const payload = [
      {
        id: 'cpns',
        name: 'CPNS',
        description: grouped.CPNS.description,
        package_count: grouped.CPNS.package_count,
        bundle_count: grouped.CPNS.bundle_count,
      },
      {
        id: 'bumn',
        name: 'BUMN',
        description: grouped.BUMN.description,
        package_count: grouped.BUMN.package_count,
        bundle_count: grouped.BUMN.bundle_count,
      },
      {
        id: 'toefl',
        name: 'TOEFL',
        description: grouped.TOEFL.description,
        package_count: grouped.TOEFL.package_count,
        bundle_count: grouped.TOEFL.bundle_count,
      },
      {
        id: 'other',
        name: 'Lainnya',
        description: grouped.OTHER.description,
        package_count: grouped.OTHER.package_count,
        bundle_count: grouped.OTHER.bundle_count,
      },
    ];

    return res.json(payload);
  } catch (err) {
    if (isMissingTableError(err)) return res.json([]);
    return next(err);
  }
});

router.get('/categories/:id/packages', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const id = String(req.params.id || '').toLowerCase();

    const categoryRows = await db.query('SELECT id, name, description FROM categories ORDER BY id ASC');

    let categoryIds = [];
    let categoryMeta = null;

    if (id === 'cpns' || id === 'bumn' || id === 'toefl') {
      const normalizedTarget = id.toUpperCase();
      categoryIds = (categoryRows.rows || [])
        .filter((category) => normalizeCategoryName(category.name) === normalizedTarget)
        .map((category) => category.id);
      categoryMeta = {
        id,
        name: normalizedTarget,
        description:
          (categoryRows.rows || []).find((category) => normalizeCategoryName(category.name) === normalizedTarget)?.description ||
          `Kategori persiapan ${normalizedTarget}`,
      };
    } else if (id === 'other') {
      categoryIds = (categoryRows.rows || [])
        .filter((category) => !isBaseCategory(category.name))
        .map((category) => category.id);
      categoryMeta = {
        id: 'other',
        name: 'Lainnya',
        description: 'Kategori lainnya',
      };
    } else {
      const categoryResult = await db.query('SELECT id, name, description FROM categories WHERE id=$1 LIMIT 1', [req.params.id]);
      categoryMeta = categoryResult.rows[0] || null;
      if (categoryMeta?.id) categoryIds = [categoryMeta.id];
    }

    let packageRows = { rows: [] };
    if (categoryIds.length > 0) {
      packageRows = await db.query(
        'SELECT * FROM packages WHERE category_id = ANY($1::int[]) ORDER BY id ASC',
        [categoryIds]
      );
    }

    const packages = (packageRows.rows || []).map((pkg) => ({
      ...pkg,
      is_bundle: pkg.type === 'bundle' || pkg.type === 'bundling',
    }));

    return res.json({
      category: categoryMeta,
      packages,
    });
  } catch (err) {
    if (isMissingTableError(err)) return res.json({ category: null, packages: [] });
    return next(err);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const db = req.app.locals.db;
    const { rows } = await db.query(
      'INSERT INTO categories (name, description) VALUES ($1,$2) RETURNING id, name, description',
      [name, description || null]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    await db.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
