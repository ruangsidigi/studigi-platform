-- Combined migrations for Supabase SQL Editor
-- Generated on 2026-02-21T16:44:34.3141859+07:00


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\migrations\001_initial.sql

-- 001_initial.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create user_roles using same type as users.id to avoid FK type mismatch
DO $$
DECLARE uid_type TEXT;
BEGIN
  -- use udt_name to get the underlying type (uuid, int8, etc.)
  SELECT udt_name INTO uid_type FROM information_schema.columns
    WHERE table_name='users' AND column_name='id' LIMIT 1;
  IF uid_type IS NULL THEN
    uid_type := 'uuid';
  ELSIF uid_type = 'int8' THEN
    uid_type := 'bigint';
  ELSIF uid_type = 'int4' THEN
    uid_type := 'integer';
  ELSIF uid_type = 'varchar' THEN
    uid_type := 'text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_roles') THEN
    EXECUTE format(
      'CREATE TABLE user_roles (user_id %s REFERENCES users(id) ON DELETE CASCADE, role_id UUID REFERENCES roles(id) ON DELETE CASCADE, PRIMARY KEY (user_id, role_id))',
      uid_type
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'IDR',
  type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'IDR',
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create bundle_packages using underlying types of bundles.id and packages.id
DO $$
DECLARE b_type TEXT; p_type TEXT; b_sql TEXT;
BEGIN
  SELECT udt_name INTO b_type FROM information_schema.columns WHERE table_name='bundles' AND column_name='id' LIMIT 1;
  SELECT udt_name INTO p_type FROM information_schema.columns WHERE table_name='packages' AND column_name='id' LIMIT 1;
  IF b_type IS NULL THEN b_type := 'uuid'; ELSIF b_type='int8' THEN b_type:='bigint'; ELSIF b_type='int4' THEN b_type:='integer'; ELSIF b_type='varchar' THEN b_type:='text'; END IF;
  IF p_type IS NULL THEN p_type := 'uuid'; ELSIF p_type='int8' THEN p_type:='bigint'; ELSIF p_type='int4' THEN p_type:='integer'; ELSIF p_type='varchar' THEN p_type:='text'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='bundle_packages') THEN
    b_sql := format('CREATE TABLE bundle_packages (bundle_id %s REFERENCES bundles(id) ON DELETE CASCADE, package_id %s REFERENCES packages(id) ON DELETE CASCADE, PRIMARY KEY (bundle_id, package_id))', b_type, p_type);
    EXECUTE b_sql;
  END IF;
END$$;

-- Create materials; ensure created_by column matches users.id type
DO $$
DECLARE uid_type TEXT;
BEGIN
  SELECT udt_name INTO uid_type FROM information_schema.columns
    WHERE table_name='users' AND column_name='id' LIMIT 1;
  IF uid_type IS NULL THEN
    uid_type := 'uuid';
  ELSIF uid_type = 'int8' THEN
    uid_type := 'bigint';
  ELSIF uid_type = 'int4' THEN
    uid_type := 'integer';
  ELSIF uid_type = 'varchar' THEN
    uid_type := 'text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='materials') THEN
    EXECUTE format(
      'CREATE TABLE materials (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), title TEXT NOT NULL, storage_key TEXT NOT NULL, storage_bucket TEXT, mime_type TEXT, size_bytes BIGINT, published BOOLEAN DEFAULT FALSE, created_by %s REFERENCES users(id), created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), deleted_at TIMESTAMP WITH TIME ZONE, metadata JSONB)',
      uid_type
    );
  END IF;
END$$;

-- Create bundle_materials using underlying types of bundles.id and materials.id
DO $$
DECLARE b_type TEXT; m_type TEXT; bm_sql TEXT;
BEGIN
  SELECT udt_name INTO b_type FROM information_schema.columns WHERE table_name='bundles' AND column_name='id' LIMIT 1;
  SELECT udt_name INTO m_type FROM information_schema.columns WHERE table_name='materials' AND column_name='id' LIMIT 1;
  IF b_type IS NULL THEN b_type := 'uuid'; ELSIF b_type='int8' THEN b_type:='bigint'; ELSIF b_type='int4' THEN b_type:='integer'; ELSIF b_type='varchar' THEN b_type:='text'; END IF;
  IF m_type IS NULL THEN m_type := 'uuid'; ELSIF m_type='int8' THEN m_type:='bigint'; ELSIF m_type='int4' THEN m_type:='integer'; ELSIF m_type='varchar' THEN m_type:='text'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='bundle_materials') THEN
    bm_sql := format('CREATE TABLE bundle_materials (bundle_id %s REFERENCES bundles(id) ON DELETE CASCADE, material_id %s REFERENCES materials(id) ON DELETE CASCADE, PRIMARY KEY (bundle_id, material_id))', b_type, m_type);
    EXECUTE bm_sql;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content JSONB,
  targeting JSONB,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS branding_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  logo_key TEXT,
  header_color TEXT DEFAULT '#0b5fff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create purchases; ensure user_id matches users.id type
