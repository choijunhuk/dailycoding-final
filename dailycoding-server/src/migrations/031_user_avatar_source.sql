SET @db = DATABASE();

-- Persist whether profile views should use the DailyCoding saved avatar or the original OAuth provider avatar.
SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_source') = 0,
  'ALTER TABLE users ADD COLUMN avatar_source ENUM(''site'',''provider'') NOT NULL DEFAULT ''site''',
  'SELECT 1 /* avatar_source already exists */'
);
PREPARE stmt FROM @stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
