BEGIN;

CREATE TABLE IF NOT EXISTS public.event_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id BIGINT,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'processed',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_log_event_type ON public.event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_status ON public.event_log(status);
CREATE INDEX IF NOT EXISTS idx_event_log_created_at ON public.event_log(created_at DESC);

COMMIT;
