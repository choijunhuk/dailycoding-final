SET @db = DATABASE();

SET @stmt = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'review_due_at') = 0,
  'ALTER TABLE submissions ADD COLUMN review_due_at DATETIME NULL',
  'SELECT 1 /* review_due_at already exists */'
);
PREPARE stmt FROM @stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_push_endpoint (endpoint(191)),
  INDEX idx_push_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS interview_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  problem_ids JSON NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  duration_sec INT DEFAULT 5400,
  status ENUM('active','completed','expired') DEFAULT 'active',
  score INT DEFAULT NULL,
  ai_feedback TEXT,
  INDEX idx_interview_user (user_id, started_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS interview_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  problem_id INT NOT NULL,
  code TEXT,
  language VARCHAR(20),
  result VARCHAR(20),
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_interview_session (session_id),
  FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flagged_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  reason VARCHAR(255),
  similarity FLOAT,
  reviewed TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_flagged_reviewed (reviewed, created_at),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);
