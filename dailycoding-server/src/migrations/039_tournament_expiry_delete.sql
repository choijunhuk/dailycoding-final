ALTER TABLE tournaments MODIFY status ENUM('open','in_progress','complete','expired') NOT NULL DEFAULT 'open';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS expires_at DATETIME DEFAULT NULL;
UPDATE tournaments SET expires_at = DATE_ADD(created_at, INTERVAL 24 HOUR) WHERE expires_at IS NULL;