DO $$
DECLARE uid_type TEXT;
BEGIN
  SELECT udt_name INTO uid_type FROM information_schema.columns
    WHERE table_name='users' AND column_name='id' LIMIT 1;
  IF uid_type IS NULL THEN
    uid_type := 'uuid';
  ELSIF uid_type = 'int8' THEN
    uid_type := 'bigint';
  ELSIF uid_type = 'int4' THEN
    uid_type := 'integer';
  ELSIF uid_type = 'varchar' THEN
    uid_type := 'text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='purchases') THEN
    EXECUTE format(
      'CREATE TABLE purchases (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id %s REFERENCES users(id), bundle_id UUID REFERENCES bundles(id), price_cents INTEGER, currency TEXT, status TEXT, payment_ref TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT now())',
      uid_type
    );
  END IF;
END$$;

-- Create audit_logs; actor_id should match users.id type when possible
DO $$
DECLARE uid_type TEXT;
BEGIN
  SELECT udt_name INTO uid_type FROM information_schema.columns
    WHERE table_name='users' AND column_name='id' LIMIT 1;
  IF uid_type IS NULL THEN
    uid_type := 'uuid';
  ELSIF uid_type = 'int8' THEN
    uid_type := 'bigint';
  ELSIF uid_type = 'int4' THEN
    uid_type := 'integer';
  ELSIF uid_type = 'varchar' THEN
    uid_type := 'text';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='audit_logs') THEN
    EXECUTE format(
      'CREATE TABLE audit_logs (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), actor_id %s, action TEXT NOT NULL, resource_type TEXT, resource_id UUID, before JSONB, after JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT now())',
      uid_type
    );
  END IF;
END$$;

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\migrations\002_auth_seed.sql

-- 002_auth_seed.sql
BEGIN;

INSERT INTO roles (id, name, description)
VALUES
  (uuid_generate_v4(), 'admin', 'Administrator with full access'),
  (uuid_generate_v4(), 'participant', 'End user participant')
ON CONFLICT (name) DO NOTHING;

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\003_add_categories_materials.sql

-- Add categories and materials tables, and package fields for category and bundling
BEGIN;

-- categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- materials table (PDFs, resources)
CREATE TABLE IF NOT EXISTS public.materials (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text,
  category_id integer REFERENCES public.categories(id) ON DELETE SET NULL,
  package_id integer REFERENCES public.packages(id) ON DELETE SET NULL,
  file_path text,
  file_url text,
  created_at timestamptz DEFAULT now()
);

-- add category_id and included_package_ids to packages
ALTER TABLE IF EXISTS public.packages
  ADD COLUMN IF NOT EXISTS category_id integer REFERENCES public.categories(id),
  ADD COLUMN IF NOT EXISTS included_package_ids jsonb;

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\004_retention_system.sql

-- Retention System Schema
-- Apply this migration in Supabase SQL editor

CREATE TABLE IF NOT EXISTS user_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_score INTEGER DEFAULT 500,
  current_score DECIMAL DEFAULT 0,
  completion_percent DECIMAL DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  passed_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS user_streaks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS user_xp (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  xp_to_next_level INTEGER DEFAULT 100,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS user_badges (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_code VARCHAR(100) NOT NULL,
  badge_name VARCHAR(255) NOT NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(user_id, badge_code)
);

CREATE TABLE IF NOT EXISTS topic_mastery (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_name VARCHAR(100) NOT NULL,
  attempts_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  accuracy_percent DECIMAL DEFAULT 0,
  mastery_level VARCHAR(20) DEFAULT 'beginner',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, topic_name)
);

