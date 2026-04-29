import { getJudgeRuntime } from './judge.js';

let cachedJudgeRuntime = null;
let judgeRuntimeCheckedAt = 0;
const JUDGE_RUNTIME_CACHE_MS = 60_000;

function formatRuntimeLog(runtime) {
  const modeLabel = runtime.mode === 'docker-sandbox'
    ? '✅ docker-sandbox'
    : runtime.mode === 'native-subprocess'
      ? '⚠️ native-subprocess'
      : '❌ unavailable';
  return `[Judge] Mode ${modeLabel} (configured=${runtime.configuredMode}, dockerAvailable=${runtime.dockerAvailable}, supported=${(runtime.supportedLanguages || []).join(',') || 'none'})`;
}

export async function getCachedJudgeRuntime({ logOnRefresh = false } = {}) {
  if (cachedJudgeRuntime === null || Date.now() - judgeRuntimeCheckedAt > JUDGE_RUNTIME_CACHE_MS) {
    cachedJudgeRuntime = await getJudgeRuntime();
    judgeRuntimeCheckedAt = Date.now();
    if (logOnRefresh) {
      console.log(formatRuntimeLog(cachedJudgeRuntime));
    }
  }
  return cachedJudgeRuntime;
}

export function clearJudgeRuntimeCache() {
  cachedJudgeRuntime = null;
  judgeRuntimeCheckedAt = 0;
}
