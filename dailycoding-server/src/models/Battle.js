import redis from '../config/redis.js';
import crypto from 'crypto';
import { query, run } from '../config/mysql.js';

const ROOM_TTL   = 7200; // 2 hours
const INVITE_TTL = 120;  // 2 minutes to accept
const BATTLE_SETTINGS_KEY = 'admin:battle:settings';
const DEFAULT_BATTLE_SETTINGS = Object.freeze({
  codingCount: 2,
  fillBlankCount: 1,
  bugFixCount: 1,
  maxTotalProblems: 8,
});

// ── Special battle-only problem types ───────────────────────────────────────
const FILL_BLANK_PROBLEMS = [
  {
    id: 'fb_1', type: 'fill-blank',
    preferredLanguage: 'python',
    title: '빈칸 채우기: 재귀 피보나치',
    desc: '피보나치 수열을 구하는 재귀 함수의 빈칸을 채우세요.',
    codeTemplate: 'def fib(n):\n    if n <= ___1___:\n        return n\n    return fib(n - ___2___) + fib(n - ___3___)',
    blanks: ['1', '1', '2'],
    hint: 'fib(0)=0, fib(1)=1이므로 n이 작을 때 그냥 n을 반환합니다.',
  },
  {
    id: 'fb_2', type: 'fill-blank',
    preferredLanguage: 'python',
    title: '빈칸 채우기: 이진 탐색',
    desc: '이진 탐색 코드의 빈칸을 채우세요.',
    codeTemplate: 'def binary_search(arr, target):\n    lo, hi = ___1___, len(arr) - 1\n    while lo <= hi:\n        mid = (lo + hi) // ___2___\n        if arr[mid] == target: return mid\n        elif arr[mid] < target: lo = ___3___\n        else: hi = mid - 1\n    return -1',
    blanks: ['0', '2', 'mid + 1'],
    hint: '탐색 범위를 절반으로 줄이면서 mid를 계산하세요.',
  },
];

const BUG_FIX_PROBLEMS = [
  {
    id: 'bf_1', type: 'bug-fix',
    preferredLanguage: 'python',
    title: '버그 수정: 최댓값 찾기',
    desc: '배열에서 최댓값을 찾는 코드입니다. 버그를 찾아 수정한 줄을 입력하세요.',
    buggyCode: 'def find_max(arr):\n    max_val = 0      # 버그 있음!\n    for x in arr:\n        if x > max_val:\n            max_val = x\n    return max_val',
    correctAnswerKeyword: 'arr[0]',
    explanation: 'max_val = 0으로 초기화하면 모든 원소가 음수일 때 오동작합니다. arr[0]으로 초기화해야 합니다.',
    hint: '모든 원소가 음수인 배열 [-5, -3, -1]을 테스트해보세요.',
  },
  {
    id: 'bf_2', type: 'bug-fix',
    preferredLanguage: 'python',
    title: '버그 수정: 버블 정렬 IndexError',
    desc: '버블 정렬에서 IndexError가 발생합니다. 버그가 있는 줄을 수정해 입력하세요.',
    buggyCode: 'def bubble_sort(arr):\n    n = len(arr)\n    for i in range(n):\n        for j in range(n - i):  # 버그!\n            if arr[j] > arr[j + 1]:\n                arr[j], arr[j + 1] = arr[j + 1], arr[j]\n    return arr',
    correctAnswerKeyword: 'n - i - 1',
    explanation: 'range(n - i)는 j+1이 인덱스를 초과합니다. range(n - i - 1)로 수정해야 합니다.',
    hint: 'j+1이 배열 범위를 벗어나지 않도록 range의 상한을 조정하세요.',
  },
];

