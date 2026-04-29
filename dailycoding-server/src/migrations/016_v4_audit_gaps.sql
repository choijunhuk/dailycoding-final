CREATE TABLE IF NOT EXISTS daily_missions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  mission_date DATE NOT NULL,
  mission_type ENUM('solve_1','solve_3','battle_win','correct_streak_3','review_ai') NOT NULL,
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  reward_type VARCHAR(50) NOT NULL DEFAULT 'points',
  reward_value INT NOT NULL DEFAULT 10,
  UNIQUE KEY unique_mission (user_id, mission_date, mission_type),
  INDEX idx_user_date (user_id, mission_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS season_rankings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  season VARCHAR(7) NOT NULL,
  season_rating INT NOT NULL DEFAULT 0,
  solved_count INT NOT NULL DEFAULT 0,
  battle_wins INT NOT NULL DEFAULT 0,
  final_rank INT NULL,
  reward_granted TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_season_user (user_id, season),
  INDEX idx_season_rating (season, season_rating DESC),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE battle_history
  ADD COLUMN opponent_id INT NULL AFTER user_id;
