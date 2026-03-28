BEGIN;

ALTER TABLE public.branding_settings
  ADD COLUMN IF NOT EXISTS button_color TEXT NOT NULL DEFAULT '#007bff',
  ADD COLUMN IF NOT EXISTS line_color TEXT NOT NULL DEFAULT '#dddddd';

UPDATE public.branding_settings
SET button_color = COALESCE(NULLIF(button_color, ''), '#007bff'),
    line_color = COALESCE(NULLIF(line_color, ''), '#dddddd')
WHERE true;

COMMIT;
