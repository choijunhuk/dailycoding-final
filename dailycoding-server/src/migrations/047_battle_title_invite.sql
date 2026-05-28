-- 047: Battle room title and invite code extension
-- MySQL 8.0 compatible (IF NOT EXISTS on ADD COLUMN is MariaDB-only)

SET @db = DATABASE();

SET @s1 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE battle_rooms ADD COLUMN title VARCHAR(100) DEFAULT NULL',
  'SELECT 1 /* title already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='battle_rooms' AND COLUMN_NAME='title');
PREPARE stmt FROM @s1; EXECUTE stmt; DEALLOCATE PREPARE stmt;
