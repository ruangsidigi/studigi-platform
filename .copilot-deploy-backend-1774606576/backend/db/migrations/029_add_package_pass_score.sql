-- Migration 029: Add pass_score column to packages
-- pass_score: minimum total score to pass. NULL = use standard SKD thresholds (TWK>65, TIU>85, TKP>166)
ALTER TABLE packages ADD COLUMN IF NOT EXISTS pass_score INTEGER DEFAULT NULL;
