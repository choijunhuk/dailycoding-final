import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { query, queryOne, run } from '../../config/mysql.js';
import { auth } from '../../middleware/auth.js';
import { validateBody, profileSchema, updatePasswordSchema } from '../../middleware/validate.js';
import { User } from '../../models/User.js';
import { Reward } from '../../models/Reward.js';
import { redis } from '../../config/redis.js';
import { errorResponse, internalError } from '../../middleware/errorHandler.js';
import { clearAuthCookies, clearAuthStatus } from './helpers.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'avatars');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('지원하지 않는 이미지 형식입니다.'));
  },
});

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_RIFF = Buffer.from('RIFF');
const WEBP_WEBP = Buffer.from('WEBP');

export function detectAvatarImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return 'png';
  if (buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) return 'jpg';
  if (
    buffer.subarray(0, WEBP_RIFF.length).equals(WEBP_RIFF) &&
    buffer.subarray(8, 12).equals(WEBP_WEBP)
  ) {
    return 'webp';
  }
  return null;
}

export function validateAvatarUpload(file) {
  const detectedType = detectAvatarImageType(file?.buffer);
  const expectedType = file?.mimetype === 'image/png'
    ? 'png'
    : file?.mimetype === 'image/webp'
      ? 'webp'
      : file?.mimetype === 'image/jpeg'
        ? 'jpg'
        : null;

  if (!detectedType || !expectedType || detectedType !== expectedType) {
    return null;
  }

  return detectedType;
}

function safeParseJSON(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

router.patch('/me', auth, validateBody(profileSchema), async (req, res) => {
  try {
    const { username, bio, avatar_color, avatar_emoji, default_language, submissions_public } = req.body;
    const updates = {};
    if (username !== undefined) updates.username = username?.trim() || '';
    if (bio !== undefined) updates.bio = bio;
    if (avatar_color !== undefined) updates.avatar_color = avatar_color;
    if (avatar_emoji !== undefined) updates.avatar_emoji = avatar_emoji;
    if (default_language !== undefined) updates.default_language = default_language;
    if (submissions_public !== undefined) updates.submissions_public = submissions_public ? 1 : 0;
    const updated = await User.update(req.user.id, updates);
    await clearAuthStatus(req.user.id);
    res.json(User.safe(updated));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return errorResponse(res, 409, 'VALIDATION_ERROR', '이미 사용 중인 닉네임입니다.');
    return internalError(res);
  }
});

router.patch('/settings', auth, async (req, res) => {
  try {
    const { section, settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return errorResponse(res, 400, 'VALIDATION_ERROR', '올바르지 않은 설정 형식입니다.');
    }
    const patch = section ? { [section]: settings } : settings;
    const updated = await User.updateSettings(req.user.id, patch);
    res.json({ settings: updated });
  } catch (err) {
    return internalError(res, '설정 저장 실패');
  }
});

router.patch('/password', auth, validateBody(updatePasswordSchema), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!await User.checkPassword(user, req.body.current)) {
      return errorResponse(res, 401, 'UNAUTHORIZED', '현재 비밀번호가 틀렸습니다.');
    }
    await User.updatePassword(req.user.id, req.body.next);
    await redis.del(`auth:refresh:${req.user.id}`);
    await clearAuthStatus(req.user.id);
    clearAuthCookies(res);
    res.json({ message: '비밀번호가 변경됐습니다.' });
  } catch (err) {
    return internalError(res);
  }
});

