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
