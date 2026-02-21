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
