BEGIN;

ALTER TABLE public.branding_settings DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON TABLE public.branding_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.branding_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.branding_settings TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.branding_settings_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.branding_settings_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.branding_settings_id_seq TO service_role;

COMMIT;
