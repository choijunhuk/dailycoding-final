import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { query, queryOne, insert } from '../config/mysql.js';
import { redis } from '../config/redis.js';
import { grantArcadeBadges } from '../services/badgeService.js';

const router = Router();
router.use(auth);
router.use(requireVerified);

// Games whose leaderboard supports a time-based metric (fastest clear).
const TIME_METRIC_GAMES = new Set([
  'tetris',        // sprint mode finished
  'code-typing',
  'code-wordle',
  'memory-match',
  'fifteen',
  'minesweeper',
]);

// Allowed games. Keep keys in sync with the frontend ArcadePage GAMES list.
const GAMES = [
  { key: 'output-guess', name: 'Output Guess',   nameKo: '출력 맞추기',  category: 'algorithm', emoji: '🔮', desc: 'Predict the output of a short code snippet.', descKo: '짧은 코드의 결과를 빠르게 맞추세요.' },
  { key: 'bigo-quiz',    name: 'Big-O Quiz',     nameKo: '빅오 퀴즈',    category: 'algorithm', emoji: '📈', desc: 'Pick the right time complexity.',          descKo: '코드를 보고 시간복잡도를 고르세요.' },
  { key: 'bug-hunt',     name: 'Bug Hunt',       nameKo: '버그 헌트',    category: 'debug',     emoji: '🐞', desc: 'Click the buggy line. Faster = more points.', descKo: '버그가 있는 줄을 클릭하세요. 빠를수록 점수 ↑' },
  { key: 'code-typing',  name: 'Code Typing',    nameKo: '코드 타자',    category: 'typing',    emoji: '⌨️', desc: 'Type real algorithm code as fast as you can.', descKo: '실제 알고리즘 코드를 정확하고 빠르게 입력하세요.' },
  { key: 'tetris',       name: 'Tetris',         nameKo: '테트리스',     category: 'classic',   emoji: '🟦', desc: 'The classic. Survive as long as you can.',    descKo: '클래식 테트리스. 오래 버티세요.' },
  { key: 'snake',        name: 'Vim Snake',      nameKo: '빔 스네이크',  category: 'classic',   emoji: '🐍', desc: 'Snake with hjkl controls. Eat semicolons.',   descKo: 'hjkl로 조작하는 스네이크. 세미콜론을 먹으세요.' },
  { key: '2048',         name: '2048',           nameKo: '2048',         category: 'classic',   emoji: '🔢', desc: 'Merge tiles. Reach 2048.',                    descKo: '타일을 합쳐 2048을 만드세요.' },
  { key: 'minesweeper',  name: 'Minesweeper',    nameKo: '지뢰찾기',     category: 'classic',   emoji: '💣', desc: 'Find all safe cells. Right-click to flag.',   descKo: '안전한 칸을 모두 찾으세요. 우클릭으로 깃발.' },
  { key: 'memory-match', name: 'Memory Match',   nameKo: '메모리 매치',  category: 'algorithm', emoji: '🃏', desc: 'Pair algorithms with their complexities.',    descKo: '알고리즘 이름과 시간복잡도 카드를 짝지으세요.' },
  { key: 'fifteen',      name: '15 Puzzle',      nameKo: '15 퍼즐',      category: 'classic',   emoji: '🧩', desc: 'Slide tiles to sort 1-15 in order.',          descKo: '타일을 밀어 1~15 순서대로 정렬하세요.' },
  { key: 'code-wordle',  name: 'Code Wordle',    nameKo: '코드 워들',    category: 'typing',    emoji: '🔤', desc: 'Guess the 5-letter coding word in 6 tries.',  descKo: '5글자 코딩 용어를 6번 안에 맞추세요.' },
];

const GAME_KEYS = new Set(GAMES.map((g) => g.key));

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function safeMeta(meta) {
  if (meta == null) return null;
  try {
    const json = typeof meta === 'string' ? meta : JSON.stringify(meta);
    // Cap metadata size to avoid abuse.
    return json.length > 4000 ? null : json;
  } catch {
    return null;
  }
}

router.get('/games', (req, res) => {
  res.json({ games: GAMES });
});

