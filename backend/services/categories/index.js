const express = require('express');

const router = express.Router();

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

    const packages = packageRows.rows || [];
    const payload = (categoryRows.rows || []).map((category) => {
      const inCategory = packages.filter((pkg) => String(pkg.category_id) === String(category.id));
      const bundleCount = inCategory.filter((pkg) => pkg.type === 'bundle' || pkg.type === 'bundling').length;
      return {
        ...category,
        package_count: inCategory.length,
        bundle_count: bundleCount,
      };
    });

    return res.json(payload);
  } catch (err) {
    if (isMissingTableError(err)) return res.json([]);
    return next(err);
  }
});

router.get('/categories/:id/packages', async (req, res, next) => {
  try {
    const db = req.app.locals.db;
    const id = req.params.id;

    const categoryResult = await db.query('SELECT id, name, description FROM categories WHERE id=$1 LIMIT 1', [id]);
    const packageResult = await db.query(
      'SELECT * FROM packages WHERE category_id=$1 ORDER BY id ASC',
      [id]
    );

    const packages = (packageResult.rows || []).map((pkg) => ({
      ...pkg,
      is_bundle: pkg.type === 'bundle' || pkg.type === 'bundling',
    }));

    return res.json({
      category: categoryResult.rows[0] || null,
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
