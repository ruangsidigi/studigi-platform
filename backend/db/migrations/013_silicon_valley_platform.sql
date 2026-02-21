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
