const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '..', '.env'), override: false });

const emailArg = String(process.argv[2] || '').trim().toLowerCase();
const packageNameArg = String(process.argv[3] || '').trim();
const forceGrantFlag = process.argv.slice(4).some((arg) => String(arg || '').trim().toLowerCase() === '--force-grant');
const userEmail = emailArg || 'ghinakhairiya.work@gmail.com';
const preferredPackageName = packageNameArg || 'TRYOUT 1 SKD CPNS (HOTS)';

const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const MIDTRANS_IS_PRODUCTION = String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase() === 'true';

if (!DATABASE_URL) {
  console.error('DATABASE_URL or PG_CONNECTION_STRING is required');
  process.exit(1);
}

const normalizeStatus = (status) => String(status || '').toLowerCase();

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
  if (['paid', 'success', 'completed', 'settlement'].includes(normalizeStatus(status))) return 'completed';
  if (['failed', 'expired', 'cancelled', 'canceled', 'deny', 'failure'].includes(normalizeStatus(status))) return 'failed';
  return 'pending';
};

const getMidtransStatusUrl = (reference) => {
  const base = MIDTRANS_IS_PRODUCTION ? 'https://api.midtrans.com/v2' : 'https://api.sandbox.midtrans.com/v2';
  return `${base}/${encodeURIComponent(reference)}/status`;
};

const getMidtransAuthHeader = () =>
  `Basic ${Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64')}`;

