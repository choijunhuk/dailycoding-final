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

// GET /api/teams/my - 현재 내 팀 정보 (멤버 포함)
router.get('/my', auth, async (req, res) => {
  try {
    const team = await Team.findByUser(req.user.id);
    if (!team) return res.json(null);
    res.json(await Team.getTeamState(team.id));
  } catch (err) {
    res.status(500).json({ message: '팀 정보 조회 실패' });
  }
});

// POST /api/teams/create - 무료 소속/팀 생성
router.post('/create', auth, async (req, res) => {
  const { name } = req.body;
  try {
    const existing = await Team.findByUser(req.user.id);
    if (existing) return res.status(400).json({ message: '이미 소속된 팀이 있습니다.' });

    const cleanName = String(name || '').trim().slice(0, 100) || `${req.user.username}의 소속`;
    const teamId = await Team.create(cleanName, req.user.id);
    res.json({ id: teamId, message: '소속이 생성되었습니다.', team: await Team.getTeamState(teamId) });
  } catch (err) {
    sendError(res, err, '팀 생성 실패');
  }
});

// POST /api/teams/invite - 초대 링크 토큰 생성
router.post('/invite', auth, async (req, res) => {
  try {
    const team = await Team.findByUser(req.user.id);
    if (!team) return res.status(404).json({ message: '팀을 찾을 수 없습니다.' });
    await Team.requireAdmin(team.id, req.user.id);

    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 뒤 만료

    const expiresAtSql = expiresAt.toISOString().slice(0, 19).replace('T', ' ');
    await Team.createInvite(team.id, token, expiresAtSql);
    res.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (err) {
    sendError(res, err, '초대 링크 생성 실패');
  }
});

// POST /api/teams/join - 초대 토큰으로 팀 가입
router.post('/join', auth, async (req, res) => {
  const { token } = req.body;
  try {
    const invite = await Team.findInvite(token);
    if (!invite) return res.status(400).json({ message: '유효하지 않거나 만료된 초대 링크입니다.' });

    await Team.addMember(invite.team_id, req.user.id);
    res.json({ message: '소속에 성공적으로 합류했습니다!', team: await Team.getTeamState(invite.team_id) });
  } catch (err) {
    sendError(res, err, '팀 합류 실패');
  }
});

// DELETE /api/teams/members/:userId - 멤버 추방 (admin 전용)
router.delete('/members/:userId', auth, async (req, res) => {
  const targetUserId = Number(req.params.userId);
  try {
    const team = await Team.findByUser(req.user.id);
    if (!team) return res.status(403).json({ message: '팀의 관리자만 멤버를 추방할 수 있습니다.' });
    await Team.requireAdmin(team.id, req.user.id);
    if (targetUserId === req.user.id) return res.status(400).json({ message: '본인은 추방할 수 없습니다.' });

    await Team.removeMember(team.id, targetUserId);
    res.json({ message: '멤버가 추방되었습니다.', team: await Team.getTeamState(team.id) });
  } catch (err) {
    sendError(res, err, '멤버 추방 실패');
  }
});

// POST /api/teams/members/:userId/role - 소속 관리자 지정/해제
router.post('/members/:userId/role', auth, async (req, res) => {
  const targetUserId = Number(req.params.userId);
  const role = req.body?.role === 'admin' ? 'admin' : 'member';
  try {
    const team = await Team.findByUser(req.user.id);
    if (!team) return res.status(403).json({ message: '소속 관리자만 처리할 수 있습니다.' });
    await Team.requireAdmin(team.id, req.user.id);
    const nextTeam = await Team.setMemberRole(team.id, targetUserId, role);
    res.json({ message: role === 'admin' ? '관리자로 지정했습니다.' : '일반 멤버로 변경했습니다.', team: nextTeam });
  } catch (err) {
    sendError(res, err, '역할 변경 실패');
  }
});

// DELETE /api/teams/leave - 소속 탈퇴 (일반 멤버)
router.delete('/leave', auth, async (req, res) => {
  try {
    await Team.leave(req.user.id);
    res.json({ message: '소속에서 탈퇴했습니다.' });
  } catch (err) {
    sendError(res, err, '소속 탈퇴 실패');
  }
});

// PATCH /api/teams/name - 소속 이름 변경 (관리자 전용)
router.patch('/name', auth, async (req, res) => {
  const { name } = req.body;
  try {
    const team = await Team.findByUser(req.user.id);
    if (!team) return res.status(404).json({ message: '소속을 찾을 수 없습니다.' });
    const updated = await Team.rename(team.id, req.user.id, name);
    res.json({ message: '소속 이름이 변경되었습니다.', team: updated });
  } catch (err) {
    sendError(res, err, '이름 변경 실패');
  }
});

// DELETE /api/teams - 소속 해산 (소유자 전용)
router.delete('/', auth, async (req, res) => {
  try {
    const team = await Team.findByUser(req.user.id);
    if (!team) return res.status(404).json({ message: '소속을 찾을 수 없습니다.' });
    await Team.dissolve(team.id, req.user.id);
    res.json({ message: '소속이 해산되었습니다.' });
  } catch (err) {
    sendError(res, err, '소속 해산 실패');
  }
});

export default router;
