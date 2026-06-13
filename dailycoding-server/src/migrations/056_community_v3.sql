-- 056: Community v3 — image attachments, upvote/downvote, concept posts.
-- image_url: single primary image URL (under /uploads/community/).
-- dislike_count: downvote counter; score = like_count - dislike_count is computed in queries.
-- post_likes.vote: -1 (downvote) | 1 (upvote). Existing rows default to 1 (legacy likes).

ALTER TABLE posts ADD COLUMN image_url VARCHAR(500) NULL AFTER lang;
ALTER TABLE posts ADD COLUMN dislike_count INT NOT NULL DEFAULT 0;

ALTER TABLE post_likes ADD COLUMN vote TINYINT NOT NULL DEFAULT 1;

CREATE INDEX idx_posts_board_score ON posts (board_type, like_count DESC, created_at DESC);
