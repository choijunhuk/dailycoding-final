import { createClient } from 'redis';

let client = null;
let connected = false;

// 인메모리 폴백 (Redis 없을 때)
const memStore = new Map();
const memTTL   = new Map();

function memGet(key) {
  const exp = memTTL.get(key);
  if (exp && Date.now() > exp) { memStore.delete(key); memTTL.delete(key); return null; }
  return memStore.get(key) ?? null;
}
function memSet(key, val, ttlSec) {
  memStore.set(key, val);
  if (ttlSec) memTTL.set(key, Date.now() + ttlSec * 1000);
}
function memDel(key) { memStore.delete(key); memTTL.delete(key); }

async function connect() {
  if (process.env.NODE_ENV === 'test') {
    connected = false;
    client = null;
    return;
  }

  try {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://:redis1234@localhost:6379',
    });
    client.on('error', () => { connected = false; });
    await client.connect();
    connected = true;
    console.log('✅ Redis 연결 성공');
  } catch (e) {
    console.warn('⚠️  Redis 연결 실패 - 인메모리 캐시로 동작합니다:', e.message);
    connected = false;
  }
}
connect();

// ── 공개 API ──────────────────────────────────────────────────────────────
export const redis = {
  async get(key) {
    if (connected) return await client.get(key);
    return memGet(key);
  },
  async set(key, val, ttlSec) {
    if (connected) {
      if (ttlSec) return await client.setEx(key, ttlSec, val);
      return await client.set(key, val);
    }
    memSet(key, val, ttlSec);
  },
  async del(key) {
    if (connected) return await client.del(key);
    memDel(key);
  },
  async scan(pattern) {
    if (connected) {
      let results = [];
      let cursor = 0;
      do {
        const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = reply.cursor;
        results = results.concat(reply.keys);
      } while (cursor !== 0);
      return results;
    }
    return Array.from(memStore.keys()).filter(k => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(k);
    });
  },
  // ★ 프리픽스로 캐시 일괄 삭제 (SCAN 사용 — KEYS는 Redis 전체를 블로킹함)
  async clearPrefix(prefix) {
    if (connected) {
      try {
        let cursor = 0;
        do {
          const reply = await client.scan(cursor, { MATCH: prefix + '*', COUNT: 100 });
          cursor = reply.cursor;
          if (reply.keys.length > 0) await client.del(reply.keys);
        } while (cursor !== 0);
      } catch {
        // Cache invalidation is best-effort; callers should not fail on Redis scan issues.
      }
    } else {
      for (const k of memStore.keys()) {
        if (k.startsWith(prefix)) { memStore.delete(k); memTTL.delete(k); }
      }
    }
  },
  async incr(key, ttlSec) {
    if (connected) {
      const v = await client.incr(key);
      // Set expiry only on first increment so the window expires correctly
      if (v === 1 && ttlSec) await client.expire(key, ttlSec);
      return v;
    }
    const v = Number(memGet(key) || 0) + 1;
    memSet(key, String(v), v === 1 ? ttlSec : undefined);
    return v;
  },
  // Sorted Sets
  async zAdd(key, score, member, ttlSec) {
    if (connected) {
      const result = await client.zAdd(key, [{ score, value: String(member) }]);
      if (ttlSec && ttlSec > 0) {
        await client.expire(key, ttlSec);
      }
      return result;
    }
    const set = memGet(key) || new Map();
    set.set(String(member), score);
    memSet(key, set, ttlSec);
  },
  async zAddMany(key, members, ttlSec) {
    if (connected) {
      const result = await client.zAdd(key, members.map(m => ({ score: m.score, value: String(m.value) })));
      if (ttlSec && ttlSec > 0) {
        await client.expire(key, ttlSec);
      }
      return result;
    }
    const set = memGet(key) || new Map();
    for (const m of members) set.set(String(m.value), m.score);
    memSet(key, set, ttlSec);
  },
  async zRevRangeWithScores(key, start, stop) {
    if (connected) return await client.zRangeWithScores(key, start, stop, { REV: true });
    const set = memGet(key);
    if (!set) return [];
    return Array.from(set.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(start, stop + 1)
      .map(([value, score]) => ({ score, value }));
  },
  async exists(key) {
    if (connected) return await client.exists(key);
    return memStore.has(key) ? 1 : 0;
  },
  async expire(key, ttlSec) {
    if (connected) return await client.expire(key, ttlSec);
    const val = memStore.get(key);
    if (val !== undefined) memTTL.set(key, Date.now() + ttlSec * 1000);
  },
  // Hash Operations
  async hSet(key, fieldOrObj, value) {
    if (connected) {
      if (typeof fieldOrObj === 'object') return await client.hSet(key, fieldOrObj);
      return await client.hSet(key, fieldOrObj, String(value));
    }
    const hash = memGet(key) || {};
    if (typeof fieldOrObj === 'object') {
      for (const [f, v] of Object.entries(fieldOrObj)) hash[f] = String(v);
    } else {
      hash[fieldOrObj] = String(value);
    }
    memSet(key, hash);
  },
  async hIncrBy(key, field, increment) {
    if (connected) return await client.hIncrBy(key, field, increment);
    const hash = memGet(key) || {};
    hash[field] = (Number(hash[field]) || 0) + increment;
    memSet(key, hash);
    return hash[field];
  },
  async hGetAll(key) {
    if (connected) return await client.hGetAll(key);
    return memGet(key) || {};
  },
  // SET if Not eXists — Redis의 원자적 SET NX EX 활용 (race condition 방지용 mutex)
  async setNX(key, val, ttlSec) {
    if (connected) {
      const result = await client.set(key, val, { NX: true, EX: ttlSec });
      return result === 'OK';
    }
    // in-memory fallback: TTL 만료 체크 후 원자적으로 처리
    const existing = memGet(key);
    if (existing !== null) return false;
    memSet(key, val, ttlSec);
    return true;
  },
  async ttl(key) {
    if (connected) return await client.ttl(key);
    const expiresAt = memTTL.get(key);
    if (!expiresAt) return -1;
    if (Date.now() > expiresAt) {
      memStore.delete(key);
      memTTL.delete(key);
      return -2;
    }
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  },
  // JSON 편의 메서드
  async getJSON(key) {
    const v = await redis.get(key);
    return v ? JSON.parse(v) : null;
  },
  async setJSON(key, obj, ttlSec) {
    return await redis.set(key, JSON.stringify(obj), ttlSec);
  },
  async ping() {
    if (connected) {
      const result = await client.ping();
      return result === 'PONG';
    }
    return false;
  },
  isConnected: () => connected,
};

export function getRedisClient() {
  return client;
}

export function __setRedisClientForTests(nextClient, isConnected = false) {
  client = nextClient;
  connected = isConnected;
}

export async function closeRedis() {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    // Shutdown cleanup should tolerate already-closed Redis connections.
  }
  client = null;
  connected = false;
}

export default redis;
