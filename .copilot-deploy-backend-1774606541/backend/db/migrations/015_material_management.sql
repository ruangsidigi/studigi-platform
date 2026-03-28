BEGIN;

CREATE TABLE IF NOT EXISTS public.package_materials (
  id BIGSERIAL PRIMARY KEY,
  package_id BIGINT NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  material_id BIGINT NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(package_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_package_materials_package_id ON public.package_materials(package_id);
CREATE INDEX IF NOT EXISTS idx_package_materials_material_id ON public.package_materials(material_id);

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS uploaded_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL;

INSERT INTO public.package_materials (package_id, material_id)
SELECT m.package_id, m.id
FROM public.materials m
LEFT JOIN public.package_materials pm
  ON pm.package_id = m.package_id
 AND pm.material_id = m.id
WHERE m.package_id IS NOT NULL
  AND pm.id IS NULL;

COMMIT;
