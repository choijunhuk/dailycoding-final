import { Router } from 'express';
import { auth, requireVerified } from '../middleware/auth.js';
import { query, queryOne, insert } from '../config/mysql.js';
import { redis } from '../config/redis.js';
import { grantArcadeBadges } from '../services/badgeService.js';

const router = Router();
router.use(auth);
router.use(requireVerified);

// Metric kinds:
//   - score    → MAX(score) DESC               (high score wins)
//   - time     → MIN(elapsed) ASC              (fastest finish wins)
//   - survival → MAX(elapsed) DESC             (longest endurance wins)
const VALID_METRICS = new Set(['score', 'time', 'survival']);

// Games whose leaderboard supports a non-score metric outside of mode routing
// (used when the game has no internal modes).
const TIME_METRIC_GAMES = new Set([
  'tetris',        // sprint mode finished
  'code-typing',
  'code-wordle',
  'memory-match',
  'fifteen',
  'minesweeper',
]);

// Games whose leaderboard splits by an internal mode. Keep `metric` aligned
// with what each mode is actually scored by — wrong metric = wrong ranking.
const MODE_GAMES = {
  tetris: [
    { key: 'classic',   name: 'Classic',   nameKo: '클래식',     metric: 'survival', desc: '얼마나 오래 버텼는지 — 생존 시간 랭킹.' },
    { key: 'sprint',    name: 'Sprint 40', nameKo: '스프린트 40', metric: 'time',     desc: '40줄 가장 빠르게 클리어.' },
    { key: 'ultra',     name: 'Ultra 2m',  nameKo: '울트라 2분',  metric: 'score',    desc: '2분 안에 최고 점수.' },
    { key: 'invisible', name: 'Invisible', nameKo: '인비저블',   metric: 'survival', desc: '블록이 사라지는 인비저블 모드에서 가장 오래.' },
  ],
  minesweeper: [
    { key: 'easy',   name: 'Easy 9x9',     nameKo: '이지 9x9',    metric: 'time', desc: '9x9 / 지뢰 10. 클리어 최단 시간.' },
    { key: 'medium', name: 'Medium 16x16', nameKo: '미디엄 16x16', metric: 'time', desc: '16x16 / 지뢰 40. 클리어 최단 시간.' },
    { key: 'hard',   name: 'Hard 30x16',   nameKo: '하드 30x16',   metric: 'time', desc: '30x16 / 지뢰 99. 클리어 최단 시간.' },
  ],
  '2048': [
    { key: 'classic',     name: 'Classic',          nameKo: '클래식',       metric: 'score', desc: '무제한. 최고 점수까지 도달.' },
    { key: 'time-attack', name: 'Time Attack 3m',   nameKo: '타임어택 3분', metric: 'score', desc: '3분 안에 최대한 높은 점수.' },
  ],
};

function modesFor(gameKey) {
  return MODE_GAMES[gameKey] || null;
}

function findMode(gameKey, mode) {
  const modes = modesFor(gameKey);
  if (!modes) return null;
  return modes.find((m) => m.key === mode) || null;
}

