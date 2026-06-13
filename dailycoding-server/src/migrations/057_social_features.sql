-- 057: Social features
--   • User activity tracking (online status + current activity hint)
--   • Direct messages (1:1) between mutual followers / followed users
--   • Arcade achievement badges (reward_items entries)

-- ─── user activity columns ────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_active_at  DATETIME NULL,
  ADD COLUMN IF NOT EXISTS current_activity VARCHAR(60) NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_active ON users (last_active_at);

-- ─── direct messages ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dm_messages (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  sender_id    INT          NOT NULL,
  recipient_id INT          NOT NULL,
  content      VARCHAR(2000) NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at      DATETIME     NULL,
  INDEX idx_dm_pair_time (sender_id, recipient_id, created_at),
  INDEX idx_dm_inbox     (recipient_id, read_at, created_at),
  FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── arcade achievement badges (reward_items) ─────────────────────────
INSERT IGNORE INTO reward_items (code, type, name, icon, description, rarity) VALUES
('badge_arcade_first',   'badge', '아케이드 데뷔',   '🕹️', '아케이드 게임 첫 클리어', 'common'),
('badge_arcade_explorer','badge', '아케이드 탐험가', '🎮', '아케이드 미니게임 5종 플레이', 'common'),
('badge_arcade_master',  'badge', '아케이드 마스터', '👑', '아케이드 미니게임 11종 모두 플레이', 'rare'),
('badge_tetris_1k',      'badge', '테트리스 천점',   '🟦', '테트리스 1,000점 돌파', 'common'),
('badge_tetris_5k',      'badge', '테트리스 오천',   '💎', '테트리스 5,000점 돌파', 'rare'),
('badge_sprint_sub2',    'badge', '스프린트 2분',    '⚡', '스프린트 40을 2분 안에 클리어', 'rare'),
('badge_snake_50',       'badge', '스네이크 50',     '🐍', '스네이크 길이 50 달성', 'common'),
('badge_2048_reached',   'badge', '2048 달성',       '🏆', '2048 타일 달성', 'rare'),
('title_arcade_master',  'title', '아케이드 마스터', '👑', '아케이드 11종 정복 칭호', 'rare');
