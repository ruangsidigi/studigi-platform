const express = require('express');
const crypto = require('crypto');
const midtransClient = require('midtrans-client');
const config = require('../../shared/config');

const router = express.Router();

const getRoleNames = (user) => {
  if (!user || !Array.isArray(user.roles)) return [];
  return user.roles.map((role) => String(role?.name || role?.role || '').toLowerCase()).filter(Boolean);
};

const isAdmin = (user) => {
  if (!user) return false;
  const roles = getRoleNames(user);
  return (
    roles.includes('admin') ||
    String(user.role || '').toLowerCase() === 'admin' ||
    String(user.email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase()
  );
};

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizePackageIds = (packageIds) => {
  if (!Array.isArray(packageIds)) return [];
  return [...new Set(packageIds.map((item) => Number(item)).filter((id) => Number.isInteger(id) && id > 0))];
};

const normalizeStatus = (status) => String(status || '').toLowerCase();

const mapPaymentStatusToPurchaseStatus = (status) => {
  if (['paid', 'success', 'completed'].includes(status)) return 'completed';
  if (['failed', 'expired', 'cancelled', 'canceled'].includes(status)) return 'failed';
  return 'pending';
};

const createPaymentReference = () => `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

let snapClient;
const getSnapClient = () => {
  if (!config.midtransServerKey) return null;
  if (snapClient) return snapClient;

  snapClient = new midtransClient.Snap({
    isProduction: Boolean(config.midtransIsProduction),
    serverKey: config.midtransServerKey,
    clientKey: config.midtransClientKey || undefined,
  });

  return snapClient;
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

const getMidtransSignature = ({ orderId, statusCode, grossAmount }) =>
  crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${config.midtransServerKey}`)
    .digest('hex');

const getPaymentCallbackUrls = () => {
  const frontendBaseUrl = String(config.frontendUrl || '').replace(/\/$/, '');
  if (!frontendBaseUrl) return {};

  return {
    finish: `${frontendBaseUrl}/dashboard?payment=success`,
    error: `${frontendBaseUrl}/dashboard?payment=failed`,
    pending: `${frontendBaseUrl}/dashboard?payment=pending`,
  };
};

