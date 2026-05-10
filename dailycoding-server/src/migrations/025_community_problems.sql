-- 025: Community problem submissions
-- Users can submit problems for admin review before official registration

CREATE TABLE IF NOT EXISTS community_problems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  hint TEXT,
  input_desc TEXT,
  output_desc TEXT,
  examples JSON,
  testcases JSON,
  tier VARCHAR(20) DEFAULT 'unranked',
  problem_type VARCHAR(30) DEFAULT 'coding',
  difficulty INT DEFAULT 5,
  tags JSON,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by INT,
  reviewed_at DATETIME,
  registered_problem_id INT,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
