-- ─── new arcade mode-aware badges ─────────────────────────────────────
INSERT IGNORE INTO reward_items (code, type, name, icon, description, rarity) VALUES
('badge_tetris_survivor',     'badge', '테트리스 생존가', '🛡️', '테트리스 클래식/인비저블 3분 이상 생존', 'rare'),
('badge_minesweeper_medium',  'badge', '지뢰 미디엄',     '🚩', '지뢰찾기 미디엄(16x16) 3분 안에 클리어',  'common'),
('badge_minesweeper_hard',    'badge', '지뢰 하드',       '💣', '지뢰찾기 하드(30x16) 클리어',             'rare');
