-- 055: Arcade mini-games (Output Guess, Big-O Quiz, Bug Hunt, Code Typing, Tetris, Snake, 2048, Minesweeper).
-- Each row = a single completed game session for one user.
-- score is non-negative integer; meta keeps game-specific details (level, time, accuracy, etc.) as JSON text.

CREATE TABLE IF NOT EXISTS arcade_scores (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  game_key    VARCHAR(40)  NOT NULL,
  score       INT          NOT NULL DEFAULT 0,
  meta        TEXT         NULL,
  played_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_game_score (game_key, score DESC, played_at),
  INDEX idx_user_game  (user_id, game_key, score DESC),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