const getMidtransSignature = ({ orderId, statusCode, grossAmount }) =>
  crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${MIDTRANS_SERVER_KEY}`)
    .digest('hex');

const verifyMidtransPayload = (payload) => {
  const signatureKey = String(payload?.signature_key || '').trim().toLowerCase();
  const orderId = String(payload?.order_id || '').trim();
  const statusCode = String(payload?.status_code || '').trim();
  const grossAmount = String(payload?.gross_amount || '').trim();
  if (!signatureKey || !orderId || !statusCode || !grossAmount) return false;
  const expected = getMidtransSignature({ orderId, statusCode, grossAmount });
  return signatureKey === expected;
};

async function main() {
  const db = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const userResult = await db.query(
      `SELECT id, email, COALESCE(display_name, name, email) AS name
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [userEmail]
    );

    const user = userResult.rows[0];
    if (!user) {
      throw new Error(`User not found for email: ${userEmail}`);
    }

    const transactionResult = await db.query(
      `SELECT id, provider_reference, provider, status, total_amount, created_at
       FROM payment_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC NULLS LAST, id DESC`,
      [user.id]
    );

    const transactions = transactionResult.rows || [];
    let txUpdated = 0;
    let purchaseUpdated = 0;
    const touchedTxIds = new Set();

    for (const tx of transactions) {
      const txId = Number(tx.id);
      const reference = String(tx.provider_reference || '').trim();
      const provider = normalizeStatus(tx.provider);
      let nextPaymentStatus = normalizeStatus(tx.status || 'pending') || 'pending';

      if (provider === 'midtrans' && reference && MIDTRANS_SERVER_KEY) {
        try {
          const response = await axios.get(getMidtransStatusUrl(reference), {
            headers: {
              Accept: 'application/json',
              Authorization: getMidtransAuthHeader(),
            },
            timeout: 15000,
          });

          const payload = response?.data || {};
          if (verifyMidtransPayload(payload)) {
            nextPaymentStatus = mapMidtransStatusToPaymentStatus(payload.transaction_status, payload.fraud_status);
          }
        } catch (_) {
          // Keep current status when Midtrans status check fails.
        }
      }

      const currentStatus = normalizeStatus(tx.status || 'pending');
      const nextPurchaseStatus = mapPaymentStatusToPurchaseStatus(nextPaymentStatus);

      await db.query('BEGIN');
      try {
        if (currentStatus !== nextPaymentStatus) {
          const txUpdate = await db.query(
            `UPDATE payment_transactions
             SET status = $1::varchar,
                 paid_at = CASE WHEN $1::text IN ('paid', 'success', 'completed') THEN NOW() ELSE paid_at END,
                 updated_at = NOW()
             WHERE id = $2`,
            [nextPaymentStatus, txId]
          );
          txUpdated += txUpdate.rowCount || 0;
        }

        const purchaseUpdate = await db.query(
          `UPDATE purchases
           SET payment_status = $1::varchar,
               paid_at = CASE WHEN $1::text = 'completed' THEN NOW() ELSE paid_at END
           WHERE payment_transaction_id = $2
             AND LOWER(COALESCE(payment_status, 'pending')) <> $1::text`,
          [nextPurchaseStatus, txId]
        );
        purchaseUpdated += purchaseUpdate.rowCount || 0;

        await db.query('COMMIT');
        touchedTxIds.add(txId);
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    }

    // Safety fallback: if there's at least one successful/paid transaction, ensure preferred package is completed.
    const paidTxResult = await db.query(
      `SELECT id
       FROM payment_transactions
       WHERE user_id = $1
         AND LOWER(COALESCE(status, '')) = ANY($2::text[])
       ORDER BY created_at DESC NULLS LAST, id DESC
       LIMIT 1`,
      [user.id, ['paid', 'completed', 'success', 'settlement']]
    );

    const paidTx = paidTxResult.rows[0];
    if (paidTx) {
      const packageResult = await db.query(
        `SELECT id, name
         FROM packages
         WHERE LOWER(name) = LOWER($1)
         LIMIT 1`,
        [preferredPackageName]
      );

      const pkg = packageResult.rows[0];
      if (pkg) {
        const existingPurchaseResult = await db.query(
          `SELECT id, payment_status
           FROM purchases
           WHERE user_id = $1 AND package_id = $2
           ORDER BY created_at DESC NULLS LAST, id DESC
           LIMIT 1`,
          [user.id, pkg.id]
        );

        const existingPurchase = existingPurchaseResult.rows[0];
        if (existingPurchase) {
          if (normalizeStatus(existingPurchase.payment_status) !== 'completed') {
            const upd = await db.query(
              `UPDATE purchases
               SET payment_status = 'completed',
                   paid_at = COALESCE(paid_at, NOW()),
                   payment_transaction_id = COALESCE(payment_transaction_id, $2)
               WHERE id = $1`,
              [existingPurchase.id, paidTx.id]
            );
            purchaseUpdated += upd.rowCount || 0;
          }
        }
      }
    }

    // Optional admin fallback: grant package access when transaction/purchase data is missing.
    if (forceGrantFlag) {
      const packageResult = await db.query(
        `SELECT id, name, price
         FROM packages
         WHERE LOWER(name) = LOWER($1)
         LIMIT 1`,
        [preferredPackageName]
      );
      const pkg = packageResult.rows[0];

      if (pkg) {
        const existingCompleted = await db.query(
          `SELECT id
           FROM purchases
           WHERE user_id = $1
             AND package_id = $2
             AND LOWER(COALESCE(payment_status, '')) = 'completed'
           LIMIT 1`,
          [user.id, pkg.id]
        );

        if (!existingCompleted.rows[0]) {
          const inserted = await db.query(
            `INSERT INTO purchases
               (user_id, package_id, payment_method, payment_status, total_price, created_at)
             VALUES
               ($1, $2, 'midtrans', 'completed', $3, NOW())
             RETURNING id`,
            [user.id, pkg.id, Number(pkg.price || 0)]
          );
          purchaseUpdated += inserted.rowCount || 0;

          try {
            await db.query(
              `UPDATE purchases SET paid_at = NOW() WHERE id = $1`,
              [inserted.rows[0]?.id]
            );
          } catch (_) {
            // Ignore when paid_at column doesn't exist in older schema.
          }
        }
      }
    }

    const finalResult = await db.query(
      `SELECT p.id, p.package_id, pkg.name AS package_name, p.payment_status, p.payment_transaction_id, p.created_at
       FROM purchases p
       LEFT JOIN packages pkg ON pkg.id = p.package_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC NULLS LAST, p.id DESC`,
      [user.id]
    );

    const completed = (finalResult.rows || []).filter(
      (row) => normalizeStatus(row.payment_status) === 'completed'
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          requested_package: preferredPackageName,
          force_grant: forceGrantFlag,
          transactions_checked: transactions.length,
          transactions_updated: txUpdated,
          purchases_updated: purchaseUpdated,
          completed_packages: completed.map((row) => ({
            purchase_id: row.id,
            package_id: row.package_id,
            package_name: row.package_name,
            payment_status: row.payment_status,
            payment_transaction_id: row.payment_transaction_id,
          })),
          touched_transaction_ids: [...touchedTxIds],
        },
        null,
        2
      )
    );
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error('fix_user_library_access failed:', error.message);
  process.exit(1);
});
