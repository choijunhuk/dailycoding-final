-- ── 커뮤니티 고도화 v2 ──────────────────────────────────────────────────────

-- 유저 정보 확장
-- MySQL 5.7 does not support ADD COLUMN IF NOT EXISTS.
-- initDatabase() logs duplicate-column warnings and continues, so keep each
-- column in its own statement to let missing columns backfill independently.
ALTER TABLE users ADD COLUMN nickname            VARCHAR(50)                         NULL     UNIQUE;
ALTER TABLE users ADD COLUMN nickname_changed_at DATETIME                            NULL;
ALTER TABLE users ADD COLUMN profile_visibility  ENUM('public','private') NOT NULL   DEFAULT 'public';
ALTER TABLE users ADD COLUMN post_visibility     ENUM('public','private') NOT NULL   DEFAULT 'public';
ALTER TABLE users ADD COLUMN achievement         VARCHAR(100)                        NULL;

-- 인덱스: nickname 검색 (중복 실행 시 ER_DUP_KEYNAME 오류는 initDatabase()에서 warn 처리됨)
ALTER TABLE users ADD INDEX idx_nickname (nickname);

-- posts: 익명 작성 플래그
ALTER TABLE posts
  ADD COLUMN is_anonymous TINYINT(1) NOT NULL DEFAULT 0;

-- posts: 인기 게시물 필터용 인덱스 (like_count + created_at)
ALTER TABLE posts ADD INDEX idx_like_created (like_count, created_at);

-- post_replies: 데코콘(이미지) 식별자
ALTER TABLE post_replies
  ADD COLUMN decocon_id VARCHAR(50) NULL;

-- ── 스크랩 ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_scraps (
  user_id    INT NOT NULL,
  post_id    INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- ── 유저 차단 ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id INT NOT NULL,
  blocked_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id),
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── 투표 (Poll) ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polls (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  post_id    INT NOT NULL UNIQUE,
  question   VARCHAR(200) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poll_options (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  poll_id  INT NOT NULL,
  label    VARCHAR(100) NOT NULL,
  votes    INT NOT NULL DEFAULT 0,
  ord      TINYINT NOT NULL DEFAULT 0,
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  INDEX idx_poll_ord (poll_id, ord)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  user_id   INT NOT NULL,
  poll_id   INT NOT NULL,
  option_id INT NOT NULL,
  PRIMARY KEY (user_id, poll_id),
  FOREIGN KEY (user_id)   REFERENCES users(id)        ON DELETE CASCADE,
  FOREIGN KEY (poll_id)   REFERENCES polls(id)         ON DELETE CASCADE,
  FOREIGN KEY (option_id) REFERENCES poll_options(id)  ON DELETE CASCADE
);
