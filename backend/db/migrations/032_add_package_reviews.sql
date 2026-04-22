-- Review/rating after tryout completion (optional: submit or skip)
CREATE TABLE IF NOT EXISTS package_reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id BIGINT NOT NULL REFERENCES tryout_sessions(id) ON DELETE CASCADE,
  package_id BIGINT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  rating SMALLINT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NULL,
  is_skipped BOOLEAN NOT NULL DEFAULT FALSE,
  is_dummy BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT package_reviews_session_user_unique UNIQUE (session_id, user_id),
  CONSTRAINT package_reviews_input_guard CHECK (
    is_skipped = TRUE OR rating IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_package_reviews_package_id ON package_reviews(package_id);
CREATE INDEX IF NOT EXISTS idx_package_reviews_session_id ON package_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_package_reviews_created_at ON package_reviews(created_at DESC);

CREATE OR REPLACE FUNCTION set_package_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_package_reviews_updated_at ON package_reviews;
CREATE TRIGGER trg_package_reviews_updated_at
BEFORE UPDATE ON package_reviews
FOR EACH ROW
EXECUTE FUNCTION set_package_reviews_updated_at();
