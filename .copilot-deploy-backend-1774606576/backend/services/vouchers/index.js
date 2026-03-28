const express = require('express');

const router = express.Router();

// --- Auth helpers (mirrors pattern used in other services) ---

const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  return next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.id) return res.status(401).json({ error: 'Access token required' });
  const role = String(req.user.role || '').toLowerCase();
  const email = String(req.user.email || '').toLowerCase();
  const adminEmail = String(process.env.ADMIN_EMAIL || 'admin@skdcpns.com').toLowerCase();
  if (role !== 'admin' && email !== adminEmail) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
};

// --- Voucher schema bootstrap ---

let voucherSchemaReady = false;
const ensureVoucherSchema = async (db) => {
  if (voucherSchemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id            BIGSERIAL PRIMARY KEY,
      code          VARCHAR(50) UNIQUE NOT NULL,
      description   TEXT,
      discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage'
                      CHECK (discount_type IN ('percentage', 'fixed')),
      discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
      min_purchase   NUMERIC(12,2) NOT NULL DEFAULT 0,
      max_discount   NUMERIC(12,2),
      max_uses       INTEGER,
      used_count     INTEGER NOT NULL DEFAULT 0,
      valid_from     TIMESTAMPTZ,
      valid_until    TIMESTAMPTZ,
      is_active      BOOLEAN NOT NULL DEFAULT true,
      created_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS voucher_usages (
      id                     BIGSERIAL PRIMARY KEY,
      voucher_id             BIGINT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
      user_id                BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payment_transaction_id BIGINT REFERENCES payment_transactions(id) ON DELETE SET NULL,
      discount_applied       NUMERIC(12,2) NOT NULL,
      used_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Attempt to add voucher columns to payment_transactions (may already exist)
  try {
    await db.query(`ALTER TABLE payment_transactions
      ADD COLUMN IF NOT EXISTS voucher_id   BIGINT REFERENCES vouchers(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS voucher_code VARCHAR(50)`);
  } catch (_) { /* column exists or payment_transactions not yet created */ }
  voucherSchemaReady = true;
};

// --- Business logic helper ---

/**
 * Validate a voucher code against a subtotal amount.
 * Returns { valid, error, voucher, discountAmount } but does NOT mutate the DB.
 * Pass `userId` (optional) to check per-user one-time restriction in future.
 */
const validateVoucherCode = async (db, code, subtotal) => {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return { valid: false, error: 'Kode voucher tidak boleh kosong' };

  const result = await db.query(
    `SELECT * FROM vouchers WHERE code = $1`,
    [normalized]
  );
  if (result.rowCount === 0) return { valid: false, error: 'Kode voucher tidak ditemukan' };

  const v = result.rows[0];

  if (!v.is_active) return { valid: false, error: 'Kode voucher sudah tidak aktif' };

  const now = new Date();
  if (v.valid_from && new Date(v.valid_from) > now) {
    return { valid: false, error: 'Kode voucher belum berlaku' };
  }
  if (v.valid_until && new Date(v.valid_until) < now) {
    return { valid: false, error: 'Kode voucher sudah kadaluarsa' };
  }

  if (v.max_uses !== null && v.used_count >= Number(v.max_uses)) {
    return { valid: false, error: 'Kuota kode voucher sudah habis' };
  }

  const sub = Number(subtotal || 0);
  if (sub < Number(v.min_purchase || 0)) {
    return {
      valid: false,
      error: `Minimum pembelian Rp ${Number(v.min_purchase).toLocaleString('id-ID')} untuk menggunakan voucher ini`,
    };
  }

  let discountAmount = 0;
  if (v.discount_type === 'percentage') {
    discountAmount = sub * (Number(v.discount_value) / 100);
    if (v.max_discount !== null) discountAmount = Math.min(discountAmount, Number(v.max_discount));
  } else {
    // fixed
    discountAmount = Math.min(Number(v.discount_value), sub);
  }
  discountAmount = Math.round((discountAmount + Number.EPSILON) * 100) / 100;

  return { valid: true, voucher: v, discountAmount };
};

// ─────────────────────────────────────────────
// Public endpoint: validate a voucher (returns discount preview)
// POST /api/vouchers/validate
// Body: { code, subtotal }
// ─────────────────────────────────────────────
router.post('/vouchers/validate', requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    await ensureVoucherSchema(db);
    const { code, subtotal } = req.body || {};
    const sub = Number(subtotal || 0);
    const result = await validateVoucherCode(db, code, sub);
    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.error });
    }
    const { voucher: v, discountAmount } = result;
    return res.json({
      valid: true,
      code: v.code,
      description: v.description,
      discountType: v.discount_type,
      discountValue: Number(v.discount_value),
      discountAmount,
      finalAmount: Math.max(0, sub - discountAmount),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal memvalidasi voucher' });
  }
});

