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
