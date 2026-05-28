-- 048: Tournament battle mode column
-- MySQL 8.0 compatible (IF NOT EXISTS on ADD COLUMN is MariaDB-only)

SET @db = DATABASE();

SET @s1 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE tournaments ADD COLUMN battle_mode VARCHAR(40) DEFAULT NULL',
  'SELECT 1 /* battle_mode already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='tournaments' AND COLUMN_NAME='battle_mode');
PREPARE stmt FROM @s1; EXECUTE stmt; DEALLOCATE PREPARE stmt;
