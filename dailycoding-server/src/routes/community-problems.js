import { Router } from 'express';
import { auth, adminOnly, requireVerified } from '../middleware/auth.js';
import { CommunityProblem } from '../models/CommunityProblem.js';
import { Problem } from '../models/Problem.js';
import { redis } from '../config/redis.js';
import { Notification } from '../models/Notification.js';
import { TIER_ORDER } from '../shared/constants.js';

const ALLOWED_PROBLEM_TYPES = new Set(['coding', 'fill-blank', 'bug-fix']);
const MAX_TESTCASES = 100;
const MAX_TC_FIELD_LEN = 50_000;

function validateCases(arr) {
  if (!Array.isArray(arr)) return;
  if (arr.length > MAX_TESTCASES) throw new Error('Too many test cases.');
  for (const tc of arr) {
    const inp = String(tc?.input || '');
    const out = String(tc?.output || '');
    if (inp.length > MAX_TC_FIELD_LEN || out.length > MAX_TC_FIELD_LEN) {
      throw new Error('Test case field is too large.');
    }
  }
}

const router = Router();

const ALLOWED_SUBMIT_TIERS = new Set(['unranked', 'bronze', 'silver', 'gold', 'platinum', 'diamond']);

// POST /api/community-problems — 유저가 문제 제출
router.post('/', auth, requireVerified, async (req, res) => {
  try {
    const { title, description, hint, inputDesc, outputDesc, examples, testcases, tier, problemType, difficulty, tags } = req.body;
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }
    const safeTier = ALLOWED_SUBMIT_TIERS.has(tier) ? tier : 'unranked';
    const safeType = ALLOWED_PROBLEM_TYPES.has(problemType) ? problemType : 'coding';
    const safeDiff = Math.max(1, Math.min(10, parseInt(difficulty) || 5));
    const id = await CommunityProblem.create({
      userId: req.user.id,
      title: title.trim(),
      description: description.trim(),
      hint, inputDesc, outputDesc,
      examples: Array.isArray(examples) ? examples.slice(0, 20) : [],
      testcases: Array.isArray(testcases) ? testcases.slice(0, 50) : [],
      tier: safeTier,
      problemType: safeType,
      difficulty: safeDiff,
      tags: Array.isArray(tags) ? tags.slice(0, 20) : [],
    });
    res.status(201).json({ id, message: 'Problem submitted for review.' });
  } catch (err) {
    console.error('[community-problems/create]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/community-problems — 내가 제출한 문제 목록
router.get('/', auth, async (req, res) => {
  try {
    const rows = await CommunityProblem.findByUser(req.user.id);
    res.json(rows);
  } catch (err) {
    console.error('[community-problems/list]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/community-problems/admin — 어드민: 전체 목록
router.get('/admin', auth, adminOnly, async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const [rows, total] = await Promise.all([
      CommunityProblem.findPending({ status, limit, offset }),
      CommunityProblem.countByStatus(status),
    ]);
    res.json({ rows, total });
  } catch (err) {
    console.error('[community-problems/admin/list]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/community-problems/admin/:id — 어드민: 상세 조회
router.get('/admin/:id', auth, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid id.' });
    const row = await CommunityProblem.findById(id);
    if (!row) return res.status(404).json({ message: 'Submitted problem not found.' });
    res.json(row);
  } catch (err) {
    console.error('[community-problems/admin/detail]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/community-problems/admin/:id/approve — 어드민: 승인 및 문제 등록
router.post('/admin/:id/approve', auth, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid id.' });
    const submission = await CommunityProblem.findById(id);
    if (!submission) return res.status(404).json({ message: 'Submission not found.' });
    if (submission.status !== 'pending') return res.status(400).json({ message: 'This submission has already been processed.' });

    // validate submission fields before registering as official problem
    if (!TIER_ORDER.includes(submission.tier)) return res.status(400).json({ message: 'Invalid tier value.' });
    if (!ALLOWED_PROBLEM_TYPES.has(submission.problem_type)) return res.status(400).json({ message: 'Invalid problemType.' });
    const diff = Number(submission.difficulty);
    if (!Number.isInteger(diff) || diff < 1 || diff > 10) return res.status(400).json({ message: 'Invalid difficulty value.' });
    try {
      validateCases(submission.examples);
      validateCases(submission.testcases);
    } catch (ve) {
      return res.status(400).json({ message: ve.message });
    }

    const newProblem = await Problem.create({
      title: submission.title,
      desc: submission.description,
      hint: submission.hint || '',
      inputDesc: submission.input_desc || '',
      outputDesc: submission.output_desc || '',
      examples: Array.isArray(submission.examples) ? submission.examples : [],
      testcases: Array.isArray(submission.testcases) ? submission.testcases : [],
      tier: submission.tier,
      problemType: submission.problem_type,
      difficulty: submission.difficulty,
      tags: Array.isArray(submission.tags) ? submission.tags : [],
      timeLimit: 2,
      memLimit: 256,
      visibility: 'global',
      contestId: null,
      specialConfig: null,
    }, req.user.id);

    const newProblemId = newProblem?.id || null;

    try {
      await CommunityProblem.approve(submission.id, req.user.id, newProblemId);
    } catch (approveErr) {
      // compensate: log orphan so operator can clean up
      console.error(`[community-problems/approve] CommunityProblem.approve failed after Problem.create (orphan problemId=${newProblemId}):`, approveErr.message);
      return res.status(500).json({ message: 'An error occurred while approving the submission.' });
    }

    // 제출자에게 알림
    await Notification.create(
      submission.user_id,
      `✅ Your submitted problem "${submission.title}" has been approved and published!`,
      newProblemId ? `/problems/${newProblemId}` : '/problems'
    );

    // 캐시 무효화
    await redis.clearPrefix('problems:list:');

    res.json({ message: 'Problem has been approved and published.', problemId: newProblemId });
  } catch (err) {
    console.error('[community-problems/approve]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/community-problems/admin/:id/reject — 어드민: 반려
router.post('/admin/:id/reject', auth, adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid id.' });
    const submission = await CommunityProblem.findById(id);
    if (!submission) return res.status(404).json({ message: 'Submission not found.' });
    if (submission.status !== 'pending') return res.status(400).json({ message: 'This submission has already been processed.' });

    const note = (req.body.note || '').toString().trim().slice(0, 500);
    await CommunityProblem.reject(submission.id, req.user.id, note);

    await Notification.create(
      submission.user_id,
      `❌ Your problem submission "${submission.title}" has been rejected.${note ? ` Reason: ${note}` : ''}`,
      '/submit-problem'
    );

    res.json({ message: 'Rejected.' });
  } catch (err) {
    console.error('[community-problems/reject]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
