-- 024: Battle system improvements
-- Adds territory mode, private rooms, lobby timeout, preferred language
-- MySQL 8.0 compatible (IF NOT EXISTS on ADD COLUMN is MariaDB-only)

SET @db = DATABASE();

SET @s1 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE battle_rooms ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1 /* is_private already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='battle_rooms' AND COLUMN_NAME='is_private');
PREPARE stmt FROM @s1; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s2 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE battle_rooms ADD COLUMN invite_code VARCHAR(8) DEFAULT NULL',
  'SELECT 1 /* invite_code already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='battle_rooms' AND COLUMN_NAME='invite_code');
PREPARE stmt FROM @s2; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s3 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE battle_rooms ADD COLUMN problem_ids JSON DEFAULT NULL',
  'SELECT 1 /* problem_ids already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='battle_rooms' AND COLUMN_NAME='problem_ids');
PREPARE stmt FROM @s3; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s4 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE battle_rooms ADD COLUMN territory_claims JSON DEFAULT NULL',
  'SELECT 1 /* territory_claims already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='battle_rooms' AND COLUMN_NAME='territory_claims');
PREPARE stmt FROM @s4; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s5 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE battle_rooms ADD COLUMN preferred_language VARCHAR(20) DEFAULT NULL',
  'SELECT 1 /* preferred_language already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='battle_rooms' AND COLUMN_NAME='preferred_language');
PREPARE stmt FROM @s5; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s6 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE battle_rooms ADD COLUMN lobby_expires_at DATETIME DEFAULT NULL',
  'SELECT 1 /* lobby_expires_at already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='battle_rooms' AND COLUMN_NAME='lobby_expires_at');
PREPARE stmt FROM @s6; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx = (SELECT IF(COUNT(*) = 0,
  'CREATE UNIQUE INDEX idx_battle_rooms_invite_code ON battle_rooms (invite_code)',
  'SELECT 1 /* index already exists */')
  FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='battle_rooms' AND INDEX_NAME='idx_battle_rooms_invite_code');
PREPARE stmt FROM @idx; EXECUTE stmt; DEALLOCATE PREPARE stmt;
