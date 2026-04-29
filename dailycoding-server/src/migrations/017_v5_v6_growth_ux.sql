CREATE TABLE IF NOT EXISTS user_onboarding (
  user_id INT PRIMARY KEY,
  step VARCHAR(50) NOT NULL DEFAULT 'select_goal',
  goal ENUM('job_hunting','skill_up','interview_prep','fun') NULL,
  target_company VARCHAR(100) NULL,
  experience_level ENUM('beginner','intermediate','advanced') NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS promotion_series (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  from_tier VARCHAR(20) NOT NULL,
  to_tier VARCHAR(20) NOT NULL,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  status ENUM('in_progress','promoted','failed') NOT NULL DEFAULT 'in_progress',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_status (user_id, status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
