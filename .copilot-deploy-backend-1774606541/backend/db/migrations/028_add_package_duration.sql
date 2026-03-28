-- Add configurable duration (minutes) for each package
BEGIN;

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 100;

UPDATE packages
SET duration = 100
WHERE duration IS NULL OR duration <= 0;

COMMIT;
