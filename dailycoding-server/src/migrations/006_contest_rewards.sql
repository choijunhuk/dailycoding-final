-- 006_contest_rewards.sql
-- Per-contest reward configuration and idempotent grant ledger

CREATE TABLE IF NOT EXISTS contest_reward_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contest_id INT NOT NULL,
  rank_from INT NOT NULL,
  rank_to INT NOT NULL,
  reward_code VARCHAR(50) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_code) REFERENCES reward_items(code) ON DELETE CASCADE,
  UNIQUE KEY uk_contest_reward_rule (contest_id, rank_from, rank_to, reward_code),
  INDEX idx_contest_reward_rules_contest (contest_id)
);

CREATE TABLE IF NOT EXISTS contest_reward_grants (
  contest_id INT NOT NULL,
  user_id INT NOT NULL,
  rank_position INT NOT NULL,
  reward_code VARCHAR(50) NOT NULL,
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contest_id, user_id, reward_code),
  FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_code) REFERENCES reward_items(code) ON DELETE CASCADE,
  INDEX idx_contest_reward_grants_contest (contest_id),
  INDEX idx_contest_reward_grants_user (user_id)
);
