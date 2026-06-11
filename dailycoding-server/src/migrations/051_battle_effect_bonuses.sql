-- 051: Persistent effect bonuses on battle_participants
-- MySQL 8.0 compatible (IF NOT EXISTS on ADD COLUMN is MariaDB-only)

SET @db = DATABASE();

SET @s1 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE battle_participants ADD COLUMN effect_attack_bonus INT NOT NULL DEFAULT 0',
  'SELECT 1 /* effect_attack_bonus already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='battle_participants' AND COLUMN_NAME='effect_attack_bonus');
PREPARE stmt FROM @s1; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s2 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE battle_participants ADD COLUMN effect_speed_bonus INT NOT NULL DEFAULT 0',
  'SELECT 1 /* effect_speed_bonus already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='battle_participants' AND COLUMN_NAME='effect_speed_bonus');
PREPARE stmt FROM @s2; EXECUTE stmt; DEALLOCATE PREPARE stmt;