CREATE TABLE IF NOT EXISTS analytics_summary (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id BIGINT REFERENCES tryout_sessions(id) ON DELETE SET NULL,
  average_score DECIMAL DEFAULT 0,
  trend_score DECIMAL DEFAULT 0,
  pass_rate DECIMAL DEFAULT 0,
  strongest_topic VARCHAR(100),
  weakest_topic VARCHAR(100),
  prediction_pass_probability DECIMAL DEFAULT 0,
  snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_recommendations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_name VARCHAR(100) NOT NULL,
  priority INTEGER DEFAULT 3,
  recommendation_text TEXT NOT NULL,
  source VARCHAR(50) DEFAULT 'engine',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_user_id ON user_xp(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_user_topic ON topic_mastery(user_id, topic_name);
CREATE INDEX IF NOT EXISTS idx_analytics_summary_user_created ON analytics_summary(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_recommendations_user_active ON study_recommendations(user_id, is_active);


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\005_event_log.sql

-- Event log table for event-driven architecture

CREATE TABLE IF NOT EXISTS event_log (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  aggregate_id VARCHAR(100),
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'processed',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_log_type_created ON event_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_aggregate ON event_log(aggregate_id);


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\006_bundle_packages.sql


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\007_backfill_bundle_packages.sql

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


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\008_question_bookmarks.sql

-- Question Bookmarks Table
-- Allows users to bookmark specific questions from attempt reviews

CREATE TABLE IF NOT EXISTS question_bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id BIGINT REFERENCES tryout_sessions(id) ON DELETE CASCADE,
  notes TEXT,
  bookmarked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, question_id, session_id)
);

-- Index for faster queries
CREATE INDEX idx_question_bookmarks_user_id ON question_bookmarks(user_id);
CREATE INDEX idx_question_bookmarks_session_id ON question_bookmarks(session_id);
CREATE INDEX idx_question_bookmarks_question_id ON question_bookmarks(question_id);


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\009_add_content_visibility.sql

-- Migration: Add content type and visibility to packages table
-- Date: 2026-02-19

BEGIN;

-- Add columns if they don't exist
ALTER TABLE packages
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) DEFAULT 'question' CONSTRAINT check_content_type CHECK (content_type IN ('question', 'material')),
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'visible' CONSTRAINT check_visibility CHECK (visibility IN ('visible', 'hidden')),
ADD COLUMN IF NOT EXISTS pdf_file_path TEXT;

-- Update existing rows to have default values
UPDATE packages SET content_type = 'question', visibility = 'visible' WHERE content_type IS NULL;

-- Create index for faster dashboard queries
CREATE INDEX IF NOT EXISTS idx_packages_visibility ON packages(visibility);
CREATE INDEX IF NOT EXISTS idx_packages_content_type ON packages(content_type);

-- Create directories comment (for documentation)
COMMENT ON COLUMN packages.content_type IS 'Type of package: question (Excel import) or material (PDF upload)';
COMMENT ON COLUMN packages.visibility IS 'Visibility: visible (show in dashboard) or hidden (archive only)';
COMMENT ON COLUMN packages.pdf_file_path IS 'Path to PDF file for material type packages';

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\010_cms_management_system.sql

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


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\011_adaptive_learning.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_skills (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  skill_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  accuracy NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_time_ms INTEGER NOT NULL DEFAULT 0,
  total_answered INTEGER NOT NULL DEFAULT 0,
  last_difficulty TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, topic)
);

CREATE TABLE IF NOT EXISTS public.learning_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id BIGINT,
  topic TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_spent_ms INTEGER NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  source TEXT NOT NULL DEFAULT 'adaptive_quiz',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recommendations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT,
  recommendation_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.topic_performance (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  total_answered INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  accuracy NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_time_ms INTEGER NOT NULL DEFAULT 0,
  skill_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  weakness_level TEXT NOT NULL DEFAULT 'medium',
  recommended_difficulty TEXT NOT NULL DEFAULT 'medium',
  last_seen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, topic)
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON public.user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_topic ON public.user_skills(topic);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_id ON public.learning_events(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_topic ON public.learning_events(topic);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON public.recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON public.recommendations(status);
CREATE INDEX IF NOT EXISTS idx_topic_performance_user_id ON public.topic_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_performance_topic ON public.topic_performance(topic);

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\012_ai_edtech_architecture_skeleton.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.learning_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attempt_id BIGINT,
  question_id BIGINT,
  topic TEXT NOT NULL,
  event_name TEXT NOT NULL DEFAULT 'question_attempt',
  is_correct BOOLEAN,
  score NUMERIC(8,2),
  time_spent_ms INTEGER,
  progress_percent NUMERIC(5,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS attempt_id BIGINT;
ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS question_id BIGINT;
ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS event_name TEXT DEFAULT 'question_attempt';
ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS is_correct BOOLEAN;
ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS score NUMERIC(8,2);
ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS time_spent_ms INTEGER;
ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5,2);
ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.user_skills (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  skill_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  accuracy NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_time_ms INTEGER NOT NULL DEFAULT 0,
  total_answered INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, topic)
);

ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS skill_score NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS accuracy NUMERIC(5,4) NOT NULL DEFAULT 0;
ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS avg_time_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS total_answered INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.recommendations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT,
  recommendation_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS recommendation_type TEXT;
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_attempt_id BIGINT,
  source_type TEXT NOT NULL DEFAULT 'tryout',
  total_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  event_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.analytics ADD COLUMN IF NOT EXISTS attempt_id BIGINT;
