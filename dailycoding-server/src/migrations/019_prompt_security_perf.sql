CREATE INDEX idx_submissions_user_result_date ON submissions(user_id, result, submitted_at);
CREATE INDEX idx_problems_tier_type ON problems(tier, problem_type);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read, created_at);
