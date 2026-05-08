-- 024: Battle system improvements
-- Adds territory mode, private rooms, lobby timeout, preferred language

ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS is_private TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS invite_code VARCHAR(8) DEFAULT NULL;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS problem_ids JSON DEFAULT NULL;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS territory_claims JSON DEFAULT NULL;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20) DEFAULT NULL;
ALTER TABLE battle_rooms ADD COLUMN IF NOT EXISTS lobby_expires_at DATETIME DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_battle_rooms_invite_code ON battle_rooms (invite_code);