// Resolve the effective mode for a moded game. If the caller passes a valid
// mode, use it. Otherwise pick the first mode matching the requested metric.
function resolveMode(gameKey, requestedMode, metric) {
  const modes = modesFor(gameKey);
  if (!modes) return null;
  if (findMode(gameKey, requestedMode)) return requestedMode;
  const byMetric = modes.find((m) => m.metric === metric);
  return (byMetric || modes[0]).key;
}

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
  res.json({ games: GAMES, modes: MODE_GAMES });
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
    const requestedMode = String(req.query.mode || '').trim();
    const modeInfo = findMode(gameKey, requestedMode);

    // For moded games, the mode dictates the metric — only one ranking shape
    // is meaningful per mode. Otherwise honor the `metric` query (clamped to
    // the game's capability set).
    let metric;
    let mode = null;
    if (modesFor(gameKey)) {
      mode = modeInfo ? requestedMode : resolveMode(gameKey, '', 'score');
      const resolved = findMode(gameKey, mode);
      metric = resolved ? resolved.metric : 'score';
    } else {
      const requested = String(req.query.metric || 'score').toLowerCase();
      if (!VALID_METRICS.has(requested)) metric = 'score';
      else if (requested === 'time' && TIME_METRIC_GAMES.has(gameKey)) metric = 'time';
      else if (requested === 'survival') metric = 'score';
      else metric = 'score';
    }

    const cacheKey = `arcade:lb:${gameKey}:${metric}:${mode || 'none'}:${limit}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    } catch { /* ignore cache miss */ }

    // Build mode-scoped filter via a parameterized value.
    const params = [gameKey];
    let modeFilter = '';
    if (mode) {
      modeFilter = `AND s.meta->>'$.mode' = ?`;
      params.push(mode);
    }

    let rows;
    if (metric === 'time' || metric === 'survival') {
      // Elapsed-based metrics. JSON values must be unquoted before string
      // compare, and numeric-cast before sort — JSON_EXTRACT sorts JSON values
      // lexicographically (so "10" < "5"), which gives the wrong ranking.
      // Tetris sprint runs only count if `finished` (40 lines reached);
      // minesweeper time runs only count if `won` (otherwise dying instantly = 1s win).
      const tetrisSprintFinished = (gameKey === 'tetris' && mode === 'sprint')
        ? `AND s.meta->>'$.finished' = 'true'`
        : '';
      const minesweeperWon = (gameKey === 'minesweeper' && metric === 'time')
        ? `AND s.meta->>'$.won' = 'true'`
        : '';
      const isSurvival = metric === 'survival';
      const aggregate = isSurvival ? 'MAX' : 'MIN';
      const order = isSurvival ? 'DESC' : 'ASC';
      rows = await query(
        `SELECT s.user_id, u.username, u.tier,
                ${aggregate}(CAST(s.meta->>'$.elapsed' AS DECIMAL(10,3))) AS elapsed_sec,
                MAX(s.score) AS score
         FROM arcade_scores s
         JOIN users u ON u.id = s.user_id
         WHERE s.game_key = ?
           AND s.meta->>'$.elapsed' IS NOT NULL
           AND CAST(s.meta->>'$.elapsed' AS DECIMAL(10,3)) > 0
           ${modeFilter}
           ${tetrisSprintFinished}
           ${minesweeperWon}
         GROUP BY s.user_id, u.username, u.tier
         ORDER BY elapsed_sec ${order}
         LIMIT ${limit}`,
        params
      );
    } else {
      // Top score per user.
      rows = await query(
        `SELECT s.user_id, u.username, u.tier, MAX(s.score) AS score, MAX(s.played_at) AS played_at
         FROM arcade_scores s
         JOIN users u ON u.id = s.user_id
         WHERE s.game_key = ?
           ${modeFilter}
         GROUP BY s.user_id, u.username, u.tier
         ORDER BY score DESC, played_at ASC
         LIMIT ${limit}`,
        params
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

    const payload = { gameKey, metric, mode, modes: modesFor(gameKey), leaderboard };
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

    // For games with modes, also return per-mode best (score + best elapsed
    // separately) so the UI can show "your PB" per mode card.
    const bestByGameMode = {};
    for (const [gameKey, modes] of Object.entries(MODE_GAMES)) {
      const modeRows = await query(
        `SELECT s.meta->>'$.mode' AS mode,
                MAX(s.score) AS best_score,
                MAX(CAST(s.meta->>'$.elapsed' AS DECIMAL(10,3))) AS max_elapsed,
                MIN(CAST(s.meta->>'$.elapsed' AS DECIMAL(10,3))) AS min_elapsed,
                COUNT(*) AS plays
         FROM arcade_scores s
         WHERE s.user_id = ?
           AND s.game_key = ?
           AND s.meta->>'$.mode' IS NOT NULL
         GROUP BY s.meta->>'$.mode'`,
        [req.user.id, gameKey]
      );
      const perMode = {};
      for (const m of modes) perMode[m.key] = { best: 0, plays: 0, minElapsed: null, maxElapsed: null };
      (modeRows || []).forEach((row) => {
        const k = row.mode;
        if (!perMode[k]) return;
        perMode[k] = {
          best: toInt(row.best_score, 0),
          plays: toInt(row.plays, 0),
          minElapsed: row.min_elapsed != null ? Number(row.min_elapsed) : null,
          maxElapsed: row.max_elapsed != null ? Number(row.max_elapsed) : null,
        };
      });
      bestByGameMode[gameKey] = perMode;
    }

    res.json({ bestByGame: map, bestByGameMode });
  } catch (err) {
    next(err);
  }
});

router.get('/top', async (req, res, next) => {
  try {
    const limit = Math.min(30, Math.max(3, toInt(req.query.limit, 5)));
    const out = {};
    const topByGameMode = {};
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

      // For moded games, also emit a per-mode top that uses each mode's
      // declared metric — score-only mixing across modes is meaningless.
      const modes = modesFor(game.key);
      if (modes) {
        const perMode = {};
        for (const m of modes) {
          const isElapsed = m.metric === 'time' || m.metric === 'survival';
          const isSurvival = m.metric === 'survival';
          const tetrisSprintFinished = (game.key === 'tetris' && m.key === 'sprint') ? `AND s.meta->>'$.finished' = 'true'` : '';
          const minesweeperWon = (game.key === 'minesweeper' && m.metric === 'time') ? `AND s.meta->>'$.won' = 'true'` : '';
          let modeRows;
          if (isElapsed) {
            const aggregate = isSurvival ? 'MAX' : 'MIN';
            const order = isSurvival ? 'DESC' : 'ASC';
            modeRows = await query(
              `SELECT s.user_id, u.username, u.tier,
                      ${aggregate}(CAST(s.meta->>'$.elapsed' AS DECIMAL(10,3))) AS elapsed_sec,
                      MAX(s.score) AS score
               FROM arcade_scores s
               JOIN users u ON u.id = s.user_id
               WHERE s.game_key = ?
                 AND s.meta->>'$.mode' = ?
                 AND s.meta->>'$.elapsed' IS NOT NULL
                 AND CAST(s.meta->>'$.elapsed' AS DECIMAL(10,3)) > 0
                 ${tetrisSprintFinished}
                 ${minesweeperWon}
               GROUP BY s.user_id, u.username, u.tier
               ORDER BY elapsed_sec ${order}
               LIMIT ${limit}`,
              [game.key, m.key]
            );
          } else {
            modeRows = await query(
              `SELECT s.user_id, u.username, u.tier, MAX(s.score) AS score
               FROM arcade_scores s
               JOIN users u ON u.id = s.user_id
               WHERE s.game_key = ? AND s.meta->>'$.mode' = ?
               GROUP BY s.user_id, u.username, u.tier
               ORDER BY score DESC
               LIMIT ${limit}`,
              [game.key, m.key]
            );
          }
          perMode[m.key] = (modeRows || []).map((row, index) => ({
            rank: index + 1,
            userId: row.user_id,
            username: row.username,
            tier: row.tier || 'unranked',
            score: toInt(row.score, 0),
            elapsedSec: row.elapsed_sec != null ? Number(row.elapsed_sec) : null,
            metric: m.metric,
          }));
        }
        topByGameMode[game.key] = perMode;
      }
    }
    res.json({ topByGame: out, topByGameMode, modes: MODE_GAMES });
  } catch (err) {
    next(err);
  }
});

export default router;
