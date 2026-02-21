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
  'Ayo Kembali Belajar 🎯',
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
