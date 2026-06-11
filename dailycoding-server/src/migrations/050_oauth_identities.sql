-- Multi-provider OAuth linking. Each user can link multiple providers (GitHub, Google, etc).
CREATE TABLE IF NOT EXISTS user_oauth_identities (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  provider    VARCHAR(20)  NOT NULL,
  oauth_id    VARCHAR(100) NOT NULL,
  linked_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_provider_oauth (provider, oauth_id),
  UNIQUE KEY uniq_user_provider  (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Backfill from legacy users.oauth_provider / users.oauth_id columns
INSERT IGNORE INTO user_oauth_identities (user_id, provider, oauth_id)
SELECT id, oauth_provider, oauth_id
FROM users
WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL;
