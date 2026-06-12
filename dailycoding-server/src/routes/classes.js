import { Router } from 'express';
import crypto from 'crypto';
import { auth, requireVerified } from '../middleware/auth.js';
import { query, queryOne, insert, run } from '../config/mysql.js';
import { errorResponse, internalError } from '../middleware/errorHandler.js';
import logger from '../config/logger.js';

const router = Router();

// MVP scope:
// - Teacher (anyone today; we'll gate by subscription_tier = 'team' later)
//   creates a class and gets an invite_code.
// - Students join by code, are listed under the class.
// - Teacher assigns problems with optional due dates.
// - Progress per student is computed at read time from the submissions table.
// - Billing flow (Stripe team plan) is deliberately deferred — operator
//   onboards initial pilots manually and toggles their team subscription via
//   POST /api/admin/subscription.

async function ensureClassOwner(classId, userId) {
  const cls = await queryOne('SELECT * FROM classes WHERE id = ?', [classId]);
  if (!cls) return { error: 'not_found' };
  if (cls.owner_id !== userId) return { error: 'forbidden' };
  return { cls };
}

async function ensureClassMember(classId, userId) {
  const member = await queryOne(
    'SELECT * FROM class_members WHERE class_id = ? AND user_id = ?',
    [classId, userId],
  );
  return !!member;
}