ALTER TABLE public.analytics ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.analytics ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE public.analytics ADD COLUMN IF NOT EXISTS metric_name TEXT;
ALTER TABLE public.analytics ADD COLUMN IF NOT EXISTS metric_value NUMERIC(12,2);
ALTER TABLE public.analytics ADD COLUMN IF NOT EXISTS payload JSONB;

CREATE INDEX IF NOT EXISTS idx_learning_events_user_id ON public.learning_events(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_topic ON public.learning_events(topic);
CREATE INDEX IF NOT EXISTS idx_learning_events_attempt_id ON public.learning_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON public.user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id_status ON public.recommendations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_metric_name ON public.analytics(metric_name);

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\013_silicon_valley_platform.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.learning_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'attempt_submitted',
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attempt_id BIGINT,
  content_id TEXT,
  topic TEXT,
  score NUMERIC(8,2),
  time_spent_ms INTEGER,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'attempt_submitted';
ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS content_id TEXT;
ALTER TABLE public.learning_events ADD COLUMN IF NOT EXISTS payload JSONB;

CREATE TABLE IF NOT EXISTS public.feature_store (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  feature_value NUMERIC(12,4),
  feature_vector JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_type, entity_id, feature_name)
);

CREATE TABLE IF NOT EXISTS public.user_skills (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  skill_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  accuracy NUMERIC(5,4) NOT NULL DEFAULT 0,
  avg_time_ms INTEGER NOT NULL DEFAULT 0,
  total_answered INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, topic)
);

ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.recommendations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT,
  recommendation_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  score NUMERIC(6,2),
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recommendations ADD COLUMN IF NOT EXISTS score NUMERIC(6,2);

