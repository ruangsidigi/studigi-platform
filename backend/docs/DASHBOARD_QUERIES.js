/**
 * Dashboard Query Updates
 * Shows how to filter packages by visibility for peserta dashboard
 */

// PESERTA DASHBOARD - Only show visible packages
// Update in: dashboard routes or package service
export const getVisiblePackages = async (userId) => {
  const { data, error } = await supabase
    .from('packages')
    .select('id, name, description, price, category_id, question_count, content_type, visibility')
    .eq('visibility', 'visible') // KEY CHANGE: Filter by visibility
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// ADMIN DASHBOARD - Show all packages (both visible and hidden)
export const getAllPackages = async () => {
  const { data, error } = await supabase
    .from('packages')
    .select('id, name, description, price, category_id, question_count, content_type, visibility')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// BUNDLING SELECTOR - Include hidden packages
// Already included in the filter logic, just make sure to show "(Arsip Admin)" label
export const getPackagesForBundling = async () => {
  const { data, error } = await supabase
    .from('packages')
    .select('id, name, type, category_id, visibility')
    .neq('type', 'bundle')
    .neq('type', 'bundling')
    // NO visibility filter - include both visible and hidden
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// DASHBOARD FILTERING - Additional filters
export const getPackagesByVisibility = async (visibility) => {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('visibility', visibility) // 'visible' or 'hidden'
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// GET PACKAGES WITH CONTENT TYPE
export const getPackagesByContentType = async (contentType, visibility = 'visible') => {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('content_type', contentType) // 'question' or 'material'
    .eq('visibility', visibility)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// MIGRATION: Run this in Supabase SQL editor
/*
BEGIN;

ALTER TABLE packages
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) DEFAULT 'question' CONSTRAINT check_content_type CHECK (content_type IN ('question', 'material')),
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'visible' CONSTRAINT check_visibility CHECK (visibility IN ('visible', 'hidden')),
ADD COLUMN IF NOT EXISTS pdf_file_path TEXT;

UPDATE packages SET content_type = 'question', visibility = 'visible' WHERE content_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_packages_visibility ON packages(visibility);
CREATE INDEX IF NOT EXISTS idx_packages_content_type ON packages(content_type);

COMMIT;
*/

// RLS POLICIES (if using Row Level Security)
/*
-- Policy: Peserta hanya bisa lihat visible packages
CREATE POLICY "peserta_view_visible"
  ON packages FOR SELECT
  TO authenticated
  USING (visibility = 'visible' OR auth.uid() = owner_id);

-- Policy: Admin bisa lihat semua
CREATE POLICY "admin_view_all"
  ON packages FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');
*/