// ─────────────────────────────────────────────
// Admin: list all vouchers
// GET /api/vouchers
// ─────────────────────────────────────────────
router.get('/vouchers', requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  try {
    await ensureVoucherSchema(db);
    const result = await db.query(
      `SELECT v.*,
              COALESCE(u.name, u.email) AS created_by_name
       FROM vouchers v
       LEFT JOIN users u ON u.id = v.created_by
       ORDER BY v.created_at DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal memuat daftar voucher' });
  }
});

// ─────────────────────────────────────────────
// Admin: create voucher
// POST /api/vouchers
// Body: { code, description, discount_type, discount_value, min_purchase, max_discount, max_uses, valid_from, valid_until }
// ─────────────────────────────────────────────
router.post('/vouchers', requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  try {
    await ensureVoucherSchema(db);
    const {
      code,
      description = '',
      discount_type = 'percentage',
      discount_value,
      min_purchase = 0,
      max_discount = null,
      max_uses = null,
      valid_from = null,
      valid_until = null,
      is_active = true,
    } = req.body || {};

    if (!code || !String(code).trim()) {
      return res.status(400).json({ error: 'Kode voucher wajib diisi' });
    }
    if (!discount_value || Number(discount_value) <= 0) {
      return res.status(400).json({ error: 'Nilai diskon wajib diisi dan > 0' });
    }
    if (!['percentage', 'fixed'].includes(discount_type)) {
      return res.status(400).json({ error: 'Tipe diskon harus percentage atau fixed' });
    }
    if (discount_type === 'percentage' && Number(discount_value) > 100) {
      return res.status(400).json({ error: 'Diskon persentase tidak boleh melebihi 100%' });
    }

    const normalizedCode = String(code).trim().toUpperCase();

    const result = await db.query(
      `INSERT INTO vouchers
         (code, description, discount_type, discount_value, min_purchase, max_discount,
          max_uses, valid_from, valid_until, is_active, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
       RETURNING *`,
      [
        normalizedCode,
        description || null,
        discount_type,
        Number(discount_value),
        Number(min_purchase || 0),
        max_discount ? Number(max_discount) : null,
        max_uses ? Number(max_uses) : null,
        valid_from || null,
        valid_until || null,
        is_active !== false,
        req.user.id,
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Kode voucher sudah digunakan oleh voucher lain' });
    }
    return res.status(500).json({ error: err.message || 'Gagal membuat voucher' });
  }
});

// ─────────────────────────────────────────────
// Admin: update voucher
// PUT /api/vouchers/:id
// ─────────────────────────────────────────────
router.put('/vouchers/:id', requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  try {
    await ensureVoucherSchema(db);
    const voucherId = Number(req.params.id);
    if (!Number.isInteger(voucherId) || voucherId <= 0) {
      return res.status(400).json({ error: 'ID voucher tidak valid' });
    }

    const existing = await db.query('SELECT id FROM vouchers WHERE id = $1', [voucherId]);
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Voucher tidak ditemukan' });

    const {
      code,
      description,
      discount_type,
      discount_value,
      min_purchase,
      max_discount,
      max_uses,
      valid_from,
      valid_until,
      is_active,
    } = req.body || {};

    if (discount_type && !['percentage', 'fixed'].includes(discount_type)) {
      return res.status(400).json({ error: 'Tipe diskon harus percentage atau fixed' });
    }
    if (discount_type === 'percentage' && discount_value && Number(discount_value) > 100) {
      return res.status(400).json({ error: 'Diskon persentase tidak boleh melebihi 100%' });
    }

    const result = await db.query(
      `UPDATE vouchers SET
         code           = COALESCE($1, code),
         description    = COALESCE($2, description),
         discount_type  = COALESCE($3, discount_type),
         discount_value = COALESCE($4, discount_value),
         min_purchase   = COALESCE($5, min_purchase),
         max_discount   = $6,
         max_uses       = $7,
         valid_from     = $8,
         valid_until    = $9,
         is_active      = COALESCE($10, is_active),
         updated_at     = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        code ? String(code).trim().toUpperCase() : null,
        description !== undefined ? (description || null) : null,
        discount_type || null,
        discount_value ? Number(discount_value) : null,
        min_purchase !== undefined ? Number(min_purchase || 0) : null,
        max_discount !== undefined ? (max_discount ? Number(max_discount) : null) : undefined,
        max_uses !== undefined ? (max_uses ? Number(max_uses) : null) : undefined,
        valid_from !== undefined ? (valid_from || null) : undefined,
        valid_until !== undefined ? (valid_until || null) : undefined,
        is_active !== undefined ? Boolean(is_active) : null,
        voucherId,
      ]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Kode voucher sudah digunakan oleh voucher lain' });
    }
    return res.status(500).json({ error: err.message || 'Gagal memperbarui voucher' });
  }
});

// ─────────────────────────────────────────────
// Admin: delete (deactivate) voucher
// DELETE /api/vouchers/:id
// ─────────────────────────────────────────────
router.delete('/vouchers/:id', requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  try {
    await ensureVoucherSchema(db);
    const voucherId = Number(req.params.id);
    if (!Number.isInteger(voucherId) || voucherId <= 0) {
      return res.status(400).json({ error: 'ID voucher tidak valid' });
    }

    // Soft-delete: deactivate instead of hard delete to preserve usage history
    const result = await db.query(
      `UPDATE vouchers SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, code`,
      [voucherId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Voucher tidak ditemukan' });

    return res.json({ message: 'Voucher dinonaktifkan', voucher: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal menghapus voucher' });
  }
});

// ─────────────────────────────────────────────
// Admin: usage history for a specific voucher
// GET /api/vouchers/:id/usages
// ─────────────────────────────────────────────
router.get('/vouchers/:id/usages', requireAdmin, async (req, res) => {
  const db = req.app.locals.db;
  try {
    await ensureVoucherSchema(db);
    const voucherId = Number(req.params.id);
    if (!Number.isInteger(voucherId) || voucherId <= 0) {
      return res.status(400).json({ error: 'ID voucher tidak valid' });
    }
    const result = await db.query(
      `SELECT vu.*,
              COALESCE(u.name, u.email) AS user_name,
              u.email AS user_email
       FROM voucher_usages vu
       LEFT JOIN users u ON u.id = vu.user_id
       WHERE vu.voucher_id = $1
       ORDER BY vu.used_at DESC`,
      [voucherId]
    );
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Gagal memuat riwayat penggunaan' });
  }
});

module.exports = router;
module.exports.validateVoucherCode = validateVoucherCode;
module.exports.ensureVoucherSchema = ensureVoucherSchema;
