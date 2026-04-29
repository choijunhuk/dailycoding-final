CREATE TABLE IF NOT EXISTS weekly_challenges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  problem_id INT NOT NULL,
  week_start DATE NOT NULL,
  reward_code VARCHAR(50) NOT NULL DEFAULT 'weekly_solver',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_week (week_start),
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS problem_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  problem_id INT NOT NULL,
  user_id INT NOT NULL,
  content VARCHAR(1000) NOT NULL,
  parent_id INT DEFAULT NULL,
  like_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES problem_comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS problem_comment_likes (
  user_id INT NOT NULL,
  comment_id INT NOT NULL,
  PRIMARY KEY (user_id, comment_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES problem_comments(id) ON DELETE CASCADE
);
