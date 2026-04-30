-- Migration 002: Tier system redesign
-- 'unranked' 추가, 기본 레이팅 0으로 변경, 기본 tier를 unranked로

ALTER TABLE users MODIFY tier ENUM('unranked','iron','bronze','silver','gold','platinum','emerald','diamond','master','grandmaster','challenger') NOT NULL DEFAULT 'unranked';
ALTER TABLE users MODIFY rating INT NOT NULL DEFAULT 0;

-- avatar_color 컬럼 추가 (프로필 커스터마이징)
ALTER TABLE users ADD COLUMN avatar_color VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN avatar_emoji VARCHAR(10) DEFAULT NULL;
