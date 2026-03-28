-- Event log table for event-driven architecture

CREATE TABLE IF NOT EXISTS event_log (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  aggregate_id VARCHAR(100),
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'processed',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_log_type_created ON event_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_aggregate ON event_log(aggregate_id);