let paymentSchemaReady = false;
const ensurePaymentSchema = async (db) => {
  if (paymentSchemaReady) return;

  await db.query(
    `CREATE TABLE IF NOT EXISTS payment_transactions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payment_method VARCHAR(50) NOT NULL DEFAULT 'manual_transfer',
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
      subtotal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      provider VARCHAR(50),
      provider_reference VARCHAR(120) UNIQUE,
      expires_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );

  await db.query(
    `ALTER TABLE purchases
      ADD COLUMN IF NOT EXISTS payment_transaction_id BIGINT REFERENCES payment_transactions(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(120),
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`
  );

  await db.query('CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON payment_transactions(provider_reference)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_purchases_payment_transaction_id ON purchases(payment_transaction_id)');

  paymentSchemaReady = true;
};

router.post('/payments/checkout', requireAuth, async (req, res) => {
  const db = req.app.locals.db;

  try {
    const snap = getSnapClient();
    if (!snap) {
      return res.status(500).json({
        error: 'Midtrans belum dikonfigurasi. Set MIDTRANS_SERVER_KEY terlebih dahulu.',
      });
    }

    await ensurePaymentSchema(db);
    const {
      packageIds,
      paymentMethod = 'midtrans',
      currency = 'IDR',
      termsAccepted = false,
      termsAcceptedAt = null,
      termsVersion = 'unknown',
    } = req.body || {};
    const normalizedPackageIds = normalizePackageIds(packageIds);

    if (termsAccepted !== true) {
      return res.status(400).json({ error: 'Syarat & ketentuan harus disetujui sebelum checkout' });
    }

    const acceptedAtDate = termsAcceptedAt ? new Date(termsAcceptedAt) : new Date();
    const acceptedAtIso = Number.isNaN(acceptedAtDate.getTime())
      ? new Date().toISOString()
      : acceptedAtDate.toISOString();

    if (normalizedPackageIds.length === 0) {
      return res.status(400).json({ error: 'Package IDs array is required' });
    }

    const packageResult = await db.query(
      `SELECT id, name, price
       FROM packages
       WHERE id = ANY($1::bigint[])
       ORDER BY id ASC`,
      [normalizedPackageIds]
    );

    const packageRows = packageResult.rows || [];
    if (packageRows.length !== normalizedPackageIds.length) {
      return res.status(400).json({ error: 'One or more packages not found' });
    }

    const subtotalAmount = roundMoney(packageRows.reduce((sum, item) => sum + Number(item.price || 0), 0));
    const discountAmount = normalizedPackageIds.length > 2 ? roundMoney(subtotalAmount * 0.1) : 0;
    const totalAmount = roundMoney(subtotalAmount - discountAmount);
    const perPackageAmount = normalizedPackageIds.length > 0 ? roundMoney(totalAmount / normalizedPackageIds.length) : 0;
    const paymentReference = createPaymentReference();

    const customerName = String(req.user.display_name || req.user.name || req.user.email || 'User').trim() || 'User';
    const grossAmount = Math.max(1, Math.round(totalAmount));
    const callbackUrls = getPaymentCallbackUrls();

    await db.query('BEGIN');

    const transactionResult = await db.query(
      `INSERT INTO payment_transactions
        (user_id, payment_method, status, currency, subtotal_amount, discount_amount, total_amount, provider, provider_reference, expires_at, metadata, created_at, updated_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '24 hours', $10, NOW(), NOW())
       RETURNING *`,
      [
        req.user.id,
        paymentMethod,
        'pending',
        String(currency || 'IDR').toUpperCase(),
        subtotalAmount,
        discountAmount,
        totalAmount,
        'midtrans',
        paymentReference,
        JSON.stringify({
          package_ids: normalizedPackageIds,
          terms_acceptance: {
            accepted: true,
            accepted_at: acceptedAtIso,
            terms_version: String(termsVersion || 'unknown'),
            terms_file: '/terms-and-conditions.pdf',
          },
        }),
      ]
    );

    const transaction = transactionResult.rows[0];

    const insertedPurchases = [];
    for (const packageId of normalizedPackageIds) {
      const purchaseResult = await db.query(
        `INSERT INTO purchases
          (user_id, package_id, payment_method, payment_status, total_price, payment_transaction_id, payment_reference, created_at)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [req.user.id, packageId, paymentMethod, 'pending', perPackageAmount, transaction.id, paymentReference]
      );
      if (purchaseResult.rows[0]) insertedPurchases.push(purchaseResult.rows[0]);
    }

    const itemDetails = [
      {
        id: `checkout-${transaction.id}`,
        name: `Pembelian Paket (${normalizedPackageIds.length} item)`,
        quantity: 1,
        price: grossAmount,
      },
    ];

    const transactionPayload = {
      transaction_details: {
        order_id: paymentReference,
        gross_amount: grossAmount,
      },
      customer_details: {
        first_name: customerName,
        email: req.user.email,
      },
      item_details: itemDetails,
      callbacks: callbackUrls,
      metadata: {
        payment_transaction_id: transaction.id,
        user_id: req.user.id,
      },
    };

    const snapResponse = await snap.createTransaction(transactionPayload);

    await db.query(
      `UPDATE payment_transactions
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify({
          snap_token: snapResponse?.token || null,
          payment_url: snapResponse?.redirect_url || null,
        }),
        transaction.id,
      ]
    );

    await db.query('COMMIT');

    return res.status(201).json({
      message: 'Checkout created',
      payment: {
        id: transaction.id,
        reference: transaction.provider_reference,
        status: transaction.status,
        payment_method: transaction.payment_method,
        subtotal_amount: Number(transaction.subtotal_amount || 0),
        discount_amount: Number(transaction.discount_amount || 0),
        total_amount: Number(transaction.total_amount || 0),
        currency: transaction.currency,
        expires_at: transaction.expires_at,
        snap_token: snapResponse?.token || null,
        payment_url: snapResponse?.redirect_url || null,
      },
      purchases: insertedPurchases,
    });
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch (_) {}
    return res.status(500).json({ error: error.message });
  }
});

router.get('/payments/:id', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    await ensurePaymentSchema(db);
    const paymentId = Number(req.params.id);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({ error: 'Invalid payment id' });
    }

    const paymentResult = await db.query(
      `SELECT *
       FROM payment_transactions
       WHERE id = $1
       LIMIT 1`,
      [paymentId]
    );

    const payment = paymentResult.rows[0];
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (!isAdmin(req.user) && Number(payment.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const purchaseResult = await db.query(
      `SELECT p.*, pkg.name AS package_name
       FROM purchases p
       LEFT JOIN packages pkg ON pkg.id = p.package_id
       WHERE p.payment_transaction_id = $1
       ORDER BY p.id ASC`,
      [paymentId]
    );

    return res.json({
      payment,
      purchases: purchaseResult.rows || [],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/payments/:id/confirm', requireAuth, async (req, res) => {
  const db = req.app.locals.db;

  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Forbidden - admin only' });
    }

    await ensurePaymentSchema(db);
    const paymentId = Number(req.params.id);
    const requestedStatus = normalizeStatus(req.body?.status || 'paid');
    const nextStatus = ['paid', 'failed', 'cancelled', 'expired'].includes(requestedStatus) ? requestedStatus : 'paid';

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({ error: 'Invalid payment id' });
    }

    await db.query('BEGIN');

    const paymentResult = await db.query(
      `SELECT *
       FROM payment_transactions
       WHERE id = $1
       FOR UPDATE`,
      [paymentId]
    );

    const payment = paymentResult.rows[0];
    if (!payment) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const currentStatus = normalizeStatus(payment.status);
    if (['paid', 'success', 'completed'].includes(currentStatus)) {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment already paid' });
    }

    const purchaseStatus = mapPaymentStatusToPurchaseStatus(nextStatus);

    const updatedPaymentResult = await db.query(
      `UPDATE payment_transactions
       SET status = $1,
           paid_at = CASE WHEN $1 IN ('paid', 'success', 'completed') THEN NOW() ELSE paid_at END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [nextStatus, paymentId]
    );

    await db.query(
      `UPDATE purchases
       SET payment_status = $1,
           paid_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE paid_at END
       WHERE payment_transaction_id = $2`,
      [purchaseStatus, paymentId]
    );

    await db.query('COMMIT');

    return res.json({
      message: purchaseStatus === 'completed' ? 'Payment confirmed' : 'Payment updated',
      payment: updatedPaymentResult.rows[0],
      purchase_status: purchaseStatus,
    });
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch (_) {}
    return res.status(500).json({ error: error.message });
  }
});

