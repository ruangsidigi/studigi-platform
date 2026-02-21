BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.programs (
  id BIGSERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.modules (
  id BIGSERIAL PRIMARY KEY,
  program_id BIGINT NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type_enum') THEN
    CREATE TYPE public.content_type_enum AS ENUM ('pdf_material', 'quiz', 'tryout');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_status_enum') THEN
    CREATE TYPE public.content_status_enum AS ENUM ('draft', 'review', 'published', 'archived');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id BIGINT NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  content_type public.content_type_enum NOT NULL,
  status public.content_status_enum NOT NULL DEFAULT 'draft',
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  reviewer_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE(module_id, title)
);

CREATE TABLE IF NOT EXISTS public.content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_path TEXT,
  file_url TEXT,
  payload JSONB,
  change_note TEXT,
  uploaded_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(content_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.bundles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.bundle_items (
  id BIGSERIAL PRIMARY KEY,
  bundle_id BIGINT NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bundle_id, content_id)
);

CREATE TABLE IF NOT EXISTS public.analytics (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  content_id UUID REFERENCES public.contents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'progress', 'completion')),
  progress_percent NUMERIC(5,2),
  session_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_roles (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_permissions (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_role_permissions (
  role_id BIGINT NOT NULL REFERENCES public.cms_roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES public.cms_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.cms_user_roles (
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES public.cms_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_programs_category_id ON public.programs(category_id);
CREATE INDEX IF NOT EXISTS idx_modules_program_id ON public.modules(program_id);
CREATE INDEX IF NOT EXISTS idx_contents_module_id ON public.contents(module_id);
CREATE INDEX IF NOT EXISTS idx_contents_status ON public.contents(status);
CREATE INDEX IF NOT EXISTS idx_contents_type ON public.contents(content_type);
CREATE INDEX IF NOT EXISTS idx_content_versions_content_id ON public.content_versions(content_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_id ON public.bundle_items(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_items_content_id ON public.bundle_items(content_id);
CREATE INDEX IF NOT EXISTS idx_analytics_content_id ON public.analytics(content_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON public.analytics(event_type);

INSERT INTO public.categories(name, description)
VALUES
  ('CPNS', 'Kategori persiapan CPNS'),
  ('BUMN', 'Kategori persiapan tes BUMN'),
  ('UTBK', 'Kategori persiapan UTBK')
ON CONFLICT DO NOTHING;

INSERT INTO public.cms_roles(code, name)
VALUES
  ('admin', 'Admin'),
  ('content_manager', 'Content Manager'),
  ('reviewer', 'Reviewer')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.cms_permissions(code, name)
VALUES
  ('upload', 'Upload Content'),
  ('approve', 'Approve Content'),
  ('publish', 'Publish Content'),
  ('archive', 'Archive Content')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.cms_role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM public.cms_roles r
JOIN public.cms_permissions p ON (
  (r.code = 'admin')
  OR (r.code = 'content_manager' AND p.code = 'upload')
  OR (r.code = 'reviewer' AND p.code IN ('approve', 'publish', 'archive'))
)
ON CONFLICT DO NOTHING;

COMMIT;
