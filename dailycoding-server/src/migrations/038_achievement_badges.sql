SET @db = DATABASE();

-- Add category column to reward_items
SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reward_items' AND COLUMN_NAME = 'category') = 0,
  'ALTER TABLE reward_items ADD COLUMN category VARCHAR(30) DEFAULT NULL',
  'SELECT 1 /* category already exists */'
);
PREPARE stmt FROM @stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add sort_order column to reward_items
SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reward_items' AND COLUMN_NAME = 'sort_order') = 0,
  'ALTER TABLE reward_items ADD COLUMN sort_order INT NOT NULL DEFAULT 0',
  'SELECT 1 /* sort_order already exists */'
);
PREPARE stmt FROM @stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Expand rarity ENUM to include 'uncommon' (idempotent via MODIFY)
ALTER TABLE reward_items
  MODIFY COLUMN rarity ENUM('common','uncommon','rare','epic','legendary') NOT NULL DEFAULT 'common';

-- Back-fill categories for existing badges
UPDATE reward_items SET category = 'ranking', sort_order = 10  WHERE code = 'badge_bronze';
UPDATE reward_items SET category = 'ranking', sort_order = 20  WHERE code = 'badge_silver';
UPDATE reward_items SET category = 'ranking', sort_order = 30  WHERE code = 'badge_gold';
UPDATE reward_items SET category = 'ranking', sort_order = 40  WHERE code = 'badge_platinum';
UPDATE reward_items SET category = 'ranking', sort_order = 60  WHERE code = 'badge_diamond';
UPDATE reward_items SET category = 'coding',  sort_order = 10  WHERE code = 'badge_first_solve';
UPDATE reward_items SET category = 'coding',  sort_order = 20  WHERE code = 'badge_solve10';
UPDATE reward_items SET category = 'coding',  sort_order = 30  WHERE code = 'badge_solve50';
UPDATE reward_items SET category = 'coding',  sort_order = 40  WHERE code = 'badge_solve100';
UPDATE reward_items SET category = 'streak',  sort_order = 10  WHERE code IN ('badge_streak7', 'badge_streak_7');
UPDATE reward_items SET category = 'streak',  sort_order = 20  WHERE code IN ('badge_streak30', 'badge_streak_30');
UPDATE reward_items SET category = 'streak',  sort_order = 30  WHERE code = 'badge_streak100';
UPDATE reward_items SET category = 'xp',      sort_order = 10  WHERE code = 'badge_xp_rookie';
UPDATE reward_items SET category = 'xp',      sort_order = 20  WHERE code = 'badge_xp_climber';
UPDATE reward_items SET category = 'xp',      sort_order = 30  WHERE code = 'badge_xp_veteran';
UPDATE reward_items SET category = 'battle',  sort_order = 10  WHERE code = 'badge_battle_win';
UPDATE reward_items SET category = 'ranking'                   WHERE code LIKE 'title_%';
UPDATE reward_items SET category = 'xp'                       WHERE code IN ('title_routine_builder','title_debug_maker');
