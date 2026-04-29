CREATE TABLE IF NOT EXISTS referrals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  referrer_id INT NOT NULL,
  referred_user_id INT NULL,
  referral_code VARCHAR(12) NOT NULL UNIQUE,
  status ENUM('pending','signed_up','rewarded') DEFAULT 'pending',
  reward_granted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_referrer (referrer_id),
  INDEX idx_code (referral_code),
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_sets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  duration_min INT NOT NULL DEFAULT 120,
  problem_ids JSON NOT NULL,
  difficulty_avg DECIMAL(3,1) DEFAULT NULL,
  tier_required VARCHAR(20) NULL,
  is_pro TINYINT(1) DEFAULT 0,
  company_tag VARCHAR(50) NULL,
  play_count INT DEFAULT 0,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_company (company_tag),
  INDEX idx_pro (is_pro),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  exam_set_id INT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL DEFAULT NULL,
  time_used_sec INT NULL,
  score INT DEFAULT 0,
  status ENUM('in_progress','completed','abandoned') DEFAULT 'in_progress',
  answers JSON NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_set_id) REFERENCES exam_sets(id) ON DELETE CASCADE,
  INDEX idx_user_set (user_id, exam_set_id)
);

CREATE TABLE IF NOT EXISTS build_problems (
  problem_id INT PRIMARY KEY,
  build_type ENUM('snippet','spec','sql') NOT NULL,
  starter_code TEXT,
  test_type ENUM('unit','integration','output_match') DEFAULT 'output_match',
  setup_code TEXT NULL,
  expected_schema TEXT NULL,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profile_backgrounds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  image_url VARCHAR(300) NOT NULL,
  is_default TINYINT(1) DEFAULT 0,
  is_premium TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_backgrounds (
  user_id INT NOT NULL,
  background_slug VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, background_slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS problem_sheets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category ENUM('contest','learning','company','custom') NOT NULL,
  contest_name VARCHAR(100) NULL,
  contest_year INT NULL,
  difficulty_level ENUM('beginner','intermediate','advanced','mixed') DEFAULT 'mixed',
  problem_ids JSON NOT NULL,
  is_official TINYINT(1) DEFAULT 0,
  created_by INT NOT NULL,
  play_count INT DEFAULT 0,
  thumbnail_color VARCHAR(20) DEFAULT '#79c0ff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_official (is_official),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learning_paths (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  order_index INT NOT NULL,
  tag VARCHAR(50) NOT NULL,
  icon VARCHAR(10) DEFAULT '📚',
  problem_ids JSON NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_background VARCHAR(50) NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url_custom VARCHAR(500) NULL DEFAULT NULL;
