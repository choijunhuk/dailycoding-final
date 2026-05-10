CREATE TABLE IF NOT EXISTS ai_hint_cache (
  problem_id    INT PRIMARY KEY,
  content_hash  CHAR(64) NOT NULL,
  hint_json     JSON NOT NULL,
  model         VARCHAR(100) DEFAULT NULL,
  created_by    INT DEFAULT NULL,
  served_count  INT NOT NULL DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_ai_hint_cache_hash ON ai_hint_cache(content_hash);
CREATE INDEX idx_ai_hint_cache_updated ON ai_hint_cache(updated_at);
