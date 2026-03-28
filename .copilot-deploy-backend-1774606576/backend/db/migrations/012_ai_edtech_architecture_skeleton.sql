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
