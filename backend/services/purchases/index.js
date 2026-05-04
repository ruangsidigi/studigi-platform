const express = require('express');
const axios = require('axios');
const config = require('../../shared/config');

const router = express.Router();

const getRoleNames = (user) => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles.map((role) => String(role?.name || role?.role || '').toLowerCase()).filter(Boolean);
};

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  const roles = getRoleNames(req.user);
  const isAdmin =
    roles.includes('admin') ||
    String(req.user.role || '').toLowerCase() === 'admin' ||
    String(req.user.email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase();
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden - admin only' });
  return next();
};

const normalizeStatus = (status) => String(status || '').toLowerCase();
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const parseJsonSafe = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
};

const normalizeIdList = (raw) => {
  if (Array.isArray(raw)) {
    return raw.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
  }

  if (typeof raw === 'string') {
    const parsed = parseJsonSafe(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
    }

    return raw
      .split(',')
      .map((part) => Number(String(part).trim()))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  return [];
};

const mapMidtransStatusToPaymentStatus = (transactionStatus, fraudStatus) => {
  const normalizedTransactionStatus = normalizeStatus(transactionStatus);
  const normalizedFraudStatus = normalizeStatus(fraudStatus);

  if (normalizedTransactionStatus === 'capture') {
    if (normalizedFraudStatus === 'challenge') return 'pending';
    return 'paid';
  }

  if (normalizedTransactionStatus === 'settlement') return 'paid';
  if (normalizedTransactionStatus === 'pending') return 'pending';
  if (normalizedTransactionStatus === 'expire') return 'expired';
  if (normalizedTransactionStatus === 'cancel') return 'cancelled';
  if (['deny', 'failure'].includes(normalizedTransactionStatus)) return 'failed';

  return 'pending';
};

const mapPaymentStatusToPurchaseStatus = (status) => {
  if (['paid', 'success', 'completed', 'settlement'].includes(status)) return 'completed';
  if (['failed', 'expired', 'cancelled', 'canceled'].includes(status)) return 'failed';
  return 'pending';
};

const ensureMissingPurchasesFromTransaction = async (db, tx, paymentStatusOverride) => {
  const txId = Number(tx?.id);
  const userId = Number(tx?.user_id);
  if (!Number.isInteger(txId) || txId <= 0 || !Number.isInteger(userId) || userId <= 0) return 0;

  const meta = parseJsonSafe(tx?.metadata) || {};
  const packageIds = normalizeIdList(meta.package_ids);
  if (!packageIds.length) return 0;

  const existingResult = await db.query(
    `SELECT package_id
     FROM purchases
     WHERE payment_transaction_id = $1`,
    [txId]
  );

  const existingPackageIds = new Set(
    (existingResult.rows || [])
      .map((row) => Number(row.package_id))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  const missingPackageIds = packageIds.filter((id) => !existingPackageIds.has(id));
  if (!missingPackageIds.length) return 0;

  const paymentStatus = normalizeStatus(paymentStatusOverride || tx?.status || 'pending');
  const purchaseStatus = mapPaymentStatusToPurchaseStatus(paymentStatus);
  const totalAmount = Number(tx?.total_amount || 0);
  const perPackageAmount = packageIds.length > 0 ? roundMoney(totalAmount / packageIds.length) : 0;
  const paymentMethod = tx?.payment_method || 'midtrans';
  const paymentReference = tx?.provider_reference || null;

  let inserted = 0;
  for (const packageId of missingPackageIds) {
    const insertResult = await db.query(
      `INSERT INTO purchases
        (user_id, package_id, payment_method, payment_status, total_price, payment_transaction_id, payment_reference, created_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      [userId, packageId, paymentMethod, purchaseStatus, perPackageAmount, txId, paymentReference]
    );
    inserted += insertResult.rowCount || 0;
  }

  return inserted;
};

const getMidtransStatusEndpoint = (reference) => {
  const base = config.midtransIsProduction
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2';
  return `${base}/${encodeURIComponent(reference)}/status`;
};

const getMidtransAuthHeader = () =>
  `Basic ${Buffer.from(`${config.midtransServerKey}:`).toString('base64')}`;

const reconcilePendingMidtransPayments = async (db, userId) => {
  if (!config.midtransServerKey) return;

  const pendingTxResult = await db.query(
    `SELECT id, user_id, payment_method, provider_reference, status, total_amount, metadata
     FROM payment_transactions
     WHERE user_id = $1
       AND LOWER(COALESCE(provider, '')) = 'midtrans'
       AND LOWER(COALESCE(status, 'pending')) = 'pending'
       AND provider_reference IS NOT NULL
     ORDER BY created_at DESC NULLS LAST, id DESC
     LIMIT 5`,
    [userId]
  );

  const pendingTxRows = pendingTxResult.rows || [];
  if (!pendingTxRows.length) return;

  for (const tx of pendingTxRows) {
    const reference = String(tx.provider_reference || '').trim();
    if (!reference) continue;

    try {
      const response = await axios.get(getMidtransStatusEndpoint(reference), {
        headers: {
          Accept: 'application/json',
          Authorization: getMidtransAuthHeader(),
        },
        timeout: 10000,
      });

      const body = response?.data || {};
      const paymentStatus = mapMidtransStatusToPaymentStatus(body.transaction_status, body.fraud_status);
      const purchaseStatus = mapPaymentStatusToPurchaseStatus(paymentStatus);
      const normalizedCurrent = normalizeStatus(tx.status);
      const normalizedNext = normalizeStatus(paymentStatus);

      await db.query('BEGIN');

      if (normalizedCurrent !== normalizedNext) {
        await db.query(
          `UPDATE payment_transactions
           SET status = $1::varchar,
               paid_at = CASE WHEN $1::text IN ('paid', 'success', 'completed') THEN NOW() ELSE paid_at END,
               updated_at = NOW()
           WHERE id = $2`,
          [paymentStatus, tx.id]
        );
      }

      await ensureMissingPurchasesFromTransaction(db, tx, paymentStatus);

      await db.query(
        `UPDATE purchases
         SET payment_status = $1::varchar,
             paid_at = CASE WHEN $1::text = 'completed' THEN NOW() ELSE paid_at END
         WHERE payment_transaction_id = $2`,
        [purchaseStatus, tx.id]
      );
      await db.query('COMMIT');
    } catch (_) {
      try {
        await db.query('ROLLBACK');
      } catch (rollbackError) {
        // ignore rollback errors
      }
    }
  }

  const completedTxResult = await db.query(
    `SELECT id, user_id, payment_method, provider_reference, status, total_amount, metadata
     FROM payment_transactions
     WHERE user_id = $1
       AND LOWER(COALESCE(status, '')) = ANY($2::text[])
     ORDER BY created_at DESC NULLS LAST, id DESC
     LIMIT 10`,
    [userId, ['paid', 'completed', 'success', 'settlement']]
  );

  for (const tx of completedTxResult.rows || []) {
    const paymentStatus = normalizeStatus(tx.status || 'paid');
    const purchaseStatus = mapPaymentStatusToPurchaseStatus(paymentStatus);
    try {
      await db.query('BEGIN');
      await ensureMissingPurchasesFromTransaction(db, tx, paymentStatus);
      await db.query(
        `UPDATE purchases
         SET payment_status = $1::varchar,
             paid_at = CASE WHEN $1::text = 'completed' THEN COALESCE(paid_at, NOW()) ELSE paid_at END
         WHERE payment_transaction_id = $2`,
        [purchaseStatus, tx.id]
      );
      await db.query('COMMIT');
    } catch (_) {
      try {
        await db.query('ROLLBACK');
      } catch (rollbackError) {
        // ignore rollback errors
      }
    }
  }
};

router.get('/purchases', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Self-heal missed webhook cases: reconcile a few recent pending Midtrans payments.
    try {
      await reconcilePendingMidtransPayments(db, req.user.id);
    } catch (_) {
      // Keep purchases endpoint resilient even if reconciliation fails.
    }

    const result = await db.query(
      `SELECT p.*, pkg.id AS package_ref_id, pkg.name AS package_name, pkg.type AS package_type
       FROM purchases p
       LEFT JOIN packages pkg ON pkg.id = p.package_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC NULLS LAST, p.id DESC`,
      [req.user.id]
    );

    const rows = (result.rows || []).map((row) => ({
      ...row,
      packages: row.package_ref_id
        ? {
            id: row.package_ref_id,
            name: row.package_name,
            type: row.package_type,
          }
        : null,
    }));

    // Fail-safe: if a successful payment transaction exists but purchases rows are missing,
    // synthesize entries from payment metadata so library still shows owned packages.
    const existingPackageIds = new Set(
      rows
        .map((row) => Number(row.package_id || row.package_ref_id || row.packages?.id))
        .filter((id) => Number.isInteger(id) && id > 0)
    );

    const paidStatuses = ['paid', 'completed', 'success', 'settlement'];
    const txResult = await db.query(
      `SELECT id, payment_method, status, provider_reference, metadata, created_at
       FROM payment_transactions
       WHERE user_id = $1
         AND LOWER(COALESCE(status, '')) = ANY($2::text[])
       ORDER BY created_at DESC NULLS LAST, id DESC
       LIMIT 50`,
      [req.user.id, paidStatuses]
    );

    const fallbackFromTransactions = [];
    const pendingPackageIds = new Set();
    const txByPackageId = new Map();

    for (const tx of txResult.rows || []) {
      const txMeta = parseJsonSafe(tx.metadata) || {};
      const packageIds = normalizeIdList(txMeta.package_ids);
      for (const packageId of packageIds) {
        if (existingPackageIds.has(packageId)) continue;
        if (!txByPackageId.has(packageId)) {
          txByPackageId.set(packageId, tx);
          pendingPackageIds.add(packageId);
        }
      }
    }

    if (pendingPackageIds.size > 0) {
      const packageResult = await db.query(
        `SELECT id, name, type
         FROM packages
         WHERE id = ANY($1::bigint[])`,
        [[...pendingPackageIds]]
      );
      const packageMap = new Map((packageResult.rows || []).map((pkg) => [Number(pkg.id), pkg]));

      for (const packageId of pendingPackageIds) {
        const tx = txByPackageId.get(packageId);
        const pkg = packageMap.get(Number(packageId));
        fallbackFromTransactions.push({
          id: null,
          user_id: req.user.id,
          package_id: Number(packageId),
          payment_method: tx?.payment_method || 'midtrans',
          payment_status: mapPaymentStatusToPurchaseStatus(normalizeStatus(tx?.status || 'paid')),
          total_price: null,
          payment_transaction_id: tx?.id || null,
          payment_reference: tx?.provider_reference || null,
          created_at: tx?.created_at || null,
          package_ref_id: pkg?.id || Number(packageId),
          package_name: pkg?.name || `Paket #${packageId}`,
          package_type: pkg?.type || null,
          packages: {
            id: pkg?.id || Number(packageId),
            name: pkg?.name || `Paket #${packageId}`,
            type: pkg?.type || null,
          },
          source: 'payment_transaction_fallback',
        });
      }
    }

    return res.json([...rows, ...fallbackFromTransactions]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/purchases', requireAuth, async (req, res) => {
  return res.status(400).json({
    error: 'Direct purchase is disabled. Use POST /api/payments/checkout to start a payment transaction.',
  });
});

