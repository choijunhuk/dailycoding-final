import { nowMySQL, toMySQL } from '../config/dateutil.js';
import { query, queryOne, insert, run } from '../config/mysql.js';
import bcrypt from 'bcryptjs';
import { redis } from '../config/redis.js';
import { Reward } from './Reward.js';
import { TIER_ORDER, TIER_POINTS, TIER_THRESHOLDS } from '../shared/constants.js';
import { getActivePromotionSeries, getNextTier, openPromotionSeries, recordPromotionWin } from '../services/promotionService.js';

const USER_SELECTABLE_FIELDS = new Set([
  'id',
  'email',
  'username',
  'nickname',
  'role',
  'tier',
  'rating',
  'streak',
  'solved_count',
  'bio',
  'avatar_url',
  'avatar_emoji',
  'avatar_color',
  'equipped_badge',
  'equipped_title',
  'email_verified',
  'banned_at',
  'ban_reason',
  'subscription_tier',
  'subscription_expires_at',
  'join_date',
  'last_login',
  'default_language',
  'submissions_public',
  'profile_visibility',
  'post_visibility',
  'display_name',
  'social_links',
  'tech_stack',
  'settings',
  'achievement',
  'equipped_background',
  'avatar_url_custom',
]);

function normalizeUserFields(fields = '*') {
  if (fields === '*') return '*';
  const requested = Array.isArray(fields)
    ? fields
    : String(fields)
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean);

  if (requested.length === 0) return '*';
  for (const field of requested) {
    if (!USER_SELECTABLE_FIELDS.has(field)) {
      throw new Error(`Invalid user field selection: ${field}`);
    }
  }
  return requested.join(', ');
}

const SOLVED_ZSET_TTL_SEC = 86400 * 7;

