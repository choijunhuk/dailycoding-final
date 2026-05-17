CREATE TABLE IF NOT EXISTS tournaments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  size INT NOT NULL DEFAULT 8,
  status ENUM('open','in_progress','complete') NOT NULL DEFAULT 'open',
  created_by INT NOT NULL,
  starts_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tournaments_status (status, starts_at)
);

CREATE TABLE IF NOT EXISTS tournament_participants (
  tournament_id INT NOT NULL,
  user_id INT NOT NULL,
  seed INT NOT NULL,
  eliminated_at DATETIME DEFAULT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tournament_id, user_id),
  INDEX idx_tournament_participants_seed (tournament_id, seed)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  round INT NOT NULL,
  match_num INT NOT NULL,
  player1_id INT DEFAULT NULL,
  player2_id INT DEFAULT NULL,
  winner_id INT DEFAULT NULL,
  battle_id VARCHAR(80) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_tournament_match (tournament_id, round, match_num),
  INDEX idx_tournament_matches_tournament (tournament_id, round, match_num)
);
