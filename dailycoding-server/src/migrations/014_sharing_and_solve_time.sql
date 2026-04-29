ALTER TABLE submissions
  ADD COLUMN solve_time_sec INT DEFAULT NULL AFTER memory_mb;

CREATE TABLE IF NOT EXISTS shared_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  slug VARCHAR(12) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_shared_submission (submission_id),
  UNIQUE KEY unique_share_slug (slug),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);
