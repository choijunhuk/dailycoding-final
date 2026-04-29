-- 009_dump_anonymous.sql
-- dump_posts / dump_replies 에 is_anonymous 컬럼 추가
-- 기존 레코드는 모두 익명(1)으로 유지

ALTER TABLE dump_posts
  ADD COLUMN IF NOT EXISTS is_anonymous TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '1=익명(ㅇㅇ) / 0=실명(고닉)';

ALTER TABLE dump_replies
  ADD COLUMN IF NOT EXISTS is_anonymous TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '1=익명(ㅇㅇ) / 0=실명(고닉)';
