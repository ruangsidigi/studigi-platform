-- Voucher / promo code system
BEGIN;

CREATE TABLE IF NOT EXISTS vouchers (
  id           BIGSERIAL PRIMARY KEY,
  code         VARCHAR(50) UNIQUE NOT NULL,
  description  TEXT,
  -- 'percentage' = discount_value is 0-100 percent
  -- 'fixed'      = discount_value is a fixed IDR amount
  discount_type  VARCHAR(20) NOT NULL DEFAULT 'percentage'
                   CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  min_purchase   NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- cap the discount for percentage type (NULL = no cap)
  max_discount   NUMERIC(12,2),
  max_uses       INTEGER,          -- NULL = unlimited
  used_count     INTEGER NOT NULL DEFAULT 0,
  valid_from     TIMESTAMPTZ,
  valid_until    TIMESTAMPTZ,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track every individual usage for audit / fraud detection
CREATE TABLE IF NOT EXISTS voucher_usages (
  id                     BIGSERIAL PRIMARY KEY,
  voucher_id             BIGINT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  user_id                BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_transaction_id BIGINT REFERENCES payment_transactions(id) ON DELETE SET NULL,
  discount_applied       NUMERIC(12,2) NOT NULL,
  used_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link payment_transactions to the voucher (if any) used
ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS voucher_id   BIGINT REFERENCES vouchers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voucher_code VARCHAR(50);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_code       ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_is_active  ON vouchers(is_active);
CREATE INDEX IF NOT EXISTS idx_voucher_usages_user ON voucher_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_voucher_usages_txn  ON voucher_usages(payment_transaction_id);

COMMIT;
