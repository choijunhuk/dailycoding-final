SET @db = DATABASE();

SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'battle_history' AND COLUMN_NAME = 'battle_timeline') = 0,
  'ALTER TABLE battle_history ADD COLUMN battle_timeline LONGTEXT NULL AFTER problems_json',
  'SELECT 1 /* battle_timeline already exists */'
);
PREPARE stmt FROM @stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
