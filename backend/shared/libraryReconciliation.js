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

const mapPaymentStatusToPurchaseStatus = (status) => {
  const normalized = normalizeStatus(status);
  if (['paid', 'success', 'completed', 'settlement'].includes(normalized)) return 'completed';
  if (['failed', 'expired', 'cancelled', 'canceled'].includes(normalized)) return 'failed';
  return 'pending';
};

const ensurePurchasesForTransaction = async (db, tx) => {
  const txId = Number(tx?.id);
  const userId = Number(tx?.user_id);
  if (!Number.isInteger(txId) || txId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return 0;
  }

  const meta = parseJsonSafe(tx?.metadata) || {};
  const packageIds = normalizeIdList(meta.package_ids);
  if (!packageIds.length) return 0;

  const existingResult = await db.query(
    `SELECT package_id
     FROM purchases
     WHERE payment_transaction_id = $1`,
    [txId]
  );

  const existing = new Set(
    (existingResult.rows || [])
      .map((row) => Number(row.package_id))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  const missingIds = packageIds.filter((id) => !existing.has(id));
  if (!missingIds.length) return 0;

  const paymentStatus = normalizeStatus(tx.status || 'pending');
  const purchaseStatus = mapPaymentStatusToPurchaseStatus(paymentStatus);
  const totalAmount = Number(tx.total_amount || 0);
  const perPackageAmount = packageIds.length > 0 ? roundMoney(totalAmount / packageIds.length) : 0;
  const paymentMethod = tx.payment_method || 'midtrans';
  const paymentReference = tx.provider_reference || null;

  let inserted = 0;
  for (const packageId of missingIds) {
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

const reconcileLibraryAccess = async ({ db, txLimit = 300, userId = null }) => {
  const paidStatuses = ['paid', 'completed', 'success', 'settlement'];
  const normalizedLimit = Number.isInteger(Number(txLimit)) && Number(txLimit) > 0 ? Number(txLimit) : 300;

  const whereUser = userId ? 'AND user_id = $3' : '';
  const params = userId ? [paidStatuses, normalizedLimit, Number(userId)] : [paidStatuses, normalizedLimit];

  const txResult = await db.query(
    `SELECT id, user_id, payment_method, provider_reference, status, total_amount, metadata
     FROM payment_transactions
     WHERE LOWER(COALESCE(status, '')) = ANY($1::text[])
     ${whereUser}
     ORDER BY created_at DESC NULLS LAST, id DESC
     LIMIT $2`,
    params
  );

  const txRows = txResult.rows || [];
  let insertedPurchases = 0;
  let updatedPurchases = 0;

  for (const tx of txRows) {
    await db.query('BEGIN');
    try {
      insertedPurchases += await ensurePurchasesForTransaction(db, tx);

      const purchaseStatus = mapPaymentStatusToPurchaseStatus(tx.status);
      const updateResult = await db.query(
        `UPDATE purchases
         SET payment_status = $1::varchar,
             paid_at = CASE WHEN $1::text = 'completed' THEN COALESCE(paid_at, NOW()) ELSE paid_at END
         WHERE payment_transaction_id = $2
           AND LOWER(COALESCE(payment_status, 'pending')) <> $1::text`,
        [purchaseStatus, tx.id]
      );
      updatedPurchases += updateResult.rowCount || 0;

      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  return {
    tx_scanned: txRows.length,
    purchases_inserted: insertedPurchases,
    purchases_updated: updatedPurchases,
    scanned_limit: normalizedLimit,
    user_id: userId ? Number(userId) : null,
  };
};

module.exports = {
  reconcileLibraryAccess,
};
