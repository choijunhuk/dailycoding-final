-- 005_contest_improvements.sql
-- Adds advanced access controls for contests

-- Alter contests table to add join type and security code
ALTER TABLE contests 
ADD COLUMN join_type ENUM('direct', 'approval') DEFAULT 'direct' AFTER privacy,
ADD COLUMN security_code VARCHAR(255) NULL AFTER join_type;

-- Create contest_join_requests table to track pending approvals
CREATE TABLE IF NOT EXISTS contest_join_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contest_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_contest_user (contest_id, user_id)
);
