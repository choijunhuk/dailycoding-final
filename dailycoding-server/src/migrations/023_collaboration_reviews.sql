-- Open-source collaboration style code review workflow

CREATE TABLE IF NOT EXISTS code_reviews (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  problem_id      INT NOT NULL,
  submission_id   INT NOT NULL,
  author_id       INT NOT NULL,
  reviewer_id     INT NOT NULL,
  status          ENUM('open','approved','rejected','merged','cancelled') NOT NULL DEFAULT 'open',
  score_awarded   TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_code_reviews_reviewer_status (reviewer_id, status, created_at),
  INDEX idx_code_reviews_author_status (author_id, status, created_at),
  INDEX idx_code_reviews_submission (submission_id, reviewer_id, status)
);

CREATE TABLE IF NOT EXISTS code_review_comments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  review_id   INT NOT NULL,
  user_id     INT NOT NULL,
  content     TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES code_reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_review_comments_review_created (review_id, created_at)
);

CREATE TABLE IF NOT EXISTS code_suggestions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  review_id      INT NOT NULL,
  user_id        INT NOT NULL,
  file_path      VARCHAR(255) NOT NULL DEFAULT 'solution',
  original_code  LONGTEXT,
  suggested_code LONGTEXT NOT NULL,
  reason         TEXT,
  status         ENUM('pending','approved','rejected','merged') NOT NULL DEFAULT 'pending',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES code_reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_code_suggestions_review_status (review_id, status)
);

CREATE TABLE IF NOT EXISTS test_suggestions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  review_id       INT NOT NULL,
  user_id         INT NOT NULL,
  input_data      TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  reason          TEXT,
  status          ENUM('pending','approved','rejected','merged') NOT NULL DEFAULT 'pending',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES code_reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_test_suggestions_review_status (review_id, status)
);

CREATE TABLE IF NOT EXISTS collaboration_scores (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  review_score     INT NOT NULL DEFAULT 0,
  suggestion_score INT NOT NULL DEFAULT 0,
  accepted_count   INT NOT NULL DEFAULT 0,
  total_count      INT NOT NULL DEFAULT 0,
  rejected_count   INT NOT NULL DEFAULT 0,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_collaboration_scores_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
