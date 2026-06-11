-- 053: Pro-tier streak freezes
-- streak_freezes_remaining: number of consume-on-break charges left this month.
-- streak_freezes_reset_at: YYYY-MM-01 timestamp; consumed monthly by onSolve.
-- MySQL 8.0 compatible (IF NOT EXISTS on ADD COLUMN is MariaDB-only)

SET @db = DATABASE();

SET @s1 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE users ADD COLUMN streak_freezes_remaining TINYINT NOT NULL DEFAULT 0',
  'SELECT 1 /* streak_freezes_remaining already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='users' AND COLUMN_NAME='streak_freezes_remaining');
PREPARE stmt FROM @s1; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s2 = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE users ADD COLUMN streak_freezes_reset_at DATE NULL',
  'SELECT 1 /* streak_freezes_reset_at already exists */')
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='users' AND COLUMN_NAME='streak_freezes_reset_at');
PREPARE stmt FROM @s2; EXECUTE stmt; DEALLOCATE PREPARE stmt;
