SET @db = DATABASE();

-- Add problem_id column to battle_submissions (for territory mode per-problem tracking)
SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'battle_submissions' AND COLUMN_NAME = 'problem_id') = 0,
  'ALTER TABLE battle_submissions ADD COLUMN problem_id INT DEFAULT NULL',
  'SELECT 1 /* problem_id already exists */'
);
PREPARE stmt FROM @stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
