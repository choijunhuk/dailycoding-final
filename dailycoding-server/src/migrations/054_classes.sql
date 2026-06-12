-- 054: B2B classroom mode.
-- classes: a teacher (owner_id) creates a class with an invite_code.
-- class_members: students joined via invite_code, role 'student' or 'co_teacher'.
-- class_assignments: teacher assigns problems to a class with optional due dates.

CREATE TABLE IF NOT EXISTS classes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  owner_id     INT          NOT NULL,
  name         VARCHAR(120) NOT NULL,
  description  TEXT,
  invite_code  VARCHAR(20)  NOT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at  DATETIME     NULL,
  UNIQUE KEY uniq_invite_code (invite_code),
  INDEX idx_owner (owner_id),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS class_members (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  class_id    INT          NOT NULL,
  user_id     INT          NOT NULL,
  role        ENUM('student','co_teacher') NOT NULL DEFAULT 'student',
  joined_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_class_user (class_id, user_id),
  INDEX idx_user (user_id),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS class_assignments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  class_id    INT          NOT NULL,
  problem_id  INT          NOT NULL,
  assigned_by INT          NOT NULL,
  due_at      DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_class_due (class_id, due_at),
  FOREIGN KEY (class_id)    REFERENCES classes(id)  ON DELETE CASCADE,
  FOREIGN KEY (problem_id)  REFERENCES problems(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id)    ON DELETE CASCADE
);