router.get('/profile/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) return errorResponse(res, 400, 'VALIDATION_ERROR', '유효하지 않은 ID');
  try {
    const user = await User.findById(id);
    if (!user) return errorResponse(res, 404, 'NOT_FOUND', '유저를 찾을 수 없습니다.');

    const isSelf = req.user.id === id;
    if (!isSelf && user.profile_visibility === 'private') {
      return errorResponse(res, 403, 'FORBIDDEN', '비공개 프로필입니다.');
    }

    const anonClause = isSelf ? '' : ' AND is_anonymous = 0';
    const [statsRow, followStats, isFollowing, replyStatsRow, solvedTierRows] = await Promise.all([
      queryOne(
        `SELECT COUNT(*) AS post_count, COALESCE(SUM(like_count),0) AS total_likes
         FROM posts WHERE user_id = ?${anonClause}`,
        [id]
      ),
      queryOne(
        `SELECT
           (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
           (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following`,
        [id, id]
      ),
      isSelf ? Promise.resolve(null) : queryOne(
        'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
        [req.user.id, id]
      ),
      queryOne(
        `SELECT COUNT(*) AS reply_count,
                COALESCE(SUM(is_accepted), 0) AS accepted_answers
         FROM post_replies WHERE user_id = ?`,
        [id]
      ),
      query(
        `SELECT p.tier, COUNT(DISTINCT s.problem_id) AS cnt
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         WHERE s.user_id = ? AND s.result = 'correct'
         GROUP BY p.tier`,
        [id]
      ),
    ]);

    const solvedTierCounts = (solvedTierRows || []).reduce((acc, row) => {
      acc[row.tier || 'unranked'] = Number(row.cnt) || 0;
      return acc;
    }, {});

    const parsedSocialLinks = safeParseJSON(user.social_links, {});
    const parsedTechStack = safeParseJSON(user.tech_stack, []);
    const rewards = await Reward.findByUser(id);

    const bgRow = user.equipped_background
      ? await queryOne('SELECT image_url FROM profile_backgrounds WHERE slug = ?', [user.equipped_background])
      : null;
    const equippedBackgroundUrl = bgRow?.image_url?.startsWith('gradient:')
      ? bgRow.image_url.replace('gradient:', '')
      : bgRow?.image_url
        ? `url(${bgRow.image_url}) center/cover`
        : null;

    const base = {
      id: user.id,
      username: user.username,
      nickname: user.nickname ?? null,
      displayName: user.display_name ?? null,
      tier: user.tier,
      rating: user.rating,
      streak: user.streak,
      solvedCount: user.solved_count ?? 0,
      bio: user.bio,
      avatar_url: user.avatar_url,
      avatar_color: user.avatar_color,
      avatar_emoji: user.avatar_emoji,
      equippedBadge: user.equipped_badge ?? null,
      equippedTitle: user.equipped_title ?? null,
      achievement: user.achievement ?? null,
      joinDate: user.join_date ? new Date(user.join_date).toISOString().slice(0, 10) : null,
      socialLinks: parsedSocialLinks,
      techStack: parsedTechStack,
      submissionsPublic: user.submissions_public === undefined ? true : Boolean(user.submissions_public),
      postCount: statsRow?.post_count ?? 0,
      totalLikes: statsRow?.total_likes ?? 0,
      replyCount: replyStatsRow?.reply_count ?? 0,
      acceptedAnswers: replyStatsRow?.accepted_answers ?? 0,
      followers: followStats?.followers ?? 0,
      following: followStats?.following ?? 0,
      isFollowing: isSelf ? false : !!isFollowing,
      solvedTierCounts,
      rewards,
      equippedBackgroundUrl,
    };

    if (isSelf) {
      const posts = await query(
        `SELECT id, board_type, title, like_count, answer_count, is_anonymous, created_at
         FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        [id]
      );
      return res.json({ ...base, posts, postVisibility: user.post_visibility || 'public' });
    }

    const posts = user.post_visibility === 'private' ? [] : await query(
      `SELECT id, board_type, title, like_count, answer_count, created_at
       FROM posts WHERE user_id = ? AND is_anonymous = 0 ORDER BY created_at DESC LIMIT 50`,
      [id]
    );
    res.json({ ...base, posts });
  } catch (err) {
    console.error('[profile/:id]', err);
    return internalError(res);
  }
});

router.get('/profile/:id/activity', auth, async (req, res) => {
  const id = Number(req.params.id);
  const requestedYear = Number.parseInt(req.query.year, 10);
  const year = Number.isFinite(requestedYear)
    ? Math.min(2100, Math.max(2020, requestedYear))
    : new Date().getFullYear();

  if (!id || Number.isNaN(id)) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', '유효하지 않은 ID');
  }

  try {
    const user = await User.findById(id);
    if (!user) return errorResponse(res, 404, 'NOT_FOUND', '유저를 찾을 수 없습니다.');
    if (user.profile_visibility === 'private') {
      return errorResponse(res, 403, 'FORBIDDEN', '비공개 프로필입니다.');
    }
    if (user.profile_visibility === 'followers' && req.user.id !== id) {
      const isFollowing = await queryOne(
        'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
        [req.user.id, id]
      );
      if (!isFollowing) return errorResponse(res, 403, 'FORBIDDEN', '팔로워만 볼 수 있습니다.');
    }

    const rows = await query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM submissions
       WHERE user_id = ? AND result = 'correct' AND YEAR(created_at) = ?
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`,
      [id, year]
    );

    res.json({
      year,
      data: (rows || []).map((row) => ({
        date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
        count: Number(row.count) || 0,
      })),
    });
  } catch (err) {
    console.error('[profile/:id/activity]', err);
    return internalError(res);
  }
});