function safeParseJSON(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export const User = {
  async findByEmail(email) {
    return queryOne('SELECT * FROM users WHERE email = ?', [email]);
  },

  async findById(id) {
    return queryOne('SELECT * FROM users WHERE id = ?', [id]);
  },

  async findAll({ limit = 200, offset = 0, fields = '*' } = {}) {
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 200));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const selectedFields = normalizeUserFields(fields);
    return query(
      `SELECT ${selectedFields}
       FROM users
       ORDER BY rating DESC
       LIMIT ? OFFSET ?`,
      [safeLimit, safeOffset]
    );
  },

  async getRanking(limit = 100, { offset = 0, tier, sort = 'rating' } = {}) {
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 100));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const orderBy = sort === 'solved_count'
      ? 'solved_count DESC, rating DESC'
      : 'rating DESC, solved_count DESC';
    const params = [];
    let where = `WHERE banned_at IS NULL AND role != 'admin'`;

    if (tier) {
      where += ' AND tier = ?';
      params.push(tier);
    }

    params.push(safeLimit, safeOffset);
    return query(
      `SELECT id, username, tier, rating, solved_count, avatar_url, equipped_badge, equipped_title
       FROM users
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      params
    );
  },

  async findByUsername(username) {
    return queryOne('SELECT * FROM users WHERE username = ?', [username]);
  },

  async findByOAuth(provider, oauthId) {
    return queryOne('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?', [provider, oauthId]);
  },

  async create({ email, password, username, role='user', tier='unranked', rating=0 }) {
    const hashed = password ? await bcrypt.hash(password, 10) : null;
    const today  = nowMySQL().slice(0,10);
    // 어드민은 이메일 인증 불필요 — 생성 시 자동 인증 처리
    const emailVerified = role === 'admin' ? 1 : 0;
    const id = await insert(
      'INSERT INTO users (email,password,username,role,tier,rating,join_date,email_verified) VALUES (?,?,?,?,?,?,?,?)',
      [email, hashed, username, role, tier, rating, today, emailVerified]
    );
    return this.findById(id);
  },

  async update(id, fields) {
    // 허용된 컬럼만 업데이트 — 임의 컬럼 주입 방지
    const ALLOWED = new Set(['username', 'bio', 'last_login', 'role', 'tier', 'rating', 'streak', 'solved_count', 'avatar_url', 'avatar_color', 'avatar_emoji', 'equipped_badge', 'equipped_title', 'email_verified', 'banned_at', 'ban_reason', 'default_language', 'submissions_public', 'nickname', 'nickname_changed_at', 'profile_visibility', 'post_visibility', 'achievement', 'display_name', 'social_links', 'tech_stack', 'equipped_background', 'avatar_url_custom']);
    const processed = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!ALLOWED.has(k)) continue;
      processed[k] = v instanceof Date ? toMySQL(v) : v;
    }
    if (Object.keys(processed).length === 0) return this.findById(id);
    const sets = Object.keys(processed).map(k => `\`${k}\` = ?`).join(', ');
    const vals = Object.values(processed);
    await run(`UPDATE users SET ${sets} WHERE id = ?`, [...vals, id]);
    return this.findById(id);
  },

  // Stripe/구독 전용 — 일반 update()에서 분리하여 사용자가 스스로 tier를 변경할 수 없도록 보장
  async updateSubscription(id, { stripe_customer_id, subscription_tier, subscription_expires_at }) {
    const fields = {};
    if (stripe_customer_id !== undefined) fields.stripe_customer_id = stripe_customer_id;
    if (subscription_tier  !== undefined) fields.subscription_tier  = subscription_tier;
    if (subscription_expires_at !== undefined) fields.subscription_expires_at = subscription_expires_at;
    if (Object.keys(fields).length === 0) return this.findById(id);
    const sets = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
    await run(`UPDATE users SET ${sets} WHERE id = ?`, [...Object.values(fields), id]);
    return this.findById(id);
  },

  async updatePassword(id, newPassword) {
    const hashed = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password = ? WHERE id = ?', [hashed, id]);
  },

  async delete(id) {
    return run('DELETE FROM users WHERE id = ?', [id]);
  },

  async checkPassword(user, plain) {
    return bcrypt.compare(plain, user.password);
  },

  // 문제 티어별 점수
  // 설계 원칙: 그 티어에 도달하려면 직전 티어 문제 100개 분량의 점수가 필요
  // bronze:200 / silver:2000(100×20) / gold:5500(2000+100×35) /
  // platinum:11000(5500+100×55) / diamond:19000(11000+100×80)
  tierPoints(problemTier) {
    return TIER_POINTS[problemTier] || 20;
  },

  tierScore(tier) {
    const index = TIER_ORDER.indexOf(tier);
    return index > 0 ? index * 1000 : 0;
  },

  calcTier(rating) {
    // challenger는 syncChallengerTiers()가 동적으로 부여 — rating 기반 계산 제외
    const ranked = TIER_ORDER.filter(t => t !== 'unranked' && t !== 'challenger');
    for (const tier of [...ranked].reverse()) {
      if (rating >= (TIER_THRESHOLDS[tier] || Infinity)) return tier;
    }
    return 'unranked';
  },

  // 풀이 시 레이팅/스트릭 업데이트
  // 상위 100문제 기반 레이팅 재계산 (풀이 제출 후 호출 — submissions 테이블에 이미 기록됨)
  async getTop100Solved(userId) {
    return query(`
      SELECT p.id, p.title, p.tier, p.difficulty
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      WHERE s.user_id = ? AND s.result = 'correct' AND COALESCE(p.problem_type, 'coding') = 'coding'
      GROUP BY p.id, p.title, p.tier, p.difficulty
      ORDER BY FIELD(p.tier,'diamond','platinum','gold','silver','bronze') ASC,
               p.difficulty DESC
      LIMIT 100
    `, [userId]);
  },

  async getSolvedCodingProblems(userId) {
    return query(`
      SELECT p.id, p.tier, p.difficulty
      FROM submissions s
      JOIN problems p ON s.problem_id = p.id
      WHERE s.user_id = ? AND s.result = 'correct' AND COALESCE(p.problem_type, 'coding') = 'coding'
      GROUP BY p.id, p.tier, p.difficulty
    `, [userId]);
  },

  async calcRatingFromTop100(userId, newProblem = null) {
    const zsetKey = `user:${userId}:solved_coding_zset`;
    const isCodingProblem = !!newProblem && (newProblem.problemType || newProblem.problem_type || 'coding') === 'coding';
    const exists = await redis.exists(zsetKey);

    // Redis에 데이터가 없는 경우 DB에서 초기화 (최초 1회)
    if (!exists) {
      const allSolved = await this.getSolvedCodingProblems(userId);
      
      if (allSolved.length > 0) {
        const members = allSolved.map(p => ({
          score: this.tierScore(p.tier || 'bronze') + (p.difficulty || 0),
          value: String(p.id)
        }));
        await redis.zAddMany(zsetKey, members, SOLVED_ZSET_TTL_SEC);
        await redis.expire(zsetKey, SOLVED_ZSET_TTL_SEC);
      } else if (!isCodingProblem) {
        return 0;
      }
    }

    if (isCodingProblem) {
      const score = this.tierScore(newProblem.tier || 'bronze') + (newProblem.difficulty || 0);
      await redis.zAdd(zsetKey, score, newProblem.id, SOLVED_ZSET_TTL_SEC);
      await redis.expire(zsetKey, SOLVED_ZSET_TTL_SEC);
    }

    // 상위 100개 가져오기 (WITHSCORES로 티어 정보 복원)
    const top100 = await redis.zRevRangeWithScores(zsetKey, 0, 99);

    // score = tierScore(tier) + difficulty, tierScore = TIER_ORDER.indexOf(tier) × 1000
    // 역산: Math.floor(score / 1000) → TIER_ORDER 인덱스
    return top100.reduce((sum, item) => {
      const tierIndex = Math.floor(item.score / 1000);
      const tier = TIER_ORDER[tierIndex] || 'bronze';
      return sum + this.tierPoints(tier);
    }, 0);
  },

  async onSolve(userId, problem) {
    // compatibility for old calls passing just tier string
    const probObj = typeof problem === 'object' ? problem : { tier: problem, problemType: 'coding' };

    // Race condition 방지: 동일 유저+문제 onSolve가 동시에 실행되지 않도록 원자적 잠금
    // Redis SET NX EX — 60초 TTL (채점 완료까지 충분한 시간)
    const problemId = probObj?.id;
    const lockKey = problemId
      ? `onsolve:lock:${userId}:${problemId}`
      : `onsolve:lock:${userId}:noid:${Date.now()}`;
    const acquired = await redis.setNX(lockKey, '1', 60);
    if (!acquired && problemId) return; // 이미 처리 중인 요청이 있음

    // 오늘 처음 푸는 경우만 streak 증가
    const todayStr = nowMySQL().slice(0,10);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0,10);

    const [solvedToday, solvedYesterday] = await Promise.all([
      queryOne('SELECT 1 FROM solve_logs WHERE user_id=? AND solve_date=?', [userId, todayStr]),
      queryOne('SELECT 1 FROM solve_logs WHERE user_id=? AND solve_date=?', [userId, yesterdayStr]),
    ]);

    if (solvedToday) {
      // 오늘 이미 다른 문제를 풀었더라도 solved_count는 증가 (onSolve는 첫 정답 시에만 호출됨)
      await run(`UPDATE users SET solved_count = solved_count + 1, last_login = ? WHERE id = ?`, [nowMySQL(), userId]);
    } else if (solvedYesterday) {
      // 어제 풀었으면 streak +1
      await run(`
        UPDATE users
        SET solved_count = solved_count + 1, streak = streak + 1, last_login = ?
        WHERE id = ?
      `, [nowMySQL(), userId]);
    } else {
      // 연속이 끊겼으면 streak 리셋
      await run(`
        UPDATE users
        SET solved_count = solved_count + 1, streak = 1, last_login = ?
        WHERE id = ?
      `, [nowMySQL(), userId]);
    }
    // 잔디 로그
    const today2 = nowMySQL().slice(0,10);
    await run(`
      INSERT INTO solve_logs (user_id, solve_date, count)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE count = count + 1
    `, [userId, today2]);

    // 잔디 로그 (Redis)
    const year = today2.slice(0, 4);
    await redis.hIncrBy(`user:${userId}:heatmap:${year}`, today2, 1);
    await redis.del(`activity:${userId}`);

    // 상위 100문제 기반 레이팅 재계산 (Redis 캐시 활용)
    const newRatingCalc = await this.calcRatingFromTop100(userId, probObj);
    await run('UPDATE users SET rating = ? WHERE id = ?', [newRatingCalc, userId]);
    // 레이팅 기반 tier 자동 업그레이드 + 보상 지급
    const updUser = await queryOne('SELECT role, rating, tier, streak, solved_count FROM users WHERE id=?', [userId]);
    const newRating = updUser?.rating || 0;
    const oldTier   = updUser?.tier || 'unranked';
    const computedTier = this.calcTier(newRating);
    let nextTier = oldTier;
    const activePromotion = await getActivePromotionSeries(userId);

    if (activePromotion?.status === 'in_progress' && activePromotion.to_tier === computedTier) {
      const updatedSeries = await recordPromotionWin(userId, computedTier);
      nextTier = updatedSeries?.status === 'promoted' ? computedTier : oldTier;
    } else if (TIER_ORDER.indexOf(computedTier) > TIER_ORDER.indexOf(oldTier)) {
      const targetTier = getNextTier(oldTier);
      if (targetTier && targetTier === computedTier) {
        await openPromotionSeries(userId, oldTier, targetTier);
        nextTier = oldTier;
      } else {
        nextTier = oldTier;
      }
    }

    await run('UPDATE users SET tier=? WHERE id=?', [nextTier, userId]);

    // Update Redis Global Ranking (Sorted Set)
    if (updUser && updUser.role !== 'admin') {
      const scoreForRedis = newRating + (updUser.solved_count || 0) / 1000000;
      await redis.zAdd('ranking:global:zset', scoreForRedis, userId);
    }

    // 티어 달성 보상
    // 스트릭 보상
    const streak = updUser?.streak || 0;
    if (streak >= 100) await Reward.grant(userId, 'badge_streak100');
    else if (streak >= 30) await Reward.grant(userId, 'badge_streak30');
    else if (streak >= 7)  await Reward.grant(userId, 'badge_streak7');

    // 풀이 수 보상
    const solvedCount = updUser?.solved_count || 0;
    if (solvedCount >= 100) await Reward.grant(userId, 'badge_solve100');
    else if (solvedCount >= 50) await Reward.grant(userId, 'badge_solve50');
    else if (solvedCount >= 10) await Reward.grant(userId, 'badge_solve10');

    // 챌린저 재조정 (상위 3명 동적 부여)
    await this.syncChallengerTiers();
  },

  // 상위 3명을 challenger로 지정, 밀려난 유저는 rating 기반 tier로 복원
  async syncChallengerTiers() {
    const top3 = await query(
      `SELECT id, rating FROM users WHERE banned_at IS NULL AND role != 'admin'
       ORDER BY rating DESC, solved_count DESC LIMIT 3`,
      []
    );
    const top3Ids = new Set(top3.map(u => u.id));

    // 현재 challenger 중 top3에서 밀려난 유저 복원
    const stale = await query(
      `SELECT id, rating FROM users WHERE tier = 'challenger' AND role != 'admin'`,
      []
    );
    for (const u of stale) {
      if (!top3Ids.has(u.id)) {
        await run('UPDATE users SET tier = ? WHERE id = ?', [this.calcTier(u.rating), u.id]);
      }
    }

    // top3 중 rating > 0인 유저에게 challenger 부여
    for (const u of top3) {
      if ((u.rating || 0) > 0) {
        await run('UPDATE users SET tier = ? WHERE id = ?', ['challenger', u.id]);
      }
    }
  },

  // ── 설정 ─────────────────────────────────────────────────────────────────

  // 기본 설정값 정의 — settings JSON 컬럼의 스키마 표준
  getDefaultSettings() {
    return {
      notifications: {
        community_reply:   true,  // 내 글에 댓글
        community_like:    true,  // 내 글에 좋아요
        mention:           true,  // @멘션
        follow:            true,  // 새 팔로워
        answer_accepted:   true,  // 내 답변 채택
        system:            true,  // 시스템 공지
        email_digest:      false, // 주간 이메일 요약
      },
      ui: {
        theme:             'system', // 'light' | 'dark' | 'system'
        feed_layout:       'card',   // 'card' | 'compact'
        default_board:     'qna',    // 기본 게시판
        show_solved_badge: true,
        code_font_size:    14,
      },
      editor: {
        font_size:         14,
        tab_size:          2,
        vim_mode:          false,
        auto_close_brackets: true,
        line_numbers:      true,
      },
      privacy: {
        show_solve_history: true,
        show_rating:        true,
        allow_follow:       true,
      },
    };
  },

  // settings JSON을 깊은 병합으로 업데이트
  async updateSettings(id, patch) {
    const user = await this.findById(id);
    if (!user) throw Object.assign(new Error('유저 없음'), { status: 404 });

    const defaults = this.getDefaultSettings();
    const current = safeParseJSON(user.settings, {});

    // 허용된 최상위 키만 병합 (임의 키 주입 방지)
    const ALLOWED_SECTIONS = new Set(['notifications', 'ui', 'editor', 'privacy']);
    const merged = { ...defaults, ...current };
    for (const [section, values] of Object.entries(patch)) {
      if (!ALLOWED_SECTIONS.has(section)) continue;
      if (typeof values !== 'object' || values === null) continue;
      merged[section] = { ...(merged[section] || {}), ...values };
    }

    await run('UPDATE users SET settings = ? WHERE id = ?', [JSON.stringify(merged), id]);
    return merged;
  },

  // ── 닉네임 관리 ──────────────────────────────────────────────────────────

  // 닉네임 중복 확인 (본인 제외)
  async findByNickname(nickname) {
    return queryOne('SELECT id FROM users WHERE nickname = ?', [nickname]);
  },

  // 닉네임 설정/변경 — 30일 쿨다운 적용 (최초 설정 시에는 제한 없음)
  async setNickname(id, nickname) {
    const user = await queryOne('SELECT nickname, nickname_changed_at FROM users WHERE id = ?', [id]);
    if (!user) throw Object.assign(new Error('유저 없음'), { status: 404 });

    // 중복 확인
    const conflict = await queryOne('SELECT id FROM users WHERE nickname = ? AND id != ?', [nickname, id]);
    if (conflict) throw Object.assign(new Error('이미 사용 중인 닉네임입니다.'), { status: 409 });

    // 30일 쿨다운 (최초 설정 시 nickname_changed_at이 NULL이므로 통과)
    if (user.nickname_changed_at) {
      const diffMs = Date.now() - new Date(user.nickname_changed_at).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < 30) {
        const remaining = Math.ceil(30 - diffDays);
        throw Object.assign(
          new Error(`닉네임은 30일마다 변경할 수 있습니다. ${remaining}일 후에 다시 시도해주세요.`),
          { status: 429 }
        );
      }
    }

    await run('UPDATE users SET nickname = ?, nickname_changed_at = NOW() WHERE id = ?', [nickname, id]);
    return this.findById(id);
  },

  // 프로필 / 게시글 목록 공개여부 토글
  async setVisibility(id, { profile_visibility, post_visibility }) {
    const updates = {};
    const VALID = new Set(['public', 'followers', 'private']);
    if (VALID.has(profile_visibility)) updates.profile_visibility = profile_visibility;
    if (VALID.has(post_visibility))    updates.post_visibility    = post_visibility;
    if (Object.keys(updates).length === 0) throw Object.assign(new Error('변경할 설정값이 없습니다.'), { status: 400 });
    return this.update(id, updates);
  },

  // ── 차단 ─────────────────────────────────────────────────────────────────

  async toggleBlock(blockerId, blockedId) {
    const existing = await queryOne(
      'SELECT 1 FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?',
      [blockerId, blockedId]
    );
    if (existing) {
      await run('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [blockerId, blockedId]);
      return { blocked: false };
    }
    await run('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)', [blockerId, blockedId]);
    return { blocked: true };
  },

  // 내가 차단한 유저 ID 목록
  async getBlockedIds(userId) {
    const rows = await query('SELECT blocked_id FROM user_blocks WHERE blocker_id = ?', [userId]);
    return (rows || []).map(r => r.blocked_id);
  },

  // ── 잔디 데이터 (52주) ────────────────────────────────────────────────────
  async getGrass(userId) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const d365 = new Date(); d365.setDate(d365.getDate() - 364);
    const prevYear = d365.getFullYear();
    const cutoff = d365.toISOString().slice(0, 10);

    const years = [currentYear];
    if (prevYear !== currentYear) years.push(prevYear);

    const allData = {};
    for (const y of years) {
      const key = `user:${userId}:heatmap:${y}`;
      let hash = await redis.hGetAll(key);

      if (!hash || !hash._hydrated) {
        // MySQL에서 해당 연도 데이터 전체 가져와서 Redis 동기화
        const logs = await query(
          'SELECT solve_date, count FROM solve_logs WHERE user_id=? AND solve_date BETWEEN ? AND ?',
          [userId, `${y}-01-01`, `${y}-12-31`]
        );
        const yearData = { _hydrated: '1' };
        for (const log of logs) {
          const dateStr = typeof log.solve_date === 'string' ? log.solve_date : new Date(log.solve_date).toISOString().slice(0, 10);
          yearData[dateStr] = String(log.count);
        }
        await redis.hSet(key, yearData);
        await redis.expire(key, 86400 * 30); // 30일 유지
        hash = yearData;
      }

      delete hash._hydrated;
      Object.assign(allData, hash);
    }

    return Object.entries(allData)
      .filter(([date]) => date >= cutoff)
      .map(([date, level]) => ({
        date,
        level: Number(level)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  // 북마크 토글
  async toggleBookmark(userId, problemId) {
    const exists = await queryOne(
      'SELECT 1 FROM bookmarks WHERE user_id = ? AND problem_id = ?',
      [userId, problemId]
    );
    if (exists) {
      await run('DELETE FROM bookmarks WHERE user_id = ? AND problem_id = ?', [userId, problemId]);
      return false;
    }
    await run('INSERT INTO bookmarks (user_id, problem_id) VALUES (?,?)', [userId, problemId]);
    return true;
  },

  async getBookmarks(userId) {
    return query(
      'SELECT problem_id FROM bookmarks WHERE user_id = ?',
      [userId]
    );
  },

  // 푼 문제 목록
  async getSolvedIds(userId) {
    const rows = await query(
      'SELECT DISTINCT problem_id FROM submissions WHERE user_id = ? AND result = ?',
      [userId, 'correct']
    );
    return rows.map(r => r.problem_id);
  },

  calcPracticeTier(solvedCount = 0) {
    if (solvedCount >= 60) return 'diamond';
    if (solvedCount >= 40) return 'platinum';
    if (solvedCount >= 25) return 'gold';
    if (solvedCount >= 12) return 'silver';
    if (solvedCount >= 5) return 'bronze';
    return 'unranked';
  },

  async getPracticeTracks(userId) {
    const [solvedRows, problemRows] = await Promise.all([
      query('SELECT DISTINCT problem_id FROM submissions WHERE user_id=? AND result=?', [userId, 'correct']),
      query('SELECT id, COALESCE(problem_type, "coding") AS problem_type FROM problems', []),
    ]);
    const typeById = new Map((problemRows || []).map((row) => [Number(row.id), row.problem_type || 'coding']));
    let fillBlankSolved = 0;
    let bugFixSolved = 0;
    for (const row of solvedRows || []) {
      const type = typeById.get(Number(row.problem_id));
      if (type === 'fill-blank') fillBlankSolved += 1;
      if (type === 'bug-fix') bugFixSolved += 1;
    }

    return {
      fillBlank: {
        solvedCount: fillBlankSolved,
        tier: this.calcPracticeTier(fillBlankSolved),
      },
      bugFix: {
        solvedCount: bugFixSolved,
        tier: this.calcPracticeTier(bugFixSolved),
      },
    };
  },

  safe(user) {
    if (!user) return null;
    // Explicit whitelist — prevents new DB columns (oauth_id, oauth_provider, etc.) from leaking
    return {
      id:            user.id,
      email:         user.email,
      username:      user.username,
      nickname:      user.nickname ?? null,
      // 소셜 가입 후 닉네임 미설정 시 프론트가 닉네임 설정 페이지로 유도하는 플래그
      nicknameSetupRequired: user.nickname == null,
      role:          user.role,
      tier:          user.tier,
      rating:        user.rating,
      streak:        user.streak,
      bio:           user.bio,
      avatar_url:    user.avatar_url,
      solvedCount:   user.solved_count ?? 0,
      joinDate:      user.join_date  ? new Date(user.join_date).toISOString().slice(0,10) : null,
      lastLogin:     user.last_login ? new Date(user.last_login).toISOString() : null,
      equippedBadge:  user.equipped_badge  ?? null,
      equippedTitle:  user.equipped_title  ?? null,
      achievement:    user.achievement ?? null,
      emailVerified:  user.email_verified  ? true : false,
      bannedAt:       user.banned_at  ?? null,
      banReason:      user.ban_reason ?? null,
      avatarColor:    user.avatar_color ?? null,
      avatarEmoji:    user.avatar_emoji ?? null,
      defaultLanguage: user.default_language || 'python',
      submissionsPublic: user.submissions_public === undefined ? true : Boolean(user.submissions_public),
      profileVisibility: user.profile_visibility || 'public',
      postVisibility:    user.post_visibility    || 'public',
      displayName:  user.display_name ?? null,
      socialLinks: safeParseJSON(user.social_links, {}),
      techStack: safeParseJSON(user.tech_stack, []),
      settings: safeParseJSON(user.settings, {}),
      equippedBackground: user.equipped_background ?? null,
      avatarUrlCustom: user.avatar_url_custom ?? null,
    };
  },
};
