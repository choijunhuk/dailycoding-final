CREATE TABLE IF NOT EXISTS user_badge_showcase (
  user_id INT NOT NULL,
  reward_id INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, reward_id),
  INDEX idx_badge_showcase_user_order (user_id, sort_order, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_id) REFERENCES reward_items(id) ON DELETE CASCADE
);
