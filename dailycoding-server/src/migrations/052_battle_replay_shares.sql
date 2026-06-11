-- 052: public shareable battle replays
-- Each completed AlgorithmBattle room can be exposed via a public slug. The
-- replay itself is still served from battle_events; this table just maps slug
-- to room_id so the share URL stays opaque.

CREATE TABLE IF NOT EXISTS battle_replay_shares (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  room_id    INT          NOT NULL,
  slug       VARCHAR(40)  NOT NULL,
  created_by INT          NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_slug (slug),
  UNIQUE KEY uniq_room (room_id),
  INDEX idx_created_by (created_by),
  FOREIGN KEY (room_id)    REFERENCES battle_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)        ON DELETE SET NULL
);
