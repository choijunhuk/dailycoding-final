import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { randomBytes } from 'crypto';

const router = Router();

// GET /api/teams/my - 현재 내 팀 정보 (멤버 포함)
router.get('/my', auth, async (req, res) => {
  try {
    const team = await Team.findByOwner(req.user.id);
    if (!team) return res.json(null);
    
    const members = await Team.getMembers(team.id);
    res.json({ ...team, members });
  } catch (err) {
    res.status(500).json({ message: '팀 정보 조회 실패' });
  }
});

// POST /api/teams/create - 팀 생성 (Team 플랜 유저만)
router.post('/create', auth, async (req, res) => {
  const { name } = req.body;
  try {
    // JWT에는 subscription_tier가 없으므로 DB에서 최신 상태 조회
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.subscription_tier !== 'team') {
      return res.status(403).json({ message: 'Team 플랜 구독이 필요합니다.' });
    }
    const existing = await Team.findByOwner(req.user.id);
    if (existing) return res.status(400).json({ message: '이미 생성한 팀이 있습니다.' });

    const teamId = await Team.create(name || `${req.user.username}의 팀`, req.user.id);
    res.json({ id: teamId, message: '팀이 생성되었습니다.' });
  } catch (err) {
    res.status(500).json({ message: '팀 생성 실패' });
  }
});

// POST /api/teams/invite - 초대 링크 토큰 생성
router.post('/invite', auth, async (req, res) => {
  try {
    const team = await Team.findByOwner(req.user.id);
    if (!team) return res.status(404).json({ message: '팀을 찾을 수 없습니다.' });

    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7일 뒤 만료

    await Team.createInvite(team.id, token, expiresAt.toISOString().slice(0, 19).replace('T', ' '));
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: '초대 링크 생성 실패' });
  }
});

// POST /api/teams/join - 초대 토큰으로 팀 가입
router.post('/join', auth, async (req, res) => {
  const { token } = req.body;
  try {
    const invite = await Team.findInvite(token);
    if (!invite) return res.status(400).json({ message: '유효하지 않거나 만료된 초대 링크입니다.' });

    await Team.addMember(invite.team_id, req.user.id);
    res.json({ message: '팀에 성공적으로 합류했습니다!' });
  } catch (err) {
    res.status(500).json({ message: '팀 합류 실패' });
  }
});

// DELETE /api/teams/members/:userId - 멤버 추방 (admin 전용)
router.delete('/members/:userId', auth, async (req, res) => {
  const targetUserId = Number(req.params.userId);
  try {
    const team = await Team.findByOwner(req.user.id);
    if (!team) return res.status(403).json({ message: '팀의 관리자만 멤버를 추방할 수 있습니다.' });
    if (team.owner_id === targetUserId) return res.status(400).json({ message: '관리자 본인은 추방할 수 없습니다.' });

    await Team.removeMember(team.id, targetUserId);
    res.json({ message: '멤버가 추방되었습니다.' });
  } catch (err) {
    res.status(500).json({ message: '멤버 추방 실패' });
  }
});

export default router;
