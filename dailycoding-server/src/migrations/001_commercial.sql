-- Add email_verified to users
ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN subscription_tier ENUM('free','pro','team') NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE users ADD COLUMN banned_at DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN ban_reason TEXT DEFAULT NULL;

-- Email verification tokens
CREATE TABLE email_verification_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id)
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token)
);

-- Content reports
CREATE TABLE content_reports (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id  INT NOT NULL,
  content_type ENUM('comment','problem','user') NOT NULL,
  content_id   INT NOT NULL,
  reason       VARCHAR(200) NOT NULL,
  status       ENUM('pending','resolved','dismissed') DEFAULT 'pending',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status)
);

-- Subscriptions log
CREATE TABLE subscription_events (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  stripe_event_id VARCHAR(100) UNIQUE,
  event_type      VARCHAR(50) NOT NULL,
  tier            ENUM('free','pro','team'),
  amount_cents    INT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_submissions_user_id ON submissions(user_id);
CREATE INDEX idx_submissions_problem_id ON submissions(problem_id);
CREATE INDEX idx_submissions_created_at ON submissions(created_at);
CREATE INDEX idx_users_rating ON users(rating DESC);
CREATE INDEX idx_users_email_verified ON users(email_verified);

CREATE TABLE IF NOT EXISTS follows (
  follower_id INT NOT NULL,
  following_id INT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);
