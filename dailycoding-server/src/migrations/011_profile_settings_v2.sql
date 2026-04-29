-- ── 프로필 확장 & 설정 고도화 v2 ────────────────────────────────────────────

-- 유저 프로필 확장
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name   VARCHAR(60)  NULL,
  ADD COLUMN IF NOT EXISTS social_links   JSON         NULL,
  ADD COLUMN IF NOT EXISTS tech_stack     JSON         NULL;

-- 커뮤니티 신고 테이블
CREATE TABLE IF NOT EXISTS post_reports (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id INT NOT NULL,
  target_type ENUM('post','reply') NOT NULL,
  target_id   INT NOT NULL,
  reason      ENUM('spam','hate','illegal','misinformation','other') NOT NULL,
  detail      VARCHAR(200) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_report (reporter_id, target_type, target_id),
  INDEX idx_target (target_type, target_id),
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);
