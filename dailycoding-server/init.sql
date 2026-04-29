-- DailyCoding Database Schema v2
SET NAMES utf8mb4;
SET time_zone = '+09:00';

-- ── 유저 ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password        VARCHAR(255) NULL,
  username        VARCHAR(50)  NOT NULL UNIQUE,
  role            ENUM('user','admin') NOT NULL DEFAULT 'user',
  tier            ENUM('bronze','silver','gold','platinum','diamond') NOT NULL DEFAULT 'bronze',
  rating          INT NOT NULL DEFAULT 800,
  streak          INT NOT NULL DEFAULT 0,
  solved_count    INT NOT NULL DEFAULT 0,
  bio             TEXT,
  join_date       DATE,
  last_login      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  oauth_provider  VARCHAR(20)  DEFAULT NULL,
  oauth_id        VARCHAR(100) DEFAULT NULL,
  avatar_url      VARCHAR(500) DEFAULT NULL,
  default_language VARCHAR(20) DEFAULT 'python',
  submissions_public TINYINT(1) NOT NULL DEFAULT 1,
  equipped_badge  VARCHAR(50)  DEFAULT NULL,
  equipped_title  VARCHAR(50)  DEFAULT NULL,
  email_verified  TINYINT(1)   NOT NULL DEFAULT 0,
  settings        JSON         DEFAULT NULL,
  banned_at       DATETIME     DEFAULT NULL,
  ban_reason      TEXT         DEFAULT NULL,
  UNIQUE KEY idx_oauth (oauth_provider, oauth_id)
);

-- ── 문제 노트 (유저 개인용) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS problem_notes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  problem_id   INT NOT NULL,
  content      TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
  UNIQUE KEY idx_user_problem (user_id, problem_id)
);

