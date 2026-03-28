-- Migration: add sort_order to packages
ALTER TABLE packages
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;