-- ── 커뮤니티 (실명 게시판) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  board_type   ENUM('qna','tech','lounge') NOT NULL,
  user_id      INT NOT NULL,
  problem_id   INT NULL,
  title        VARCHAR(200) NOT NULL,
  content      TEXT NOT NULL,
  code_snippet TEXT NULL,
  lang         VARCHAR(20) NULL,
  tags         JSON NULL,
  view_count   INT DEFAULT 0,
  like_count   INT DEFAULT 0,
  answer_count INT DEFAULT 0,
  is_solved    TINYINT(1) DEFAULT 0,
  is_pinned    TINYINT(1) DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE SET NULL,
  INDEX idx_board_created (board_type, created_at DESC),
  INDEX idx_user_id (user_id),
  INDEX idx_problem_id (problem_id)
);

CREATE TABLE IF NOT EXISTS post_replies (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  post_id      INT NOT NULL,
  user_id      INT NOT NULL,
  content      TEXT NOT NULL,
  code_snippet TEXT NULL,
  lang         VARCHAR(20) NULL,
  like_count   INT DEFAULT 0,
  is_accepted  TINYINT(1) DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_post_created (post_id, created_at)
);

CREATE TABLE IF NOT EXISTS post_likes (
  user_id     INT NOT NULL,
  target_type ENUM('post','reply') NOT NULL,
  target_id   INT NOT NULL,
  PRIMARY KEY (user_id, target_type, target_id)
);

-- ── 덤프 (익명 게시판 / 뒷갤) ────────────────────────────────────────────
-- user_id는 서버 전용 — API 응답에 절대 노출 금지
-- anon_id: SHA256(user_id + date_salt) 앞 16자 — 당일 동일 ID, 익일 교체
CREATE TABLE IF NOT EXISTS dump_posts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  anon_id      VARCHAR(16) NOT NULL,
  anon_name    VARCHAR(30) NOT NULL,
  content      TEXT NOT NULL,
  upvote       INT DEFAULT 0,
  downvote     INT DEFAULT 0,
  reply_count  INT DEFAULT 0,
  report_count INT DEFAULT 0,
  is_blinded   TINYINT(1) DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at DESC),
  INDEX idx_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS dump_replies (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  post_id      INT NOT NULL,
  user_id      INT NOT NULL,
  anon_id      VARCHAR(16) NOT NULL,
  anon_name    VARCHAR(30) NOT NULL,
  content      TEXT NOT NULL,
  upvote       INT DEFAULT 0,
  report_count INT DEFAULT 0,
  is_blinded   TINYINT(1) DEFAULT 0,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES dump_posts(id) ON DELETE CASCADE,
  INDEX idx_post_created (post_id, created_at)
);

CREATE TABLE IF NOT EXISTS dump_votes (
  anon_id     VARCHAR(16) NOT NULL,
  target_type ENUM('post','reply') NOT NULL,
  target_id   INT NOT NULL,
  vote        TINYINT(1) NOT NULL,
  PRIMARY KEY (anon_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS dump_reports (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id INT NOT NULL,
  target_type ENUM('post','reply') NOT NULL,
  target_id   INT NOT NULL,
  reason      ENUM('spam','hate','illegal','other') NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_report (reporter_id, target_type, target_id)
);
