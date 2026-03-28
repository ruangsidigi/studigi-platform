-- Migration: Add content type and visibility to packages table
-- Date: 2026-02-19

BEGIN;

-- Add columns if they don't exist
ALTER TABLE packages
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) DEFAULT 'question' CONSTRAINT check_content_type CHECK (content_type IN ('question', 'material')),
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'visible' CONSTRAINT check_visibility CHECK (visibility IN ('visible', 'hidden')),
ADD COLUMN IF NOT EXISTS pdf_file_path TEXT;

-- Update existing rows to have default values
UPDATE packages SET content_type = 'question', visibility = 'visible' WHERE content_type IS NULL;

-- Create index for faster dashboard queries
CREATE INDEX IF NOT EXISTS idx_packages_visibility ON packages(visibility);
CREATE INDEX IF NOT EXISTS idx_packages_content_type ON packages(content_type);

-- Create directories comment (for documentation)
COMMENT ON COLUMN packages.content_type IS 'Type of package: question (Excel import) or material (PDF upload)';
COMMENT ON COLUMN packages.visibility IS 'Visibility: visible (show in dashboard) or hidden (archive only)';
COMMENT ON COLUMN packages.pdf_file_path IS 'Path to PDF file for material type packages';

COMMIT;
