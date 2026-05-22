import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { Team } from '../models/Team.js';
import { randomBytes } from 'crypto';

const router = Router();

function sendError(res, err, fallback) {
  const status = err?.status || 500;
  if (status < 500) return res.status(status).json({ message: err.message });
  console.error('[teams]', err);
  return res.status(500).json({ message: fallback });
}

function parseTeamId(req) {
  const raw = req.body?.teamId ?? req.query?.teamId;
  if (raw == null || raw === '') return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getUserTeamOr404(req, res) {
  const teamId = parseTeamId(req);
  const team = await Team.findByUser(req.user.id, teamId);
  if (!team) {
    res.status(404).json({ message: 'Organization not found.' });
    return null;
  }
  return team;
}

// GET /api/teams/my - 현재 내 팀 정보 (멤버 포함)
router.get('/my', auth, async (req, res) => {
  try {
    const team = await Team.findByUser(req.user.id, parseTeamId(req));
    if (!team) return res.json(null);
    res.json(await Team.getTeamState(team.id));
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve team info.' });
  }
});

// GET /api/teams/mine - 내가 속한 모든 소속
router.get('/mine', auth, async (req, res) => {
  try {
    res.json({ teams: await Team.findAllByUser(req.user.id) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve organization list.' });
  }
});

// POST /api/teams/create - 무료 소속/팀 생성
router.post('/create', auth, async (req, res) => {
  const { name } = req.body;
  try {
    const cleanName = String(name || '').trim().slice(0, 100) || `${req.user.username}'s Organization`;
    const teamId = await Team.create(cleanName, req.user.id);
    res.json({ id: teamId, message: 'Organization created successfully.', team: await Team.getTeamState(teamId) });
  } catch (err) {
    sendError(res, err, 'Failed to create team.');
  }
});

// POST /api/teams/invite - 초대 링크 토큰 생성
router.post('/invite', auth, async (req, res) => {
  try {
    const team = await getUserTeamOr404(req, res);
    if (!team) return;
    await Team.requireAdmin(team.id, req.user.id);

    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 뒤 만료

    const expiresAtSql = expiresAt.toISOString().slice(0, 19).replace('T', ' ');
    await Team.createInvite(team.id, token, expiresAtSql);
    res.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    sendError(res, err, 'Failed to create invite link.');
  }
});

// POST /api/teams/join - 초대 토큰으로 팀 가입
router.post('/join', auth, async (req, res) => {
  const { token } = req.body;
  try {
    const invite = await Team.findInvite(token);
    if (!invite) return res.status(400).json({ message: 'Invalid or expired invite link.' });

    await Team.addMember(invite.team_id, req.user.id);
    res.json({ message: 'Successfully joined the organization!', team: await Team.getTeamState(invite.team_id) });
  } catch (err) {
    sendError(res, err, 'Failed to join team.');
  }
});

// DELETE /api/teams/members/:userId - 멤버 추방 (admin 전용)
router.delete('/members/:userId', auth, async (req, res) => {
  const targetUserId = Number(req.params.userId);
  try {
    const team = await getUserTeamOr404(req, res);
    if (!team) return;
    await Team.requireAdmin(team.id, req.user.id);
    if (targetUserId === req.user.id) return res.status(400).json({ message: 'You cannot remove yourself.' });

    await Team.removeMember(team.id, targetUserId);
    res.json({ message: 'Member has been removed.', team: await Team.getTeamState(team.id) });
  } catch (err) {
    sendError(res, err, 'Failed to remove member.');
  }
});

// POST /api/teams/members/:userId/role - 소속 관리자 지정/해제
router.post('/members/:userId/role', auth, async (req, res) => {
  const targetUserId = Number(req.params.userId);
  const role = req.body?.role === 'admin' ? 'admin' : 'member';
  try {
    const team = await getUserTeamOr404(req, res);
    if (!team) return;
    await Team.requireAdmin(team.id, req.user.id);
    const nextTeam = await Team.setMemberRole(team.id, targetUserId, role);
    res.json({ message: role === 'admin' ? 'Promoted to admin.' : 'Changed to regular member.', team: nextTeam });
  } catch (err) {
    sendError(res, err, 'Failed to change role.');
  }
});

// DELETE /api/teams/leave - 소속 탈퇴 (일반 멤버)
router.delete('/leave', auth, async (req, res) => {
  try {
    await Team.leave(req.user.id, parseTeamId(req));
    res.json({ message: 'You have left the organization.' });
  } catch (err) {
    sendError(res, err, 'Failed to leave organization.');
  }
});

// PATCH /api/teams/name - 소속 이름 변경 (관리자 전용)
router.patch('/name', auth, async (req, res) => {
  const { name } = req.body;
  try {
    const team = await getUserTeamOr404(req, res);
    if (!team) return;
    const updated = await Team.rename(team.id, req.user.id, name);
    res.json({ message: 'Organization name has been updated.', team: updated });
  } catch (err) {
    sendError(res, err, 'Failed to rename organization.');
  }
});

// DELETE /api/teams - 소속 해산 (소유자 전용)
router.delete('/', auth, async (req, res) => {
  try {
    const team = await getUserTeamOr404(req, res);
    if (!team) return;
    await Team.dissolve(team.id, req.user.id);
    res.json({ message: 'Organization has been dissolved.' });
  } catch (err) {
    sendError(res, err, 'Failed to dissolve organization.');
  }
});

export default router;
