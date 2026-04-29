CREATE TABLE IF NOT EXISTS battle_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  room_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  opponent_name VARCHAR(255) DEFAULT NULL,
  result ENUM('win','lose','draw') NOT NULL,
  score_for INT NOT NULL DEFAULT 0,
  score_against INT NOT NULL DEFAULT 0,
  solved_for INT NOT NULL DEFAULT 0,
  solved_against INT NOT NULL DEFAULT 0,
  problems_json JSON DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_battle_history_room_user (room_id, user_id),
  KEY idx_battle_history_user_created (user_id, created_at)
);
