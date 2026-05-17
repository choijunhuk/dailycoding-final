CREATE TABLE IF NOT EXISTS virtual_contest_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  contest_id INT NOT NULL,
  started_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  submissions LONGTEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_virtual_runs_user_contest (user_id, contest_id),
  INDEX idx_virtual_runs_ends_at (ends_at)
);

CREATE TABLE IF NOT EXISTS virtual_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_id INT NOT NULL,
  user_id INT NOT NULL,
  contest_id INT NOT NULL,
  problem_id INT NOT NULL,
  language VARCHAR(40) NOT NULL,
  result VARCHAR(40) NOT NULL,
  time_ms INT DEFAULT NULL,
  detail TEXT,
  code LONGTEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_virtual_submissions_run (run_id),
  INDEX idx_virtual_submissions_user_contest (user_id, contest_id),
  INDEX idx_virtual_submissions_problem (problem_id)
);
