-- 028_contest_creation_requests.sql
-- Allows users to request admin to create a contest

CREATE TABLE IF NOT EXISTS contest_creation_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  desired_date VARCHAR(50),
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  admin_note VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
