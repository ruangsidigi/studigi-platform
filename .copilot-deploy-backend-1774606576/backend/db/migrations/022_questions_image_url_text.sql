-- Ensure question image URL can store long data URLs safely
-- This fixes truncated/corrupted image rendering when storing base64 data URI.

ALTER TABLE IF EXISTS questions
  ALTER COLUMN image_url TYPE TEXT;
