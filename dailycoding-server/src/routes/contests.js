import { Router }      from 'express';
import { Contest }     from '../models/Contest.js';
import { Notification }from '../models/Notification.js';
import { auth, adminOnly, requireVerified } from '../middleware/auth.js';
import { validateBody, contestSchema } from '../middleware/validate.js';
import { MIN_HIDDEN_TESTCASES } from '../shared/problemCatalog.js';
import { query } from '../config/mysql.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';

const router = Router();

function countFilledHiddenTestcases(testcases) {
  if (!Array.isArray(testcases)) return 0;
  return testcases.filter((item) => (item?.input || '').trim() || (item?.output || '').trim()).length;
}

function normalizeContestText(value, maxLength = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeRewardRulesInput(rules = []) {
  if (!Array.isArray(rules)) return [];
  const dedupe = new Set();
  const normalized = [];
  for (const raw of rules.slice(0, 30)) {
    const rankFrom = Math.max(1, Number.parseInt(raw?.rankFrom, 10) || 1);
    const rankTo = Math.max(rankFrom, Number.parseInt(raw?.rankTo, 10) || rankFrom);
    const rewardCode = normalizeContestText(raw?.rewardCode, 50);
    if (!rewardCode) continue;
    const key = `${rankFrom}:${rankTo}:${rewardCode}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    normalized.push({ rankFrom, rankTo, rewardCode });
  }
  return normalized;
}

async function getProblemModel() {
  const { Problem } = await import('../models/Problem.js');
  return Problem;
}

async function loadContestNotificationUserIds() {
  const rows = await query('SELECT id FROM users WHERE role != ? AND email_verified = 1', ['admin']);
  return (rows || []).map((row) => row.id);
}

router.get('/', auth, async (req, res) => {
  try {
    const contests = await Contest.findAll(req.query.status, req.query.q);
    const ids = contests.map((contest) => contest.id);
    const statusMap = ids.length > 0 ? await Contest.getMyStatuses(req.user.id, ids) : new Map();
    const enriched = contests.map((contest) => ({
      ...contest,
      myStatus: statusMap.get(contest.id) || null,
    }));
    res.json(enriched);
  }
  catch (err) { console.error('[contests/list]', err.message); return internalError(res); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const c = await Contest.findById(Number(req.params.id));
    if (!c) return errorResponse(res, 404, 'NOT_FOUND', '대회 없음');
    res.json(c);
  } catch (err) {
    console.error('[contests/detail]', err.message);
    return internalError(res);
  }
});

router.post('/', auth, adminOnly, validateBody(contestSchema), async (req, res) => {
  try {
    const { name, description, duration, privacy, joinType, securityCode, max, rewardRules } = req.body;
    const privacyVal = (privacy === '비공개' || privacy === 'private') ? 'private' : 'public';
    const normalizedRules = normalizeRewardRulesInput(rewardRules);
    const c = await Contest.create({ 
      name: normalizeContestText(name, 100), 
      description: normalizeContestText(description || '', 1000), 
      durationMin: Number(duration)||60, 
      privacy: privacyVal, 
      joinType: joinType || 'direct',
      securityCode: normalizeContestText(securityCode || '', 100) || null,
      maxUsers: Number(max)||20, 
      hostId: req.user.id,
      rewardRules: normalizedRules,
    });
    const userIds = await loadContestNotificationUserIds();
    await Notification.broadcast(userIds, `🏆 새 대회 "${name}" 등록!`, 'contest');
    res.status(201).json(c);
  } catch (err) { console.error('[contests/create]', err.message); return internalError(res); }
});

router.patch('/:id/start', auth, adminOnly, async (req, res) => {
  try {
    const c = await Contest.updateStatus(Number(req.params.id), 'running');
    if (!c) return errorResponse(res, 404, 'NOT_FOUND', '대회 없음');
    const userIds = await loadContestNotificationUserIds();
    await Notification.broadcast(userIds, `🔴 "${c.name}" 대회가 시작됐습니다!`, 'contest');
    res.json(c);
  } catch (err) { console.error('[contests/start]', err.message); return internalError(res); }
});

router.patch('/:id/end', auth, adminOnly, async (req, res) => {
  try {
    const c = await Contest.updateStatus(Number(req.params.id), 'ended');
    if (!c) return errorResponse(res, 404, 'NOT_FOUND', '대회 없음');

    const board = await Contest.getLeaderboard(Number(req.params.id));
    const grants = await Contest.grantRankRewards(Number(req.params.id), board);
    for (const grant of grants) {
      await Notification.create(
        grant.userId,
        `🏆 대회 "${c.name}" ${grant.rankPosition}위 보상(${grant.rewardCode})이 지급됐습니다.`,
        'contest'
      );
    }

    res.json({ ...c, grantedRewards: grants.length });
  } catch (err) { console.error('[contests/end]', err.message); return internalError(res); }
});

router.get('/:id/rewards', auth, async (req, res) => {
  try {
    const contestId = Number(req.params.id);
    const contest = await Contest.findById(contestId);
    if (!contest) return errorResponse(res, 404, 'NOT_FOUND', '대회 없음');
    const rewardRules = await Contest.getEffectiveRewardRules(contestId);
    res.json({ contestId, rewardRules, hasCustomRules: contest.rewardRules?.length > 0 });
  } catch (err) {
    console.error('[contests/rewards/get]', err.message);
    return internalError(res);
  }
});

router.patch('/:id/rewards', auth, adminOnly, async (req, res) => {
  try {
    const contestId = Number(req.params.id);
    const contest = await Contest.findById(contestId);
    if (!contest) return errorResponse(res, 404, 'NOT_FOUND', '대회 없음');
    const normalizedRules = normalizeRewardRulesInput(req.body?.rewardRules);
    const saved = await Contest.setRewardRules(contestId, normalizedRules);
    res.json({ contestId, rewardRules: saved });
  } catch (err) {
    console.error('[contests/rewards/patch]', err.message);
    return internalError(res);
  }
});

router.post('/:id/join', auth, requireVerified, async (req, res) => {
  try {
    const { securityCode } = req.body;
    const c = await Contest.findById(Number(req.params.id));
    if (!c) return errorResponse(res, 404, 'NOT_FOUND', '대회 없음');
    if (c.status === 'ended') return errorResponse(res, 400, 'VALIDATION_ERROR', '종료된 대회입니다.');
    
    // 비공개 대회 보안코드 체크
    if (c.privacy === '비공개' && c.securityCode && c.securityCode !== securityCode) {
      return errorResponse(res, 401, 'UNAUTHORIZED', '보안 코드가 일치하지 않습니다.');
    }

    const joinedInfo = await Contest.isJoined(c.id, req.user.id);
    if (joinedInfo?.status === 'joined') return errorResponse(res, 400, 'VALIDATION_ERROR', '이미 참가했습니다.');
    if (joinedInfo?.status === 'pending') return errorResponse(res, 400, 'VALIDATION_ERROR', '승인 대기 중입니다.');
    
    const cnt = await Contest.getParticipantCount(c.id);
    if (cnt >= (c.max||20)) return errorResponse(res, 400, 'VALIDATION_ERROR', '정원이 찼습니다.');
    
    if (c.joinType === 'approval') {
      await Contest.createJoinRequest(c.id, req.user.id);
      return res.json({ status: 'pending', message: '참가 신청이 완료되었습니다. 관리자 승인을 기다려주세요.' });
    } else {
      await Contest.join(c.id, req.user.id);
      await Notification.create(req.user.id, `✅ "${c.name}" 참가 완료!`, 'contest');
      return res.json({ status: 'joined', message: '참가 완료' });
    }
  } catch (err) { console.error('[contests/join]', err.message); return internalError(res); }
});

router.get('/:id/requests', auth, adminOnly, async (req, res) => {
  try {
    const requests = await Contest.getJoinRequests(Number(req.params.id));
    res.json(requests);
  } catch (err) { console.error('[contests/requests]', err.message); return internalError(res); }
});

router.patch('/:id/requests/:reqId', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', '잘못된 상태값');
    }
    await Contest.updateJoinRequestStatus(Number(req.params.reqId), status);
    res.json({ message: status === 'approved' ? '승인되었습니다.' : '거절되었습니다.' });
  } catch (err) { console.error('[contests/requests/update]', err.message); return internalError(res); }
});

router.get('/:id/leaderboard', auth, async (req, res) => {
  try { res.json(await Contest.getLeaderboard(Number(req.params.id))); }
  catch (err) {
    console.error('[contests/leaderboard]', err.message);
    return internalError(res);
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await Contest.delete(Number(req.params.id));
    res.json({ message: '삭제됐습니다.' });
  } catch (err) { console.error('[contests/delete]', err.message); return internalError(res, '삭제 실패'); }
});

// ── 대회 문제 관리 ────────────────────────────────────────────
router.get('/:id/problems', auth, async (req, res) => {
  try { res.json(await Contest.getProblems(Number(req.params.id))); }
  catch (err) {
    console.error('[contests/problems/get]', err.message);
    return internalError(res);
  }
});

router.post('/:id/problems', auth, adminOnly, async (req, res) => {
  const { problemId } = req.body;
  if (!problemId) return errorResponse(res, 400, 'VALIDATION_ERROR', 'problemId 필요');
  try {
    await Contest.addProblem(Number(req.params.id), Number(problemId));
    res.json({ message: '문제 추가됨' });
  } catch (err) { console.error('[contests/problems/add]', err.message); return internalError(res); }
});

router.post('/:id/problems/custom', auth, adminOnly, async (req, res) => {
  try {
    const contestId = Number(req.params.id);
    const contest = await Contest.findById(contestId);
    if (!contest) return errorResponse(res, 404, 'NOT_FOUND', '대회 없음');
    const hiddenCount = countFilledHiddenTestcases(req.body?.testcases);
    if (hiddenCount < MIN_HIDDEN_TESTCASES) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', `히든 테스트케이스는 최소 ${MIN_HIDDEN_TESTCASES}개 필요합니다.`);
    }

    const Problem = await getProblemModel();
    const created = await Problem.create({
      ...req.body,
      visibility: 'contest',
      contestId,
    }, req.user.id);
    await Contest.addProblem(contestId, created.id);
    res.status(201).json(created);
  } catch (err) {
    console.error('[contests/problems/custom]', err.message);
    return internalError(res);
  }
});

router.delete('/:id/problems/:pid', auth, adminOnly, async (req, res) => {
  try {
    const contestId = Number(req.params.id);
    const problemId = Number(req.params.pid);
    const Problem = await getProblemModel();
    const problem = await Problem.findById(problemId);
    await Contest.removeProblem(contestId, problemId);
    if (problem?.visibility === 'contest' && Number(problem.contestId) === contestId) {
      await Problem.delete(problemId);
    }
    res.json({ message: '문제 제거됨' });
  } catch (err) { console.error('[contests/problems/remove]', err.message); return internalError(res); }
});

export default router;
