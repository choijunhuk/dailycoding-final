-- Migration 004: Premium gating and Problem visibility expansion
-- Add is_premium flag and expand visibility options if needed

ALTER TABLE problems ADD COLUMN is_premium TINYINT(1) NOT NULL DEFAULT 0;

-- Optional: Add index for performance on filtering
CREATE INDEX idx_problems_visibility_premium ON problems(visibility, is_premium);
