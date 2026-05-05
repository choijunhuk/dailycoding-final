CREATE TABLE IF NOT EXISTS user_progression (
  user_id INT PRIMARY KEY,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE daily_missions
  ALTER reward_type SET DEFAULT 'xp';

UPDATE daily_missions
   SET reward_type = 'xp'
 WHERE reward_type = 'points';

INSERT IGNORE INTO reward_items (code, type, name, icon, description, rarity) VALUES
('badge_xp_rookie',       'badge', '루틴 시작',     '🌱', '경험치 레벨 2 달성', 'common'),
('title_routine_builder', 'title', '루틴 빌더',     '🧱', '경험치 레벨 3 달성 칭호', 'common'),
('badge_xp_climber',      'badge', '꾸준한 등반',   '⛰️', '경험치 레벨 5 달성', 'rare'),
('title_debug_maker',     'title', '디버그 메이커', '🔎', '경험치 레벨 7 달성 칭호', 'rare'),
('badge_xp_veteran',      'badge', '성장 베테랑',   '🏅', '경험치 레벨 10 달성', 'epic');