router.get('/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return errorResponse(res, 404, 'NOT_FOUND', '유저 없음');
    const defaults = User.getDefaultSettings();
    const current = safeParseJSON(user.settings, {});
    const merged = {};
    for (const section of Object.keys(defaults)) {
      merged[section] = { ...defaults[section], ...(current[section] || {}) };
    }
    res.json({ settings: merged });
  } catch (err) {
    console.error('[settings/get]', err);
    return internalError(res);
  }
});

router.patch('/profile/extended', auth, async (req, res) => {
  const { display_name, social_links, tech_stack, bio } = req.body;
  const updates = {};

  if (display_name !== undefined) updates.display_name = display_name ? String(display_name).trim().slice(0, 60) : null;
  if (bio !== undefined) updates.bio = bio ? String(bio).trim().slice(0, 500) : null;
  if (social_links !== undefined) {
    if (typeof social_links !== 'object' || Array.isArray(social_links)) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'social_links는 객체여야 합니다.');
    }
    const allowedLinks = new Set(['github', 'instagram', 'x', 'linkedin', 'velog', 'tistory', 'twitter']);
    const filtered = {};
    for (const [key, value] of Object.entries(social_links)) {
      if (allowedLinks.has(key) && typeof value === 'string') filtered[key] = value.trim().slice(0, 200);
    }
    updates.social_links = JSON.stringify(filtered);
  }
  if (tech_stack !== undefined) {
    if (!Array.isArray(tech_stack)) return errorResponse(res, 400, 'VALIDATION_ERROR', 'tech_stack은 배열이어야 합니다.');
    updates.tech_stack = JSON.stringify(
      tech_stack
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim().slice(0, 30))
        .filter(Boolean)
        .slice(0, 20)
    );
  }

  if (Object.keys(updates).length === 0) return errorResponse(res, 400, 'VALIDATION_ERROR', '변경할 항목이 없습니다.');

  try {
    const updated = await User.update(req.user.id, updates);
    await clearAuthStatus(req.user.id);
    res.json(User.safe(updated));
  } catch (err) {
    console.error('[profile/extended]', err);
    return internalError(res);
  }
});

