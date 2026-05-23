-- Add name_ko column to reward_items for bilingual badge/title display
SET @db = DATABASE();
CALL sys.execute_prepared_stmt(
  IF((SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reward_items' AND COLUMN_NAME = 'name_ko') = 0,
    'ALTER TABLE reward_items ADD COLUMN name_ko VARCHAR(100) DEFAULT NULL AFTER name',
    'SELECT 1')
);
