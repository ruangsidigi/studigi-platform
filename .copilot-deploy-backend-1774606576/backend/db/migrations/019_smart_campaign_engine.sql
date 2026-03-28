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
