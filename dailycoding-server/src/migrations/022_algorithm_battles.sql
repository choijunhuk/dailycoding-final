CREATE TABLE IF NOT EXISTS battle_rooms (
  id           VARCHAR(40) PRIMARY KEY,
  mode         VARCHAR(40) NOT NULL DEFAULT 'sort-speed',
  problem_id   INT DEFAULT NULL,
  status       ENUM('waiting','playing','finished') NOT NULL DEFAULT 'waiting',
  max_players  INT NOT NULL DEFAULT 2,
  duration_sec INT NOT NULL DEFAULT 180,
  started_at   DATETIME DEFAULT NULL,
  ended_at     DATETIME DEFAULT NULL,
  created_by   INT DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_battle_rooms_status_created (status, created_at)
);

CREATE TABLE IF NOT EXISTS battle_participants (
  room_id        VARCHAR(40) NOT NULL,
  user_id        INT NOT NULL,
  character_hp   INT NOT NULL DEFAULT 100,
  attack_power   INT NOT NULL DEFAULT 10,
  speed          INT NOT NULL DEFAULT 10,
  score          INT NOT NULL DEFAULT 0,
  is_ready       TINYINT(1) NOT NULL DEFAULT 0,
  joined_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES battle_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS battle_submissions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  room_id           VARCHAR(40) NOT NULL,
  user_id           INT NOT NULL,
  code              LONGTEXT,
  language          VARCHAR(50),
  is_correct        TINYINT(1) NOT NULL DEFAULT 0,
  execution_time_ms INT DEFAULT NULL,
  memory_mb         FLOAT DEFAULT NULL,
  score             INT NOT NULL DEFAULT 0,
  detail            TEXT,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES battle_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_battle_sub_room_user (room_id, user_id, created_at)
);

CREATE TABLE IF NOT EXISTS battle_events (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  room_id      VARCHAR(40) NOT NULL,
  user_id      INT DEFAULT NULL,
  event_type   VARCHAR(50) NOT NULL,
  payload_json JSON DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES battle_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_battle_events_room_created (room_id, created_at)
);

CREATE TABLE IF NOT EXISTS battle_results (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  room_id            VARCHAR(40) NOT NULL,
  user_id            INT NOT NULL,
  rank_no            INT NOT NULL,
  score              INT NOT NULL DEFAULT 0,
  result             ENUM('win','lose','draw') NOT NULL DEFAULT 'draw',
  battle_score_delta INT NOT NULL DEFAULT 0,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_battle_result_room_user (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES battle_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO problems (
  id, title, problem_type, preferred_language, tier, difficulty, time_limit, mem_limit,
  description, input_desc, output_desc, hint, solution, visibility, is_premium, created_at
)
SELECT
  900001,
  '정렬 배틀: 숫자 정렬',
  'coding',
  'python',
  'bronze',
  3,
  2,
  256,
  '공백으로 구분된 정수들을 오름차순으로 정렬해 출력하세요. 실행 시간이 빠를수록 배틀 점수가 높아집니다.',
  '첫 줄에 N, 둘째 줄에 N개의 정수가 주어집니다.',
  '정렬된 정수를 공백으로 구분해 출력합니다.',
  '입력 크기가 커질 수 있으니 효율적인 정렬을 사용하세요.',
  '',
  'global',
  0,
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM problems WHERE id = 900001);

INSERT INTO problem_examples (problem_id, input_data, output_data, ord)
SELECT 900001, '5\n5 1 4 2 3\n', '1 2 3 4 5', 0
WHERE NOT EXISTS (SELECT 1 FROM problem_examples WHERE problem_id = 900001 AND ord = 0);

INSERT INTO problem_testcases (problem_id, input_data, output_data, ord)
SELECT 900001, '8\n9 -1 3 3 0 8 2 1\n', '-1 0 1 2 3 3 8 9', 0
WHERE NOT EXISTS (SELECT 1 FROM problem_testcases WHERE problem_id = 900001 AND ord = 0);

INSERT INTO problem_testcases (problem_id, input_data, output_data, ord)
SELECT 900001, '10\n10 9 8 7 6 5 4 3 2 1\n', '1 2 3 4 5 6 7 8 9 10', 1
WHERE NOT EXISTS (SELECT 1 FROM problem_testcases WHERE problem_id = 900001 AND ord = 1);
