import 'dotenv/config';
import { PROBLEMS } from '../src/shared/problemCatalog.js';
import { run, waitForDB, isConnected } from '../src/config/mysql.js';

const TAG_RULES = [
  { tag: 'recursion', patterns: [/재귀/i, /recursive/i, /recursion/i] },
  { tag: 'graph', patterns: [/그래프/i, /\bgraph\b/i] },
  { tag: 'bfs', patterns: [/\bBFS\b/i, /너비\s*우선/i] },
  { tag: 'dfs', patterns: [/\bDFS\b/i, /깊이\s*우선/i] },
  { tag: 'sorting', patterns: [/정렬/i, /\bsort(?:ing)?\b/i] },
  { tag: 'binary-search', patterns: [/이분\s*탐색/i, /이진\s*탐색/i, /binary\s*search/i] },
  { tag: 'dp', patterns: [/\bDP\b/i, /동적/i, /다이나믹\s*프로그래밍/i, /dynamic\s*programming/i] },
  { tag: 'hash', patterns: [/해시/i, /HashMap/i, /\bhash\b/i] },
  { tag: 'stack', patterns: [/스택/i, /\bStack\b/i] },
  { tag: 'queue', patterns: [/큐/i, /\bQueue\b/i] },
];

function inferTags(problem) {
  const haystack = [
    problem.title,
    problem.desc,
    problem.description,
    problem.inputDesc,
    problem.outputDesc,
    problem.hint,
    ...(problem.tags || []),
  ].filter(Boolean).join(' ');

  const tags = new Set(problem.tags || []);
  for (const rule of TAG_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) tags.add(rule.tag);
  }
  return [...tags].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'));
}

async function main() {
  await waitForDB();
  let tagged = 0;
  for (const problem of PROBLEMS) {
    const tags = inferTags(problem);
    if (tags.length === 0) continue;
    for (const tag of tags) {
      await run('INSERT IGNORE INTO problem_tags (problem_id, tag) VALUES (?, ?)', [problem.id, tag]);
    }
    tagged += 1;
    console.log(`Tagged problem ${problem.id} with [${tags.join(', ')}]`);
  }
  console.log(`Backfill complete: ${tagged} problem(s), database=${isConnected() ? 'mysql' : 'memory'}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('[backfill-problem-tags]', err.message);
  process.exit(1);
});