-- ── 문제 ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS problems (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  problem_type ENUM('coding','fill-blank','bug-fix') NOT NULL DEFAULT 'coding',
  preferred_language VARCHAR(20) DEFAULT NULL,
  special_config JSON DEFAULT NULL,
  tier         ENUM('bronze','silver','gold','platinum','diamond') DEFAULT 'bronze',
  difficulty   TINYINT DEFAULT 5,
  time_limit   TINYINT DEFAULT 2,
  mem_limit    SMALLINT DEFAULT 256,
  description  TEXT,
  input_desc   TEXT,
  output_desc  TEXT,
  hint         TEXT,
  solution     TEXT,
  visibility   ENUM('global','contest') NOT NULL DEFAULT 'global',
  contest_id   INT DEFAULT NULL,
  solved_count INT DEFAULT 0,
  submit_count INT DEFAULT 0,
  author_id    INT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── 문제 태그 ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS problem_tags (
  problem_id INT NOT NULL,
  tag        VARCHAR(50) NOT NULL,
  PRIMARY KEY (problem_id, tag),
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

-- ── 문제 예제 (유저에게 보임) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS problem_examples (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  problem_id  INT NOT NULL,
  input_data  TEXT,
  output_data TEXT,
  ord         INT DEFAULT 0,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

-- ── 히든 테스트케이스 (채점용, 유저에게 안 보임) ──────────────────────────
CREATE TABLE IF NOT EXISTS problem_testcases (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  problem_id  INT NOT NULL,
  input_data  TEXT,
  output_data TEXT,
  ord         INT DEFAULT 0,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

-- ── 제출 ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  problem_id  INT NOT NULL,
  lang        VARCHAR(50),
  code        LONGTEXT,
  result      ENUM('correct','wrong','timeout','error','compile','judging') DEFAULT 'judging',
  time_ms     INT,
  memory_mb   FLOAT,
  detail      TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

-- ── 북마크 ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    INT NOT NULL,
  problem_id INT NOT NULL,
  PRIMARY KEY (user_id, problem_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

-- ── 대회 ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contests (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  status       ENUM('waiting','running','ended') DEFAULT 'waiting',
  duration_min INT DEFAULT 60,
  privacy      ENUM('public','private') DEFAULT 'public',
  max_users    INT DEFAULT 20,
  host_id      INT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── 대회 참가자 ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contest_participants (
  contest_id INT NOT NULL,
  user_id    INT NOT NULL,
  score      INT DEFAULT 0,
  joined_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contest_id, user_id),
  FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);

-- ── 댓글 ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  problem_id INT NOT NULL,
  user_id    INT NOT NULL,
  content    TEXT NOT NULL,
  likes      INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);

-- ── 알림 ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  message    TEXT NOT NULL,
  link       VARCHAR(100),
  is_read    TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── 풀이 잔디 ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solve_logs (
  user_id    INT NOT NULL,
  solve_date DATE NOT NULL,
  count      INT DEFAULT 1,
  PRIMARY KEY (user_id, solve_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── 대회 문제 ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contest_problems (
  contest_id INT NOT NULL,
  problem_id INT NOT NULL,
  ord        INT DEFAULT 0,
  PRIMARY KEY (contest_id, problem_id),
  FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

-- ── 난이도 투표 (새 기능) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS difficulty_votes (
  user_id    INT NOT NULL,
  problem_id INT NOT NULL,
  vote       TINYINT NOT NULL DEFAULT 5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, problem_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

-- ── 보상 아이템 정의 ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reward_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(50)  NOT NULL UNIQUE,
  type        ENUM('badge','title','frame') NOT NULL,
  name        VARCHAR(100) NOT NULL,
  icon        VARCHAR(50)  NOT NULL DEFAULT '🎁',
  description TEXT,
  rarity      ENUM('common','rare','epic','legendary') NOT NULL DEFAULT 'common',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── 유저 보유 보상 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_rewards (
  user_id    INT NOT NULL,
  reward_id  INT NOT NULL,
  earned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, reward_id),
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  FOREIGN KEY (reward_id) REFERENCES reward_items(id) ON DELETE CASCADE
);

-- ── 보상 시드 데이터 ───────────────────────────────────────────────────────
INSERT IGNORE INTO reward_items (code, type, name, icon, description, rarity) VALUES
-- 티어 달성 뱃지
('badge_bronze',    'badge', '브론즈 입문',   '🥉', '브론즈 티어에 도달했습니다',           'common'),
('badge_silver',    'badge', '실버 등반',     '🥈', '실버 티어에 도달했습니다',             'common'),
('badge_gold',      'badge', '골드 정복',     '🥇', '골드 티어에 도달했습니다',             'rare'),
('badge_platinum',  'badge', '플래티넘 도약', '💎', '플래티넘 티어에 도달했습니다',          'epic'),
('badge_diamond',   'badge', '다이아 군림',   '👑', '다이아몬드 티어 최고 경지에 도달했습니다','legendary'),
-- 티어 달성 칭호
('title_bronze',    'title', '초보 코더',     '🧑‍💻', '브론즈 달성 칭호',   'common'),
('title_silver',    'title', '실버 해커',     '🔧', '실버 달성 칭호',     'common'),
('title_gold',      'title', '골드 알고리스트','⚙️', '골드 달성 칭호',     'rare'),
('title_platinum',  'title', '플래 마스터',   '🔮', '플래티넘 달성 칭호',  'epic'),
('title_diamond',   'title', '다이아 레전드', '🌟', '다이아 달성 칭호',   'legendary'),
-- 대회 순위 보상
('badge_contest1',  'badge', '대회 우승',     '🏆', '대회 1위 달성',      'legendary'),
('badge_contest2',  'badge', '대회 준우승',   '🥈', '대회 2위 달성',      'epic'),
('badge_contest3',  'badge', '대회 3위',      '🥉', '대회 3위 달성',      'rare'),
('title_champion',  'title', '챔피언',        '🏆', '대회 우승 칭호',     'legendary'),
-- 스트릭 보상
('badge_streak7',   'badge', '7일 연속',      '🔥', '7일 연속 풀이',      'common'),
('badge_streak30',  'badge', '30일 연속',     '🔥', '30일 연속 풀이',     'rare'),
('badge_streak100', 'badge', '100일 연속',    '🔥', '100일 연속 풀이',    'legendary'),
-- 풀이 수 보상
('badge_solve10',   'badge', '10문제 달성',   '✅', '10문제 풀이',        'common'),
('badge_solve50',   'badge', '50문제 달성',   '⭐', '50문제 풀이',        'rare'),
('badge_solve100',  'badge', '100문제 달성',  '💯', '100문제 풀이',       'epic');

-- ── OAuth 소셜 로그인 지원 컬럼 추가 (기존 DB 마이그레이션용 — 새 DB에선 위 CREATE TABLE에 포함)
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN oauth_provider  VARCHAR(20)  DEFAULT NULL;
ALTER TABLE users ADD COLUMN oauth_id        VARCHAR(100) DEFAULT NULL;
ALTER TABLE users ADD COLUMN avatar_url      VARCHAR(500) DEFAULT NULL;
ALTER TABLE users ADD COLUMN equipped_badge  VARCHAR(50)  DEFAULT NULL;
ALTER TABLE users ADD COLUMN equipped_title  VARCHAR(50)  DEFAULT NULL;
ALTER TABLE users ADD COLUMN email_verified  TINYINT(1)   NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN banned_at       DATETIME     DEFAULT NULL;
ALTER TABLE users ADD COLUMN ban_reason      TEXT         DEFAULT NULL;
ALTER TABLE problems ADD COLUMN visibility   ENUM('global','contest') NOT NULL DEFAULT 'global';
ALTER TABLE problems ADD COLUMN contest_id   INT DEFAULT NULL;
CREATE UNIQUE INDEX idx_oauth ON users(oauth_provider, oauth_id);

-- Team System
CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  owner_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  role ENUM('admin', 'member') DEFAULT 'member',
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_invites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  token VARCHAR(100) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);
