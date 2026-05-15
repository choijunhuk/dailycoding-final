ALTER TABLE code_reviews
  MODIFY COLUMN status ENUM('open','approved','rejected','merged','cancelled') NOT NULL DEFAULT 'open';
