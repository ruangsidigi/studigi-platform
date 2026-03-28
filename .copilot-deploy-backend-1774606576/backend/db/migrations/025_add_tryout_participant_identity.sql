-- Add participant identity columns used for ranking metadata captured before tryout starts
ALTER TABLE tryout_sessions
  ADD COLUMN IF NOT EXISTS participant_name VARCHAR(120);

ALTER TABLE tryout_sessions
  ADD COLUMN IF NOT EXISTS participant_province VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_tryout_sessions_package_province_status
  ON tryout_sessions(package_id, participant_province, status);
