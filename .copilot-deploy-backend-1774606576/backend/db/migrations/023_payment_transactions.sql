BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
);

ALTER TABLE IF EXISTS public.purchases
  ADD COLUMN IF NOT EXISTS payment_transaction_id BIGINT REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(120),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference ON public.payment_transactions(provider_reference);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_transaction_id ON public.purchases(payment_transaction_id);

COMMIT;
