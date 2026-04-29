ALTER TABLE users ADD COLUMN default_language VARCHAR(20) DEFAULT 'python';
ALTER TABLE users ADD COLUMN submissions_public TINYINT(1) NOT NULL DEFAULT 1;