router.post('/', auth, requireVerified, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 120);
    if (!name) return errorResponse(res, 400, 'VALIDATION_ERROR', 'name is required.');
    const description = String(req.body?.description || '').slice(0, 1000);
    const inviteCode = crypto.randomBytes(4).toString('hex');
    const classId = await insert(
      'INSERT INTO classes (owner_id, name, description, invite_code) VALUES (?, ?, ?, ?)',
      [req.user.id, name, description, inviteCode],
    );
    // Owner auto-joins as co_teacher for member queries.
    await insert(
      'INSERT INTO class_members (class_id, user_id, role) VALUES (?, ?, ?)',
      [classId, req.user.id, 'co_teacher'],
    );
    return res.json({ id: classId, name, description, inviteCode });
  } catch (err) {
    logger.error('[classes/create]', { message: err.message });
    return internalError(res);
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT c.id, c.name, c.description, c.invite_code, c.created_at,
              cm.role AS my_role,
              (SELECT COUNT(*) FROM class_members WHERE class_id = c.id AND role = 'student') AS student_count
       FROM classes c
       JOIN class_members cm ON cm.class_id = c.id AND cm.user_id = ?
       WHERE c.archived_at IS NULL
       ORDER BY c.created_at DESC`,
      [req.user.id],
    );
    return res.json({ classes: rows || [] });
  } catch (err) {
    logger.error('[classes/list]', { message: err.message });
    return internalError(res);
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const classId = Number(req.params.id);
    if (!Number.isFinite(classId)) return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid class id.');
    if (!(await ensureClassMember(classId, req.user.id))) {
      return errorResponse(res, 403, 'FORBIDDEN', 'Not a class member.');
    }
    const cls = await queryOne('SELECT * FROM classes WHERE id = ?', [classId]);
    if (!cls) return errorResponse(res, 404, 'NOT_FOUND', 'Class not found.');
    const members = await query(
      `SELECT cm.user_id, cm.role, cm.joined_at, u.username, u.tier, u.rating
       FROM class_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.class_id = ?
       ORDER BY cm.joined_at ASC`,
      [classId],
    );
    const assignments = await query(
      `SELECT ca.id, ca.problem_id, ca.due_at, ca.created_at, p.title, p.tier
       FROM class_assignments ca
       JOIN problems p ON p.id = ca.problem_id
       WHERE ca.class_id = ?
       ORDER BY COALESCE(ca.due_at, ca.created_at) ASC`,
      [classId],
    );
    const isOwner = cls.owner_id === req.user.id;
    return res.json({
      class: {
        ...cls,
        invite_code: isOwner ? cls.invite_code : null,
      },
      members,
      assignments,
    });
  } catch (err) {
    logger.error('[classes/get]', { message: err.message });
    return internalError(res);
  }
});

router.post('/join', auth, requireVerified, async (req, res) => {
  try {
    const code = String(req.body?.inviteCode || '').trim();
    if (!code) return errorResponse(res, 400, 'VALIDATION_ERROR', 'inviteCode is required.');
    const cls = await queryOne('SELECT * FROM classes WHERE invite_code = ? AND archived_at IS NULL', [code]);
    if (!cls) return errorResponse(res, 404, 'NOT_FOUND', 'Invite code not found.');
    const existing = await queryOne(
      'SELECT id FROM class_members WHERE class_id = ? AND user_id = ?',
      [cls.id, req.user.id],
    );
    if (existing) return res.json({ classId: cls.id, alreadyJoined: true });
    await insert(
      'INSERT INTO class_members (class_id, user_id, role) VALUES (?, ?, ?)',
      [cls.id, req.user.id, 'student'],
    );
    return res.json({ classId: cls.id, name: cls.name, joined: true });
  } catch (err) {
    logger.error('[classes/join]', { message: err.message });
    return internalError(res);
  }
});

router.post('/:id/assignments', auth, requireVerified, async (req, res) => {
  try {
    const classId = Number(req.params.id);
    const { error } = await ensureClassOwner(classId, req.user.id);
    if (error === 'not_found') return errorResponse(res, 404, 'NOT_FOUND', 'Class not found.');
    if (error === 'forbidden') return errorResponse(res, 403, 'FORBIDDEN', 'Only the owner can assign problems.');

    const problemId = Number(req.body?.problemId);
    if (!Number.isFinite(problemId)) return errorResponse(res, 400, 'VALIDATION_ERROR', 'problemId is required.');
    const dueAt = req.body?.dueAt ? new Date(req.body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) return errorResponse(res, 400, 'VALIDATION_ERROR', 'dueAt is invalid.');

    const id = await insert(
      'INSERT INTO class_assignments (class_id, problem_id, assigned_by, due_at) VALUES (?, ?, ?, ?)',
      [classId, problemId, req.user.id, dueAt ? dueAt.toISOString().slice(0, 19).replace('T', ' ') : null],
    );
    return res.json({ id, classId, problemId, dueAt });
  } catch (err) {
    logger.error('[classes/assignments/create]', { message: err.message });
    return internalError(res);
  }
});

router.get('/:id/progress', auth, async (req, res) => {
  try {
    const classId = Number(req.params.id);
    const { error, cls } = await ensureClassOwner(classId, req.user.id);
    if (error === 'not_found') return errorResponse(res, 404, 'NOT_FOUND', 'Class not found.');
    if (error === 'forbidden') return errorResponse(res, 403, 'FORBIDDEN', 'Only the owner can view full progress.');

    // For each (student, assignment) pair: solved? best time?
    const rows = await query(
      `SELECT cm.user_id, u.username,
              ca.id AS assignment_id, ca.problem_id, p.title,
              MIN(CASE WHEN s.result = 'correct' THEN s.submitted_at END) AS first_correct_at,
              COUNT(s.id) AS attempts
       FROM class_members cm
       JOIN users u ON u.id = cm.user_id
       CROSS JOIN class_assignments ca
       LEFT JOIN problems p ON p.id = ca.problem_id
       LEFT JOIN submissions s
              ON s.user_id = cm.user_id AND s.problem_id = ca.problem_id
       WHERE cm.class_id = ? AND ca.class_id = ? AND cm.role = 'student'
       GROUP BY cm.user_id, u.username, ca.id, ca.problem_id, p.title
       ORDER BY u.username ASC, ca.id ASC`,
      [classId, classId],
    );
    return res.json({ classId, classOwner: cls.owner_id, rows: rows || [] });
  } catch (err) {
    logger.error('[classes/progress]', { message: err.message });
    return internalError(res);
  }
});

export default router;
