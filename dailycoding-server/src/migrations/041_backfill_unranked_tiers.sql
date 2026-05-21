UPDATE users
SET tier = CASE
  WHEN COALESCE(rating, 0) >= 16000 THEN 'grandmaster'
  WHEN COALESCE(rating, 0) >= 15000 THEN 'master'
  WHEN COALESCE(rating, 0) >= 13500 THEN 'diamond'
  WHEN COALESCE(rating, 0) >= 10000 THEN 'emerald'
  WHEN COALESCE(rating, 0) >= 6000 THEN 'platinum'
  WHEN COALESCE(rating, 0) >= 2800 THEN 'gold'
  WHEN COALESCE(rating, 0) >= 1000 THEN 'silver'
  WHEN COALESCE(rating, 0) >= 300 THEN 'bronze'
  WHEN COALESCE(rating, 0) >= 1 THEN 'iron'
  ELSE 'unranked'
END
WHERE (tier = 'unranked' OR tier IS NULL OR tier = '')
  AND COALESCE(rating, 0) >= 1;
