-- Backfill bundle_packages from packages.included_package_ids
BEGIN;

INSERT INTO public.bundle_packages (bundle_id, package_id)
SELECT
  p.id AS bundle_id,
  (value)::BIGINT AS package_id
FROM public.packages p,
LATERAL jsonb_array_elements_text(COALESCE(p.included_package_ids, '[]'::jsonb)) AS value
WHERE (p.type = 'bundle' OR p.type = 'bundling')
ON CONFLICT (bundle_id, package_id) DO NOTHING;

COMMIT;
