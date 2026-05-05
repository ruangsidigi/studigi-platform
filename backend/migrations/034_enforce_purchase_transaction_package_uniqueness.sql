-- Prevent duplicate library rows for the same payment transaction and package.
-- This keeps one best row (prefer completed/paid) and removes extra duplicates first.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY payment_transaction_id, package_id
      ORDER BY
        CASE WHEN LOWER(COALESCE(payment_status, '')) = 'completed' THEN 0 ELSE 1 END,
        paid_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM public.purchases
  WHERE payment_transaction_id IS NOT NULL
),
to_delete AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
)
DELETE FROM public.purchases p
USING to_delete d
WHERE p.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_unique_tx_package
  ON public.purchases(payment_transaction_id, package_id)
  WHERE payment_transaction_id IS NOT NULL;
