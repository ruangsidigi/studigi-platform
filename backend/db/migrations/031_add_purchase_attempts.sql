BEGIN;

-- Add attempt tracking columns to purchases table
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS used_attempts INTEGER NOT NULL DEFAULT 0;

-- Ensure used_attempts never exceeds max_attempts (skip if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'purchases'
      AND constraint_name = 'chk_used_attempts_not_exceed_max'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT chk_used_attempts_not_exceed_max
        CHECK (used_attempts >= 0 AND used_attempts <= max_attempts);
  END IF;
END$$;

COMMIT;