CREATE INDEX IF NOT EXISTS idx_learning_events_type ON public.learning_events(event_type);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_type ON public.learning_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_feature_store_entity ON public.feature_store(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_topic ON public.user_skills(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_status ON public.recommendations(user_id, status);

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\014_event_log_table.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.event_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id BIGINT,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'processed',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_log_event_type ON public.event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_status ON public.event_log(status);
CREATE INDEX IF NOT EXISTS idx_event_log_created_at ON public.event_log(created_at DESC);

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\015_material_management.sql

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


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\016_branding_settings.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.branding_settings (
  id BIGSERIAL PRIMARY KEY,
  logo_url TEXT,
  logo_path TEXT,
  header_color TEXT NOT NULL DEFAULT '#1d7a7a',
  button_color TEXT NOT NULL DEFAULT '#007bff',
  line_color TEXT NOT NULL DEFAULT '#dddddd',
  updated_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.branding_settings DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.branding_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.branding_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.branding_settings TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.branding_settings_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.branding_settings_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.branding_settings_id_seq TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_branding_settings_singleton ON public.branding_settings ((1));

INSERT INTO public.branding_settings (header_color)
SELECT '#1d7a7a'
WHERE NOT EXISTS (SELECT 1 FROM public.branding_settings);

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\017_branding_settings_rls_fix.sql

BEGIN;

ALTER TABLE public.branding_settings DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.branding_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.branding_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.branding_settings TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.branding_settings_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.branding_settings_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.branding_settings_id_seq TO service_role;

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\018_branding_theme_colors.sql

BEGIN;

ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS button_color TEXT NOT NULL DEFAULT '#007bff',
  ADD COLUMN IF NOT EXISTS line_color TEXT NOT NULL DEFAULT '#dddddd';

UPDATE public.branding_settings
SET button_color = COALESCE(NULLIF(button_color, ''), '#007bff'),
    line_color = COALESCE(NULLIF(line_color, ''), '#dddddd')
WHERE true;

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\019_smart_campaign_engine.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.campaigns (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cta_text TEXT,
  target_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_assets (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  asset_url TEXT NOT NULL,
  asset_path TEXT,
  asset_type TEXT NOT NULL DEFAULT 'banner',
  mime_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_campaign_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id BIGINT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  trigger_source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_behavior_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status_schedule ON public.campaigns(status, start_at, end_at, priority DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_campaign_id ON public.campaign_assets(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_campaign_logs_user_time ON public.user_campaign_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_campaign_logs_campaign_type ON public.user_campaign_logs(campaign_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_user_time ON public.user_behavior_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_type_time ON public.user_behavior_events(event_type, created_at DESC);

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\020_campaign_seed_examples.sql

BEGIN;

INSERT INTO public.campaigns (
  name,
  title,
  description,
  cta_text,
  target_url,
  status,
  rules,
  priority,
  start_at,
  end_at,
  created_at,
  updated_at
)
SELECT
  'seed-new-user-welcome',
  'Selamat Datang! Diskon Paket Perdana',
  'Khusus pengguna baru: klaim promo paket latihan pertama Anda.',
  'Klaim Promo',
  'https://example.com/promo/new-user',
  'active',
  '{"all":[{"field":"segments","op":"includes","value":"new_user"}]}'::jsonb,
  300,
  NULL,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaigns WHERE name = 'seed-new-user-welcome'
);

INSERT INTO public.campaigns (
  name,
  title,
  description,
  cta_text,
  target_url,
  status,
  rules,
  priority,
  start_at,
  end_at,
  created_at,
  updated_at
)
SELECT
  'seed-paying-user-upsell',
  'Upgrade ke Bundling Hemat',
  'Rekomendasi bundling untuk peserta aktif dengan histori pembelian.',
  'Lihat Bundling',
  'https://example.com/upsell/bundling',
  'active',
  '{"all":[{"field":"segments","op":"includes","value":"paying_user"}]}'::jsonb,
  250,
  NULL,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaigns WHERE name = 'seed-paying-user-upsell'
);

INSERT INTO public.campaigns (
  name,
  title,
  description,
  cta_text,
  target_url,
  status,
  rules,
  priority,
  start_at,
  end_at,
  created_at,
  updated_at
)
SELECT
  'seed-inactive-comeback',
  'Ayo Kembali Belajar ðŸŽ¯',
  'Kami siapkan tryout cepat 15 menit untuk memulai ulang progress Anda.',
  'Mulai Tryout Cepat',
  'https://example.com/comeback/quick-tryout',
  'active',
  '{"all":[{"field":"segments","op":"includes","value":"inactive"}]}'::jsonb,
  200,
  NULL,
  NULL,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaigns WHERE name = 'seed-inactive-comeback'
);

COMMIT;


-- FILE: C:\Users\ACER\tryout-skd-cpns\backend\db\migrations\021_campaign_seed_assets.sql

BEGIN;

INSERT INTO public.campaign_assets (
  campaign_id,
  asset_url,
  asset_path,
  asset_type,
  mime_type,
  file_size,
  created_at
)
SELECT
  c.id,
  'https://dummyimage.com/1200x420/0f766e/ffffff&text=Welcome+Promo+New+User',
  NULL,
  'banner',
  'image/png',
  NULL,
  now()
FROM public.campaigns c
WHERE c.name = 'seed-new-user-welcome'
  AND NOT EXISTS (
    SELECT 1
    FROM public.campaign_assets a
    WHERE a.campaign_id = c.id
      AND a.asset_type = 'banner'
  );

INSERT INTO public.campaign_assets (
  campaign_id,
  asset_url,
  asset_path,
  asset_type,
  mime_type,
  file_size,
  created_at
)
SELECT
  c.id,
  'https://dummyimage.com/1200x420/7c3aed/ffffff&text=Bundling+Upsell+for+Paying+Users',
  NULL,
  'banner',
  'image/png',
  NULL,
  now()
FROM public.campaigns c
WHERE c.name = 'seed-paying-user-upsell'
  AND NOT EXISTS (
    SELECT 1
    FROM public.campaign_assets a
    WHERE a.campaign_id = c.id
      AND a.asset_type = 'banner'
  );

INSERT INTO public.campaign_assets (
  campaign_id,
  asset_url,
  asset_path,
  asset_type,
  mime_type,
  file_size,
  created_at
)
SELECT
  c.id,
  'https://dummyimage.com/1200x420/ea580c/ffffff&text=Comeback+Campaign+Quick+Tryout',
  NULL,
  'banner',
  'image/png',
  NULL,
  now()
FROM public.campaigns c
WHERE c.name = 'seed-inactive-comeback'
  AND NOT EXISTS (
    SELECT 1
    FROM public.campaign_assets a
    WHERE a.campaign_id = c.id
      AND a.asset_type = 'banner'
  );

COMMIT;

