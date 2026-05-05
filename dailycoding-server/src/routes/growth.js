import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { query } from '../config/mysql.js';
import { Submission } from '../models/Submission.js';

const router = Router();
router.use(auth);
router.use(requireVerified);

const ROLE_SETS = [
  {
    id: 'backend-junior',
    title: '백엔드 신입 코딩테스트 스타일',
    focus: ['구현', '문자열', '해시', 'SQL 사고'],
    description: '입출력 정확도, 자료구조 선택, 예외 케이스 대응을 보는 세트입니다.',
  },
  {
    id: 'frontend-js',
    title: '프론트엔드 JavaScript 스타일',
    focus: ['배열', '문자열', '정렬', '객체 처리'],
    description: 'JS 배열/문자열 조작과 브라우저 과제 전 사고력을 함께 훈련합니다.',
  },
  {
    id: 'cs-core',
    title: '자료구조 집중 스타일',
    focus: ['스택', '큐', '그래프', '트리'],
    description: '면접에서 설명하기 쉬운 핵심 자료구조 문제로 구성합니다.',
  },
];

const AI_INTERVIEW = {
  title: 'AI 모의 면접',
  flow: [
    '제한 시간 안에 한 문제를 풉니다.',
    '풀이 접근을 3문장으로 설명합니다.',
    'AI가 시간복잡도, 엣지 케이스, 대안 풀이를 꼬리질문합니다.',
    '정확성, 설명력, 시간 관리 기준으로 리포트를 받습니다.',
  ],
  rubric: ['정확성', '복잡도 설명', '디버깅 태도', '커뮤니케이션'],
};

const HINT_LADDER = [
  { step: 1, title: '방향 힌트', description: '문제에서 무엇을 관찰해야 하는지만 알려줍니다.' },
  { step: 2, title: '알고리즘 힌트', description: '적합한 자료구조나 알고리즘 이름과 이유를 알려줍니다.' },
  { step: 3, title: '구현 전략', description: '의사코드 수준의 순서만 제공하고 정답 코드는 숨깁니다.' },
];

function rowsToProblems(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    tier: row.tier || 'unranked',
    difficulty: row.difficulty ?? null,
    tags: String(row.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 5),
    reason: row.reason || '아직 해결하지 않은 추천 문제입니다.',
  }));
}

async function getWeeklyPlan(userId) {
  const recovery = await Submission.getRecoveryQueue(userId, { limit: 3 });
  const rows = await query(
    `SELECT p.id, p.title, p.tier, p.difficulty,
            GROUP_CONCAT(DISTINCT pt.tag ORDER BY pt.tag SEPARATOR ',') AS tags
     FROM problems p
     LEFT JOIN problem_tags pt ON pt.problem_id = p.id
     WHERE COALESCE(p.visibility, 'global') = 'global'
       AND COALESCE(p.problem_type, 'coding') = 'coding'
       AND NOT EXISTS (
         SELECT 1
         FROM submissions s
         WHERE s.user_id = ?
           AND s.problem_id = p.id
           AND s.result = 'correct'
         LIMIT 1
       )
     GROUP BY p.id, p.title, p.tier, p.difficulty
     ORDER BY
       CASE p.tier
         WHEN 'bronze' THEN 1
         WHEN 'silver' THEN 2
         WHEN 'gold' THEN 3
         WHEN 'platinum' THEN 4
         ELSE 5
       END,
       p.difficulty ASC,
       p.id ASC
     LIMIT 8`,
    [userId]
  );

  const fresh = rowsToProblems(rows).slice(0, Math.max(0, 7 - recovery.length));
  const recoveryProblems = recovery.map((item) => ({
    id: item.problemId,
    title: item.problemTitle,
    tier: item.tier,
    difficulty: item.difficulty,
    tags: item.tags,
    reason: `${item.cause} 복구: ${item.action}`,
    recoverySubmissionId: item.submissionId,
  }));

  return {
    title: '이번 주 맞춤 학습 플랜',
    summary: '오답 복구 문제를 먼저 배치하고, 남은 칸은 아직 풀지 않은 적정 난이도 문제로 채웁니다.',
    days: [...recoveryProblems, ...fresh].slice(0, 7).map((problem, index) => ({
      day: index + 1,
      label: index < recoveryProblems.length ? '복구' : index < 5 ? '훈련' : '도전',
      ...problem,
    })),
  };
}

