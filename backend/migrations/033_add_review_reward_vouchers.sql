BEGIN;

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS issued_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reward_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_vouchers_issued_to_user_id ON vouchers(issued_to_user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_reward_source ON vouchers(reward_source);

CREATE TABLE IF NOT EXISTS review_reward_configs (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(120) NOT NULL DEFAULT 'Reward Review & Testimoni',
  description TEXT,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage'
    CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  min_purchase NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_discount NUMERIC(12,2),
  expires_in_days INTEGER NOT NULL DEFAULT 7 CHECK (expires_in_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_reward_claims (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id BIGINT NOT NULL REFERENCES tryout_sessions(id) ON DELETE CASCADE,
  review_id BIGINT NOT NULL REFERENCES package_reviews(id) ON DELETE CASCADE,
  package_id BIGINT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  voucher_id BIGINT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT review_reward_claims_session_user_unique UNIQUE (session_id, user_id),
  CONSTRAINT review_reward_claims_review_unique UNIQUE (review_id),
  CONSTRAINT review_reward_claims_voucher_unique UNIQUE (voucher_id)
);

CREATE INDEX IF NOT EXISTS idx_review_reward_claims_user_id ON review_reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_review_reward_claims_voucher_id ON review_reward_claims(voucher_id);

INSERT INTO review_reward_configs (
  title,
  description,
  discount_type,
  discount_value,
  min_purchase,
  max_discount,
  expires_in_days,
  is_active
)
SELECT
  'Reward Review & Testimoni',
  'Voucher reward otomatis setelah peserta mengirim rating dan testimoni.',
  'percentage',
  10,
  15000,
  10000,
  7,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM review_reward_configs
);

COMMIT;
