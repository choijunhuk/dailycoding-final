ALTER TABLE problems MODIFY problem_type ENUM('coding','fill-blank','bug-fix','troubleshooting','performance-fix','refactor-fix') NOT NULL DEFAULT 'coding';

CREATE TABLE IF NOT EXISTS troubleshooting_problem_configs (
  problem_id              INT PRIMARY KEY,
  scenario_title          VARCHAR(200) NOT NULL,
  scenario_description    TEXT,
  initial_files           JSON NOT NULL,
  visible_tests           JSON DEFAULT NULL,
  hidden_tests            JSON DEFAULT NULL,
  performance_limit_ms    INT DEFAULT NULL,
  memory_limit_mb         INT DEFAULT NULL,
  target_response_time_ms INT DEFAULT NULL,
  baseline_time_ms        INT DEFAULT NULL,
  allowed_files           JSON DEFAULT NULL,
  forbidden_patterns      JSON DEFAULT NULL,
  scoring_rules           JSON DEFAULT NULL,
  evaluation_mode         VARCHAR(50) NOT NULL DEFAULT 'command',
  created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS troubleshooting_submissions (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  submission_id      INT DEFAULT NULL,
  user_id            INT NOT NULL,
  problem_id         INT NOT NULL,
  submitted_files    JSON NOT NULL,
  result             ENUM('correct','wrong','timeout','error','compile','judging') DEFAULT 'judging',
  total_score        INT DEFAULT 0,
  correctness_score  INT DEFAULT 0,
  performance_score  INT DEFAULT 0,
  readability_score  INT DEFAULT 0,
  test_pass_count    INT DEFAULT 0,
  total_test_count   INT DEFAULT 0,
  execution_time_ms  INT DEFAULT NULL,
  memory_used_mb     FLOAT DEFAULT NULL,
  changed_files_count INT DEFAULT 0,
  improvement_rate   FLOAT DEFAULT NULL,
  feedback           TEXT,
  detail_json        JSON DEFAULT NULL,
  submitted_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE SET NULL,
  INDEX idx_troubleshooting_sub_user_problem (user_id, problem_id, submitted_at)
);