router.post('/payments/webhook', async (req, res) => {
  const db = req.app.locals.db;

  try {
    if (!config.midtransServerKey) {
      return res.status(500).json({ error: 'Midtrans is not configured' });
    }

    await ensurePaymentSchema(db);
    const reference = String(req.body?.order_id || '').trim();
    const transactionStatus = String(req.body?.transaction_status || '').trim();
    const fraudStatus = String(req.body?.fraud_status || '').trim();
    const statusCode = String(req.body?.status_code || '').trim();
    const grossAmount = String(req.body?.gross_amount || '').trim();
    const signatureKey = String(req.body?.signature_key || '').trim().toLowerCase();

    if (!reference || !transactionStatus || !statusCode || !grossAmount || !signatureKey) {
      return res.status(400).json({ error: 'Invalid Midtrans notification payload' });
    }

    const expectedSignature = getMidtransSignature({
      orderId: reference,
      statusCode,
      grossAmount,
    });

    if (signatureKey !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid Midtrans signature' });
    }

    const rawStatus = mapMidtransStatusToPaymentStatus(transactionStatus, fraudStatus);
    const purchaseStatus = mapPaymentStatusToPurchaseStatus(rawStatus);

    await db.query('BEGIN');

    const paymentResult = await db.query(
      `UPDATE payment_transactions
       SET status = $1,
           paid_at = CASE WHEN $1 IN ('paid', 'success', 'completed') THEN NOW() ELSE paid_at END,
           updated_at = NOW()
       WHERE provider_reference = $2
       RETURNING *`,
      [rawStatus, reference]
    );

    const payment = paymentResult.rows[0];
    if (!payment) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    await db.query(
      `UPDATE purchases
       SET payment_status = $1,
           paid_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE paid_at END
       WHERE payment_transaction_id = $2`,
      [purchaseStatus, payment.id]
    );

    await db.query('COMMIT');

    return res.status(200).json({ message: 'Webhook processed', payment_id: payment.id });
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch (_) {}
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
