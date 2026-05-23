-- Remove orphan reward_items (codes not in current seed list, not earned by any user)
DELETE FROM reward_items
WHERE code NOT IN (
  'badge_bronze','badge_silver','badge_gold','badge_platinum','badge_emerald',
  'badge_diamond','badge_master','badge_grandmaster','badge_challenger',
  'badge_first_solve','badge_solve10','badge_solve50','badge_solve100','badge_solve200','badge_solve500',
  'badge_streak_7','badge_streak_30','badge_streak100','badge_streak365',
  'badge_xp_rookie','badge_xp_climber','badge_xp_veteran','badge_xp_master',
  'badge_battle_win','badge_battle_5wins','badge_battle_10wins','badge_battle_20wins',
  'badge_speedrun','badge_nightowl','badge_gold_killer','badge_multilang',
  'title_bronze','title_silver','title_gold','title_platinum','title_diamond',
  'title_routine_builder','title_debug_maker'
)
AND id NOT IN (SELECT reward_id FROM user_rewards WHERE reward_id IS NOT NULL);

-- Backfill description_ko for current seed codes where it is NULL
UPDATE reward_items SET description_ko = CASE code
  WHEN 'badge_bronze'        THEN '브론즈 티어에 도달했습니다.'
  WHEN 'badge_silver'        THEN '실버 티어에 도달했습니다.'
  WHEN 'badge_gold'          THEN '골드 티어에 도달했습니다.'
  WHEN 'badge_platinum'      THEN '플래티넘 티어에 도달했습니다.'
  WHEN 'badge_emerald'       THEN '에메랄드 티어에 도달했습니다.'
  WHEN 'badge_diamond'       THEN '다이아몬드 티어에 도달했습니다.'
  WHEN 'badge_master'        THEN '마스터 티어에 도달했습니다.'
  WHEN 'badge_grandmaster'   THEN '그랜드마스터 티어에 도달했습니다.'
  WHEN 'badge_challenger'    THEN '서버 TOP 3에 이름을 올렸습니다.'
  WHEN 'badge_first_solve'   THEN '첫 번째 문제를 풀었습니다.'
  WHEN 'badge_solve10'       THEN '문제 10개를 해결했습니다.'
  WHEN 'badge_solve50'       THEN '문제 50개를 해결했습니다.'
  WHEN 'badge_solve100'      THEN '문제 100개를 해결했습니다.'
  WHEN 'badge_solve200'      THEN '문제 200개를 해결했습니다.'
  WHEN 'badge_solve500'      THEN '문제 500개를 해결한 전설의 코더.'
  WHEN 'badge_streak_7'      THEN '7일 연속으로 문제를 풀었습니다.'
  WHEN 'badge_streak_30'     THEN '30일 연속으로 문제를 풀었습니다.'
  WHEN 'badge_streak100'     THEN '100일 연속으로 문제를 풀었습니다.'
  WHEN 'badge_streak365'     THEN '전설적인 365일 연속 기록.'
  WHEN 'badge_xp_rookie'     THEN 'XP 레벨 2에 도달했습니다.'
  WHEN 'badge_xp_climber'    THEN 'XP 레벨 5에 도달했습니다.'
  WHEN 'badge_xp_veteran'    THEN 'XP 레벨 10에 도달했습니다.'
  WHEN 'badge_xp_master'     THEN 'XP 레벨 20에 도달했습니다.'
  WHEN 'badge_battle_win'    THEN '첫 번째 배틀에서 승리했습니다.'
  WHEN 'badge_battle_5wins'  THEN '배틀에서 5승을 달성했습니다.'
  WHEN 'badge_battle_10wins' THEN '배틀에서 10승을 달성했습니다.'
  WHEN 'badge_battle_20wins' THEN '배틀 20승을 달성한 지배자.'
  WHEN 'badge_speedrun'      THEN '10분 이내에 문제를 풀었습니다.'
  WHEN 'badge_nightowl'      THEN '자정~새벽 4시 사이에 문제를 풀었습니다.'
  WHEN 'badge_gold_killer'   THEN '골드 이상 문제를 처음으로 풀었습니다.'
  WHEN 'badge_multilang'     THEN '3개 이상의 언어로 정답을 제출했습니다.'
  WHEN 'title_bronze'        THEN '브론즈 달성'
  WHEN 'title_silver'        THEN '실버 달성'
  WHEN 'title_gold'          THEN '골드 달성'
  WHEN 'title_platinum'      THEN '플래티넘 달성'
  WHEN 'title_diamond'       THEN '다이아몬드 달성'
  WHEN 'title_routine_builder' THEN 'XP 레벨 3 달성'
  WHEN 'title_debug_maker'   THEN 'XP 레벨 7 달성'
  ELSE description_ko
END
WHERE description_ko IS NULL;