router.get('/purchases/admin/all', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await db.query(
      `SELECT
         p.*,
         u.id AS user_ref_id,
         COALESCE(u.display_name, u.name, u.email) AS user_name,
         u.email AS user_email,
         pkg.id AS package_ref_id,
         pkg.name AS package_name,
         pkg.type AS package_type,
         pt.id AS payment_tx_id,
         pt.provider_reference AS payment_tx_reference,
         pt.status AS payment_tx_status,
         pt.metadata AS payment_tx_metadata
       FROM purchases p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN packages pkg ON pkg.id = p.package_id
       LEFT JOIN payment_transactions pt ON pt.id = p.payment_transaction_id
       ORDER BY p.created_at DESC NULLS LAST, p.id DESC`
    );

    const rows = (result.rows || []).map((row) => {
      const termsAcceptance = row.payment_tx_metadata?.terms_acceptance || null;

      return {
        ...row,
        users: row.user_ref_id
          ? { id: row.user_ref_id, name: row.user_name, email: row.user_email }
          : null,
        packages: row.package_ref_id
          ? { id: row.package_ref_id, name: row.package_name, type: row.package_type }
          : null,
        payment_transaction: row.payment_tx_id
          ? {
              id: row.payment_tx_id,
              reference: row.payment_tx_reference,
              status: row.payment_tx_status,
              terms_acceptance: termsAcceptance
                ? {
                    accepted: termsAcceptance.accepted === true,
                    accepted_at: termsAcceptance.accepted_at || null,
                    terms_version: termsAcceptance.terms_version || null,
                    terms_file: termsAcceptance.terms_file || null,
                  }
                : null,
            }
          : null,
      };
    });

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Get attempt usage info for a specific package
router.get('/purchases/attempts/:packageId', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const packageId = Number(req.params.packageId);
    if (!Number.isInteger(packageId) || packageId <= 0) {
      return res.status(400).json({ error: 'Invalid package ID' });
    }

    const result = await db.query(
      `SELECT id, max_attempts, used_attempts
       FROM purchases
       WHERE user_id = $1 AND package_id = $2
       ORDER BY id DESC
       LIMIT 1`,
      [req.user.id, packageId]
    );

    const purchase = result.rows[0];
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const maxAttempts = purchase.max_attempts ?? 10;
    const usedAttempts = purchase.used_attempts ?? 0;
    const attemptsLeft = maxAttempts - usedAttempts;

    return res.json({ packageId, maxAttempts, usedAttempts, attemptsLeft });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