export const Battle = {
  FILL_BLANK_PROBLEMS,
  BUG_FIX_PROBLEMS,

  parseSpecialConfig(problem) {
    const raw = problem?.specialConfig ?? problem?.special_config ?? null;
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  },

  normalizeBattleProblem(problem, fallbackType = 'coding') {
    const type = problem.problemType || problem.problem_type || fallbackType;
    const config = this.parseSpecialConfig(problem) || {};
    if (type === 'fill-blank') {
      return {
        id: problem.id,
        type,
        title: problem.title,
        desc: problem.desc || problem.description || '',
        preferredLanguage: problem.preferredLanguage || problem.preferred_language || null,
        codeTemplate: config.codeTemplate || '',
        blanks: Array.isArray(config.blanks) ? config.blanks : [],
        hint: config.hint || problem.hint || '',
      };
    }
    if (type === 'bug-fix') {
      const keywords = Array.isArray(config.keywords) ? config.keywords : [];
      return {
        id: problem.id,
        type,
        title: problem.title,
        desc: problem.desc || problem.description || '',
        preferredLanguage: problem.preferredLanguage || problem.preferred_language || null,
        buggyCode: config.buggyCode || '',
        hint: config.hint || problem.hint || '',
        explanation: config.explanation || '',
        correctAnswerKeyword: keywords[0] || '',
        keywords,
      };
    }
    return {
      id: problem.id,
      title: problem.title,
      tier: problem.tier,
      desc: problem.desc || problem.description || '',
      examples: (problem.examples || []).slice(0, 2),
      timeLimit: problem.timeLimit || problem.time_limit || 2,
      preferredLanguage: problem.preferredLanguage || problem.preferred_language || null,
      type: 'coding',
    };
  },

  async getBattleSettings() {
    const saved = await redis.getJSON(BATTLE_SETTINGS_KEY);
    const base = saved && typeof saved === 'object' ? saved : DEFAULT_BATTLE_SETTINGS;
    const codingCount = Math.max(1, Math.min(8, Number(base.codingCount) || DEFAULT_BATTLE_SETTINGS.codingCount));
    const fillBlankCount = Math.max(0, Math.min(6, Number(base.fillBlankCount) || 0));
    const bugFixCount = Math.max(0, Math.min(6, Number(base.bugFixCount) || 0));
    return {
      codingCount,
      fillBlankCount,
      bugFixCount,
      maxTotalProblems: Math.max(3, Math.min(20, Number(base.maxTotalProblems) || DEFAULT_BATTLE_SETTINGS.maxTotalProblems)),
    };
  },

  async getBattleProblemPool({ preferredLanguage = null } = {}) {
    const params = [];
    let sql = `
      SELECT id, title, problem_type, preferred_language, special_config, tier,
             description, hint, time_limit, visibility, battle_eligible
      FROM problems
      WHERE COALESCE(visibility, 'global') = 'global'
        AND battle_eligible = 1
    `;

    if (preferredLanguage) {
      sql += ' AND (preferred_language IS NULL OR preferred_language = ?)';
      params.push(preferredLanguage);
    }

    return query(sql, params);
  },

  async selectProblems(dbProblemsOrOptions = [], options = {}) {
    const resolvedOptions = Array.isArray(dbProblemsOrOptions) ? options : (dbProblemsOrOptions || {});
    const preferredLanguage = resolvedOptions.preferredLanguage || null;
    const settings = await this.getBattleSettings();

    const dbPool = Array.isArray(dbProblemsOrOptions)
      ? dbProblemsOrOptions
      : await this.getBattleProblemPool({ preferredLanguage });
    const codingPool = dbPool
      .filter((p) => (p.visibility || 'global') === 'global')
      .filter((p) => Number(p.battle_eligible ?? 1) === 1)
      .filter((p) => (p.problemType || p.problem_type || 'coding') === 'coding')
      .filter((p) => !preferredLanguage || !p.preferredLanguage || p.preferredLanguage === preferredLanguage)
      .map((p) => this.normalizeBattleProblem(p, 'coding'));

    const fillBlankDbPool = dbPool
      .filter((p) => (p.visibility || 'global') === 'global')
      .filter((p) => Number(p.battle_eligible ?? 1) === 1)
      .filter((p) => (p.problemType || p.problem_type || 'coding') === 'fill-blank')
      .filter((p) => !preferredLanguage || !p.preferredLanguage || p.preferredLanguage === preferredLanguage)
      .map((p) => this.normalizeBattleProblem(p, 'fill-blank'))
      .filter((p) => p.codeTemplate && p.blanks?.length);
    const bugFixDbPool = dbPool
      .filter((p) => (p.visibility || 'global') === 'global')
      .filter((p) => Number(p.battle_eligible ?? 1) === 1)
      .filter((p) => (p.problemType || p.problem_type || 'coding') === 'bug-fix')
      .filter((p) => !preferredLanguage || !p.preferredLanguage || p.preferredLanguage === preferredLanguage)
      .map((p) => this.normalizeBattleProblem(p, 'bug-fix'))
      .filter((p) => p.buggyCode && (p.correctAnswerKeyword || p.keywords?.length));

    // DB에 없을 때만 정적 풀 fallback
    const fbCandidates = fillBlankDbPool.length > 0
      ? fillBlankDbPool
      : (preferredLanguage
        ? FILL_BLANK_PROBLEMS.filter((problem) => !problem.preferredLanguage || problem.preferredLanguage === preferredLanguage)
        : FILL_BLANK_PROBLEMS);
    const bfCandidates = bugFixDbPool.length > 0
      ? bugFixDbPool
      : (preferredLanguage
        ? BUG_FIX_PROBLEMS.filter((problem) => !problem.preferredLanguage || problem.preferredLanguage === preferredLanguage)
        : BUG_FIX_PROBLEMS);
    const fbPool = fbCandidates.length > 0 ? fbCandidates : [{ id: 'empty_fb', title: '빈칸 채우기 문제 없음', type: 'fill-blank', preferredLanguage, desc: '관리자에게 문의하세요.', codeTemplate: '', blanks: [] }];
    const bfPool = bfCandidates.length > 0 ? bfCandidates : [{ id: 'empty_bf', title: '버그 수정 문제 없음', type: 'bug-fix', preferredLanguage, desc: '관리자에게 문의하세요.', buggyCode: '', correctAnswerKeyword: '' }];

    const pickMany = (arr, count) => [...arr].sort(() => Math.random() - 0.5).slice(0, Math.max(0, count));
    const coding = pickMany(codingPool, settings.codingCount);
    const fb = pickMany(fbPool, settings.fillBlankCount);
    const bf = pickMany(bfPool, settings.bugFixCount);
    const problems = [...coding, ...fb, ...bf].slice(0, settings.maxTotalProblems);
    return problems;
  },

  // 이전 호출 호환용: 기존 sync 호출이 있을 수 있어 Promise resolve 형태로 유지됨

  async getActiveRooms() {
    const keys = await redis.scan('battle:room:*');
    const rooms = [];
    for (const key of keys) {
      const room = await redis.getJSON(key);
      if (room && room.status === 'active') {
        // 불필요한 필드 제거 (관전 목록용 최소 정보)
        rooms.push({
          id: room.id,
          status: room.status,
          players: room.players,
          isTeamBattle: room.isTeamBattle,
        });
      }
    }
    return rooms;
  },

  buildHistoryRows(roomId, room) {
    const players = Object.values(room?.players || {});
    const teamScores = {};
    players.forEach((player) => {
      teamScores[player.teamId] = (teamScores[player.teamId] || 0) + (player.score || 0);
    });

    const problemsJson = JSON.stringify((room?.problems || []).map((problem) => ({
      id: problem.id,
      title: problem.title,
      type: problem.type || 'coding',
    })));

    return players.map((player) => {
      const opponentPlayers = players.filter((item) => item.teamId !== player.teamId);
      const scoreFor = teamScores[player.teamId] || 0;
      const scoreAgainst = opponentPlayers.reduce((sum, item) => sum + (item.score || 0), 0);
      const solvedFor = Array.isArray(player.solved) ? player.solved.length : 0;
      const solvedAgainst = opponentPlayers.reduce((sum, item) => sum + ((item.solved || []).length || 0), 0);
      const opponentName = opponentPlayers.map((item) => item.username).join(', ') || '상대 없음';
      const opponentId = opponentPlayers[0]?.id || null;
      let result = 'draw';
      if (scoreFor > scoreAgainst) result = 'win';
      else if (scoreFor < scoreAgainst) result = 'lose';

      return {
        roomId,
        userId: player.id,
        opponentId,
        opponentName,
        result,
        scoreFor,
        scoreAgainst,
        solvedFor,
        solvedAgainst,
        problemsJson,
      };
    });
  },

  async persistHistory(roomId, room) {
    const rows = this.buildHistoryRows(roomId, room);
    for (const row of rows) {
      await run(
        `INSERT IGNORE INTO battle_history
         (room_id, user_id, opponent_id, opponent_name, result, score_for, score_against, solved_for, solved_against, problems_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.roomId,
          row.userId,
          row.opponentId,
          row.opponentName,
          row.result,
          row.scoreFor,
          row.scoreAgainst,
          row.solvedFor,
          row.solvedAgainst,
          row.problemsJson,
        ]
      );
    }
  },

  async getHistory(userId, limit = 20) {
    const cap = Math.min(Math.max(1, Number(limit) || 20), 100);
    const rows = await query(
       `SELECT id, room_id, opponent_id, opponent_name, result, score_for, score_against, solved_for, solved_against, problems_json, created_at
       FROM battle_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, cap]
    );
    return (rows || []).map((row) => ({
      id: row.id,
      roomId: row.room_id,
      opponentId: row.opponent_id,
      opponentName: row.opponent_name,
      result: row.result,
      scoreFor: row.score_for,
      scoreAgainst: row.score_against,
      solvedFor: row.solved_for,
      solvedAgainst: row.solved_against,
      problems: typeof row.problems_json === 'string' ? JSON.parse(row.problems_json) : (row.problems_json || []),
      createdAt: row.created_at,
    }));
  },

  async createRoom(inviter, invited, options = {}) {
    const roomId = 'room_' + crypto.randomBytes(5).toString('hex');
    const { isTeamBattle = false, teamSize = 1, preferredLanguage = null } = options;
    
    const room = {
      id: roomId,
      status: 'waiting',
      isTeamBattle,
      teamSize,
      playerIds: [inviter.id, invited.id],
      teams: {
        'team_1': [inviter.id],
        'team_2': [invited.id],
      },
      players: {
        [inviter.id]: { id: inviter.id, username: inviter.username, teamId: 'team_1', score: 0, solved: [], typing: false, typingAt: 0 },
        [invited.id]: { id: invited.id, username: invited.username, teamId: 'team_2', score: 0, solved: [], typing: false, typingAt: 0 },
      },
      spectators: [],
      problems: [],
      locked: {},   // { problemId: teamId } — territory capture is now team-based
      startTime: null,
      duration: 1800,
      preferredLanguage,
    };
    await redis.setJSON(`battle:room:${roomId}`, room, ROOM_TTL);
    await redis.setJSON(`battle:invite:${invited.id}`, {
      roomId, inviterName: inviter.username, isTeamBattle,
    }, INVITE_TTL);
    return room;
  },

  async joinAsSpectator(roomId, user) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    if (!room.spectators) room.spectators = [];
    if (!room.spectators.some(s => s.id === user.id)) {
      room.spectators.push({ id: user.id, username: user.username });
      await redis.setJSON(`battle:room:${roomId}`, room, ROOM_TTL);
    }
    return room;
  },

  async addPlayerToTeam(roomId, user, teamId) {
    const room = await this.getRoom(roomId);
    if (!room || room.status !== 'waiting') return null;
    if (!room.teams[teamId]) room.teams[teamId] = [];
    
    if (!room.playerIds.includes(user.id)) {
      room.playerIds.push(user.id);
      room.teams[teamId].push(user.id);
      room.players[user.id] = { id: user.id, username: user.username, teamId, score: 0, solved: [], typing: false, typingAt: 0 };
      await redis.setJSON(`battle:room:${roomId}`, room, ROOM_TTL);
    }
    return room;
  },

  async getRoom(roomId) {
    return redis.getJSON(`battle:room:${roomId}`);
  },

  async getInvite(userId) {
    return redis.getJSON(`battle:invite:${userId}`);
  },

  async acceptInvite(userId, roomId, problems) {
    const room = await this.getRoom(roomId);
    if (!room || room.status !== 'waiting') return null;
    room.status  = 'active';
    room.startTime = Date.now();
    room.problems  = problems;
    await redis.setJSON(`battle:room:${roomId}`, room, ROOM_TTL);
    await redis.del(`battle:invite:${userId}`);
    return room;
  },

  async declineInvite(userId, roomId) {
    const room = await this.getRoom(roomId);
    if (room) { room.status = 'declined'; await redis.setJSON(`battle:room:${roomId}`, room, 60); }
    await redis.del(`battle:invite:${userId}`);
  },

  async updateTyping(roomId, userId, isTyping) {
    const room = await this.getRoom(roomId);
    if (!room?.players?.[userId]) return;
    room.players[userId].typing  = isTyping;
    room.players[userId].typingAt = Date.now();
    await redis.setJSON(`battle:room:${roomId}`, room, ROOM_TTL);
  },

  async submitAnswer(roomId, userId, problemId, correct) {
    const room = await this.getRoom(roomId);
    if (!room || room.status !== 'active') return null;
    const player = room.players[userId];
    if (!player) return null;
    const pid = String(problemId);
    if (!player.solved.includes(pid) && correct) {
      player.solved.push(pid);
      player.score += 1;
      room.locked[pid] = player.teamId;  // territory capture is now team-based
      if (Object.keys(room.locked).length >= room.problems.length) room.status = 'ended';
    }
    await redis.setJSON(`battle:room:${roomId}`, room, ROOM_TTL);
    if (room.status === 'ended') {
      await this.persistHistory(roomId, room);
    }
    return room;
  },

  async endRoom(roomId) {
    const room = await this.getRoom(roomId);
    if (!room) return null;
    room.status = 'ended';
    await redis.setJSON(`battle:room:${roomId}`, room, ROOM_TTL);
    await this.persistHistory(roomId, room);
    return room;
  },
};