router.post('/score', async (req, res, next) => {
  try {
    const gameKey = String(req.body?.gameKey || '').trim();
    if (!GAME_KEYS.has(gameKey)) {
      return res.status(400).json({ message: 'Unknown gameKey' });
    }
    const rawScore = toInt(req.body?.score, 0);
    // Sane bounds: non-negative integer up to 9_999_999. Treat client-supplied score as user-reported (same as solve_time_sec).
    if (rawScore < 0 || rawScore > 9_999_999) {
      return res.status(400).json({ message: 'Invalid score' });
    }
    const meta = safeMeta(req.body?.meta);
    const id = await insert(
      'INSERT INTO arcade_scores (user_id, game_key, score, meta) VALUES (?, ?, ?, ?)',
      [req.user.id, gameKey, rawScore, meta]
    );

    // Invalidate leaderboard cache for this game (both score + time metrics).
    try { await redis.clearPrefix(`arcade:lb:${gameKey}`); } catch { /* ignore */ }

    // Grant arcade achievement badges. Best-effort — failures must not break score save.
    try {
      const parsedMeta = req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : null;
      await grantArcadeBadges(req.user.id, gameKey, rawScore, parsedMeta);
    } catch (badgeErr) {
      // eslint-disable-next-line no-console
      console.error('[arcade.grantArcadeBadges]', badgeErr?.message || badgeErr);
    }

    const myBest = await queryOne(
      'SELECT MAX(score) AS best FROM arcade_scores WHERE user_id = ? AND game_key = ?',
      [req.user.id, gameKey]
    );
    const rankRow = await queryOne(
      'SELECT 1 + COUNT(*) AS rank_pos FROM arcade_scores WHERE game_key = ? AND score > ?',
      [gameKey, rawScore]
    );

    res.json({
      id,
      score: rawScore,
      best: toInt(myBest?.best, rawScore),
      approxRank: toInt(rankRow?.rank_pos, 1),
      isNewBest: toInt(myBest?.best, 0) <= rawScore,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/leaderboard/:gameKey', async (req, res, next) => {
  try {
    const gameKey = String(req.params.gameKey || '').trim();
    if (!GAME_KEYS.has(gameKey)) {
      return res.status(404).json({ message: 'Unknown gameKey' });
    }
    const limit = Math.min(100, Math.max(5, toInt(req.query.limit, 20)));
    const requested = String(req.query.metric || 'score').toLowerCase();
    const metric = requested === 'time' && TIME_METRIC_GAMES.has(gameKey) ? 'time' : 'score';
    const cacheKey = `arcade:lb:${gameKey}:${metric}:${limit}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    } catch { /* ignore cache miss */ }

    let rows;
    if (metric === 'time') {
      // Fastest elapsed per user. JSON values must be unquoted before string
      // compare, and numeric-cast before sort — JSON_EXTRACT sorts JSON values
      // lexicographically (so "10" < "5"), which gives the wrong ranking.
      const tetrisFilter = gameKey === 'tetris'
        ? `AND s.meta->>'$.mode' = 'sprint' AND s.meta->>'$.finished' = 'true'`
        : '';
      rows = await query(
        `SELECT s.user_id, u.username, u.tier,
                MIN(CAST(s.meta->>'$.elapsed' AS DECIMAL(10,3))) AS elapsed_sec,
                MAX(s.score) AS score
         FROM arcade_scores s
         JOIN users u ON u.id = s.user_id
         WHERE s.game_key = ?
           AND s.meta->>'$.elapsed' IS NOT NULL
           AND CAST(s.meta->>'$.elapsed' AS DECIMAL(10,3)) > 0
           ${tetrisFilter}
         GROUP BY s.user_id, u.username, u.tier
         ORDER BY elapsed_sec ASC
         LIMIT ${limit}`,
        [gameKey]
      );
    } else {
      // Top score per user.
      rows = await query(
        `SELECT s.user_id, u.username, u.tier, MAX(s.score) AS score, MAX(s.played_at) AS played_at
         FROM arcade_scores s
         JOIN users u ON u.id = s.user_id
         WHERE s.game_key = ?
         GROUP BY s.user_id, u.username, u.tier
         ORDER BY score DESC, played_at ASC
         LIMIT ${limit}`,
        [gameKey]
      );
    }

    const leaderboard = (rows || []).map((row, index) => ({
      rank: index + 1,
      userId: row.user_id,
      username: row.username,
      tier: row.tier || 'unranked',
      score: toInt(row.score, 0),
      elapsedSec: row.elapsed_sec != null ? Number(row.elapsed_sec) : null,
      playedAt: row.played_at || null,
    }));

    const payload = { gameKey, metric, leaderboard };
    try { await redis.set(cacheKey, JSON.stringify(payload), 60); } catch { /* ignore */ }
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.get('/my-best', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT game_key, MAX(score) AS best, COUNT(*) AS plays
       FROM arcade_scores
       WHERE user_id = ?
       GROUP BY game_key`,
      [req.user.id]
    );
    const map = {};
    (rows || []).forEach((row) => {
      map[row.game_key] = { best: toInt(row.best, 0), plays: toInt(row.plays, 0) };
    });
    res.json({ bestByGame: map });
  } catch (err) {
    next(err);
  }
});

router.get('/top', async (req, res, next) => {
  try {
    const limit = Math.min(30, Math.max(3, toInt(req.query.limit, 5)));
    const out = {};
    for (const game of GAMES) {
      const rows = await query(
        `SELECT s.user_id, u.username, u.tier, MAX(s.score) AS score
         FROM arcade_scores s
         JOIN users u ON u.id = s.user_id
         WHERE s.game_key = ?
         GROUP BY s.user_id, u.username, u.tier
         ORDER BY score DESC
         LIMIT ${limit}`,
        [game.key]
      );
      out[game.key] = (rows || []).map((row, index) => ({
        rank: index + 1,
        userId: row.user_id,
        username: row.username,
        tier: row.tier || 'unranked',
        score: toInt(row.score, 0),
      }));
    }
    res.json({ topByGame: out });
  } catch (err) {
    next(err);
  }
});

export default router;
