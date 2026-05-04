const express = require('express');
const { reconcileLibraryAccess } = require('../../shared/libraryReconciliation');

const router = express.Router();

const isCronRequest = (req) => {
  const cronHeader = String(req.headers['x-vercel-cron'] || '').trim();
  const userAgent = String(req.headers['user-agent'] || '').toLowerCase();
  return cronHeader === '1' || userAgent.includes('vercel-cron');
};

router.get('/ops/reconcile-library', async (req, res) => {
  try {
    // Allow scheduled Vercel Cron by header; allow manual run with token if needed.
    const tokenFromQuery = String(req.query?.token || '').trim();
    const tokenFromHeader = String(req.headers['x-reconcile-token'] || '').trim();
    const expectedToken = String(process.env.RECONCILE_JOB_TOKEN || '').trim();

    const hasValidToken = expectedToken && (tokenFromQuery === expectedToken || tokenFromHeader === expectedToken);
    if (!isCronRequest(req) && !hasValidToken) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const requestedLimit = Number(req.query?.limit || process.env.RECONCILE_LIBRARY_LIMIT || 500);
    const txLimit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : 500;

    const db = req.app.locals.db;
    const summary = await reconcileLibraryAccess({ db, txLimit });

    return res.json({
      ok: true,
      source: isCronRequest(req) ? 'vercel-cron' : 'manual-token',
      ...summary,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to reconcile library access' });
  }
});

module.exports = router;
