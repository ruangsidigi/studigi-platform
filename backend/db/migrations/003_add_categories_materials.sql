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
