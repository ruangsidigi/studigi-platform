-- Bundle packages mapping (many-to-many)
BEGIN;

CREATE TABLE IF NOT EXISTS public.bundle_packages (
  id BIGSERIAL PRIMARY KEY,
  bundle_id BIGINT NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  package_id BIGINT NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (bundle_id, package_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_packages_bundle_id ON public.bundle_packages(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_packages_package_id ON public.bundle_packages(package_id);

COMMIT;
