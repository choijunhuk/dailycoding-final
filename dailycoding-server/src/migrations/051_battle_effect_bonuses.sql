-- Persistent buff/debuff stat from problem effects, separated from scoring-driven stat.
ALTER TABLE battle_participants ADD COLUMN effect_attack_bonus INT NOT NULL DEFAULT 0;
ALTER TABLE battle_participants ADD COLUMN effect_speed_bonus  INT NOT NULL DEFAULT 0;
