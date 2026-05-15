import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

function runGit(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function readMaybe(path, maxChars = 5000) {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8').slice(0, maxChars).trim();
}

const task = process.argv.slice(2).join(' ').trim() || '<작업 목표를 여기에 적으세요>';
const statusLines = runGit(['status', '--short']).split('\n').filter(Boolean);
const noisyPathPattern = /^(\S{1,2})\s+("?)(\.om[cox]\/|\.claude\/|\.playwright-mcp\/|dailycoding\/\.omc\/|dailycoding-server\/\.omc\/|dailycoding\/src\/\.omc\/|스크린샷|mobile-.*\.png|[^/]+\.(png|jpe?g|webp|avif|svg))/i;
const productStatusLines = statusLines.filter((line) => !noisyPathPattern.test(line.trim()));
const omittedStatusCount = statusLines.length - productStatusLines.length;
const status = [
  ...productStatusLines.slice(0, 80),
  ...(productStatusLines.length > 80 ? [`... ${productStatusLines.length - 80} more product-status line(s) omitted`] : []),
  ...(omittedStatusCount > 0 ? [`... ${omittedStatusCount} runtime/artifact status line(s) omitted`] : []),
].join('\n');
const branch = runGit(['branch', '--show-current']) || '<unknown>';
const recentAudit = readMaybe('.omx/context/project-audit-20260514T070849Z.md', 2400);

const brief = `# AI Task Brief

## Task
${task}

## Repository
- Branch: ${branch}
- Apps: \`dailycoding/\` Vite React frontend, \`dailycoding-server/\` Express/MySQL/Redis backend.
- Runtime artifacts under \`.omx/\`, \`.omc/\`, and app-local \`.omc/\` are not product source.

## Current Worktree
\`\`\`
${status || 'clean'}
\`\`\`

## Guardrails
- Do not revert unrelated user changes.
- Keep diffs small and behavior-preserving unless the task explicitly changes behavior.
- No new dependencies unless explicitly approved.
- For backend changes, run touched tests plus \`npm run lint\` in \`dailycoding-server/\`.
- For frontend changes, run \`npm run lint\`, \`npm test\`, and \`npm run build\` in \`dailycoding/\`.
- Production security defaults must fail fast instead of silently falling back to localhost/demo secrets.

## Useful Commands
\`\`\`bash
cd dailycoding-server && npm run verify
cd dailycoding && npm run verify
node scripts/production-preflight.mjs dailycoding-server/.env dailycoding/.env.production
\`\`\`

## Recent Audit Context
${recentAudit || 'No audit context found.'}

## Expected Output
- Changed files
- Verification commands and results
- Remaining risks
- Follow-up recommendations
`;

console.log(brief);