async function getBattleAnalysis(userId) {
  const rows = await query(
    `SELECT result, score_for, score_against, solved_for, solved_against, opponent_name, created_at
     FROM battle_history
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId]
  );
  const list = rows || [];
  const wins = list.filter((row) => row.result === 'win').length;
  const losses = list.filter((row) => row.result === 'lose').length;
  const draws = list.filter((row) => row.result === 'draw').length;
  const avgSolved = list.length
    ? Math.round(list.reduce((sum, row) => sum + Number(row.solved_for || 0), 0) / list.length * 10) / 10
    : 0;
  const latest = list[0] || null;

  return {
    total: list.length,
    wins,
    losses,
    draws,
    avgSolved,
    latest: latest ? {
      opponentName: latest.opponent_name || '상대',
      result: latest.result,
      scoreFor: latest.score_for,
      scoreAgainst: latest.score_against,
      solvedFor: latest.solved_for,
      solvedAgainst: latest.solved_against,
    } : null,
    insight: list.length === 0
      ? '아직 배틀 기록이 없습니다. 첫 배틀 후 승부가 갈린 지점을 분석합니다.'
      : losses > wins
        ? '최근 배틀은 속도보다 안정성이 먼저입니다. 오답 복구 후 같은 태그로 리매치를 추천합니다.'
        : '배틀 흐름이 좋습니다. 더 높은 난이도나 race 모드로 압박을 올려보세요.',
  };
}

async function getGrowthShareCard(userId) {
  const [rows] = await query(
    `SELECT u.username, u.tier, u.rating, u.streak, u.solved_count,
            COUNT(s.id) AS submissions,
            SUM(CASE WHEN s.result = 'correct' THEN 1 ELSE 0 END) AS correct
     FROM users u
     LEFT JOIN submissions s ON s.user_id = u.id
     WHERE u.id = ?
     GROUP BY u.id, u.username, u.tier, u.rating, u.streak, u.solved_count`,
    [userId]
  );
  const row = rows || {};
  const accuracy = Number(row.submissions || 0) > 0
    ? Math.round(Number(row.correct || 0) / Number(row.submissions || 1) * 100)
    : 0;
  return {
    username: row.username || 'DailyCoder',
    tier: row.tier || 'unranked',
    rating: Number(row.rating || 0),
    streak: Number(row.streak || 0),
    solvedCount: Number(row.solved_count || 0),
    accuracy,
    shareText: `${row.username || 'DailyCoder'}님의 DailyCoding 성장 기록: ${row.tier || 'unranked'} · ${Number(row.rating || 0)}점 · ${Number(row.streak || 0)}일 스트릭 · 정답률 ${accuracy}%`,
  };
}

router.get('/', async (req, res) => {
  try {
    const [weeklyPlan, battleAnalysis, shareCard, recoveryQueue] = await Promise.all([
      getWeeklyPlan(req.user.id),
      getBattleAnalysis(req.user.id),
      getGrowthShareCard(req.user.id),
      Submission.getRecoveryQueue(req.user.id, { limit: 5 }),
    ]);

    res.json({
      weeklyPlan,
      battleAnalysis,
      roleSets: ROLE_SETS,
      aiInterview: AI_INTERVIEW,
      shareCard,
      teamStudy: {
        title: '팀/스터디 과제 운영',
        steps: ['문제 세트를 고릅니다.', '마감일과 목표 정답률을 정합니다.', '팀 대시보드에서 멤버별 풀이 현황을 봅니다.'],
        cta: '/team',
      },
      discussionGuide: {
        title: '토론/해설 강화',
        rules: ['정답자는 접근법을 공유합니다.', 'DP/그리디/BFS 같은 풀이 전략을 태그로 남깁니다.', '좋은 해설은 팀이나 커뮤니티에서 재사용합니다.'],
        cta: '/community',
      },
      hintLadder: HINT_LADDER,
      examImprovement: {
        title: '실전 시험 모드 개선',
        checks: ['시간 초과 문제', '오답 문제', '빈 문제', '약한 태그'],
        recommendation: recoveryQueue.length > 0
          ? '시험 전 오답 복구 큐를 먼저 비우고 같은 태그 시험을 다시 보세요.'
          : '현재 오답 복구 큐가 비어 있습니다. 모의 코테로 새 약점을 찾으세요.',
        cta: '/exams',
      },
      excludedRewardMission: {
        title: '랭킹과 분리된 성장 보상',
        explanation: '일일 미션 보상은 권위가 걸린 랭킹 점수를 올리지 않습니다. XP를 쌓아 배지, 프로필 칭호, 프로필 배경 같은 개인 꾸미기 보상만 해금합니다.',
      },
    });
  } catch (err) {
    console.error('[growth-hub]', err);
    res.status(500).json({ message: '성장 허브를 불러오지 못했습니다.' });
  }
});

export default router;