router.get('/profile/backgrounds', auth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT pb.*,
              (ub.user_id IS NOT NULL) AS isUnlocked
       FROM profile_backgrounds pb
       LEFT JOIN user_backgrounds ub
         ON ub.background_slug = pb.slug AND ub.user_id = ?
       WHERE pb.is_default = 1 OR ub.user_id = ?
       ORDER BY pb.is_default DESC, pb.created_at ASC`,
      [req.user.id, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[profile/backgrounds]', err);
    return internalError(res);
  }
});

router.patch('/profile/background', auth, async (req, res) => {
  try {
    const raw = req.body?.backgroundSlug;
    if (raw === null || raw === undefined || raw === '') {
      const updated = await User.update(req.user.id, { equipped_background: null });
      await clearAuthStatus(req.user.id);
      return res.json(User.safe(updated));
    }
    const backgroundSlug = String(raw).trim();
    if (!backgroundSlug) return errorResponse(res, 400, 'VALIDATION_ERROR', '배경 slug가 필요합니다.');
    const background = await queryOne('SELECT * FROM profile_backgrounds WHERE slug = ?', [backgroundSlug]);
    if (!background) return errorResponse(res, 404, 'NOT_FOUND', '배경을 찾을 수 없습니다.');
    const unlocked = background.is_default || await queryOne(
      'SELECT 1 FROM user_backgrounds WHERE user_id = ? AND background_slug = ?',
      [req.user.id, backgroundSlug]
    );
    if (!unlocked) return errorResponse(res, 403, 'FORBIDDEN', '보유하지 않은 배경입니다.');
    const updated = await User.update(req.user.id, { equipped_background: backgroundSlug });
    await clearAuthStatus(req.user.id);
    res.json(User.safe(updated));
  } catch (err) {
    console.error('[profile/background:patch]', err);
    return internalError(res);
  }
});

router.post('/profile/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 400, 'VALIDATION_ERROR', '업로드할 이미지가 필요합니다.');
    const detectedType = validateAvatarUpload(req.file);
    if (!detectedType) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', '유효한 JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.');
    }
    await fs.mkdir(uploadsDir, { recursive: true });
    const filename = `${req.user.id}.${detectedType}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, req.file.buffer);
    const avatarUrl = `/uploads/avatars/${filename}`;
    const updated = await User.update(req.user.id, { avatar_url_custom: avatarUrl });
    await clearAuthStatus(req.user.id);
    res.json({ avatarUrl, user: User.safe(updated) });
  } catch (err) {
    console.error('[profile/avatar]', err);
    return internalError(res, err.message || '아바타 업로드 실패');
  }
});

router.patch('/nickname', auth, async (req, res) => {
  const { nickname } = req.body;
  if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', '닉네임을 입력해주세요.');
  }
  const clean = nickname.trim().slice(0, 30);
  if (!/^[a-zA-Z0-9_가-힣]{2,30}$/.test(clean)) {
    return errorResponse(res, 400, 'VALIDATION_ERROR', '닉네임은 2~30자, 한글/영문/숫자/밑줄만 허용됩니다.');
  }
  try {
    const updated = await User.setNickname(req.user.id, clean);
    await clearAuthStatus(req.user.id);
    res.json({ nickname: updated.nickname, nicknameChangedAt: updated.nickname_changed_at });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || '서버 오류' });
  }
});

router.get('/check-nickname', auth, async (req, res) => {
  const { nickname } = req.query;
  if (!nickname) return errorResponse(res, 400, 'VALIDATION_ERROR', '닉네임을 입력해주세요.');
  const exists = await User.findByNickname(nickname.trim());
  res.json({ available: !exists || exists.id === req.user.id });
});

router.patch('/visibility', auth, async (req, res) => {
  try {
    const updated = await User.setVisibility(req.user.id, req.body);
    await clearAuthStatus(req.user.id);
    res.json({
      profileVisibility: updated.profile_visibility,
      postVisibility: updated.post_visibility,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || '서버 오류' });
  }
});

router.get('/grass/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) return errorResponse(res, 400, 'VALIDATION_ERROR', '유효하지 않은 ID');
  try {
    const rows = await User.getGrass(id);
    res.json(rows);
  } catch (err) {
    return internalError(res);
  }
});

router.post('/streak-freeze', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return errorResponse(res, 404, 'NOT_FOUND', '유저 없음');
    const today = new Date().toISOString().slice(0, 10);
    const solved = await queryOne('SELECT 1 FROM solve_logs WHERE user_id=? AND solve_date=?', [req.user.id, today]);
    if (solved) return res.json({ message: '오늘 이미 문제를 풀었습니다. 프리즈 불필요!', streak: user.streak });
    await run('INSERT INTO solve_logs (user_id, solve_date, count) VALUES (?,?,0) ON DUPLICATE KEY UPDATE count=count', [req.user.id, today]);
    res.json({ message: '🧊 스트릭 프리즈 사용! 오늘 스트릭이 유지됩니다.', streak: user.streak });
  } catch (err) {
    console.error('[streak-freeze]', err.message);
    return internalError(res);
  }
});

export default router;
