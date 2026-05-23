import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const langPath = path.join(root, 'dailycoding/src/context/LangContext.jsx');
const langSource = fs.readFileSync(langPath, 'utf8');
const srcDir = path.join(root, 'dailycoding/src');

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  if (startIndex === -1) throw new Error(`Missing i18n section: ${start}`);
  const bodyStart = startIndex + start.length;
  const endIndex = source.indexOf(end, bodyStart);
  if (endIndex === -1) throw new Error(`Missing i18n section end: ${start}`);
  return source.slice(bodyStart, endIndex);
}

function keysFromObjectText(text) {
  return new Set(
    [...text.matchAll(/^\s*(?:'([^']+)'|([A-Za-z][A-Za-z0-9_]*))\s*:/gm)]
      .map((match) => match[1] || match[2])
  );
}

function walkFiles(dir) {
  const out = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (/\.(jsx?|tsx?)$/.test(entry.name)) out.push(fullPath);
    }
  }
  walk(dir);
  return out;
}

const koKeys = keysFromObjectText(section(langSource, 'ko: {', '\n  en: {'));
const enKeys = keysFromObjectText(section(langSource, 'en: {', '\n  },\n};'));
const missingInEn = [...koKeys].filter((key) => !enKeys.has(key));
const missingInKo = [...enKeys].filter((key) => !koKeys.has(key));

if (missingInEn.length || missingInKo.length) {
  console.error('i18n key mismatch');
  if (missingInEn.length) console.error('Missing in en:\n' + missingInEn.join('\n'));
  if (missingInKo.length) console.error('Missing in ko:\n' + missingInKo.join('\n'));
  process.exit(1);
}

const usedKeys = new Set();
for (const file of walkFiles(srcDir)) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\bt\('([^']+)'\)/g)) {
    usedKeys.add(match[1]);
  }
}

const missingUsed = [...usedKeys].filter((key) => !koKeys.has(key) || !enKeys.has(key));
if (missingUsed.length) {
  console.error('Used translation keys missing from LangContext:');
  console.error(missingUsed.join('\n'));
  process.exit(1);
}

if (/No record(?!s yet)/.test(langSource)) {
  console.error('Found awkward/inconsistent "No record" copy. Use "No records yet".');
  process.exit(1);
}

console.log(`i18n verified: ${koKeys.size} ko keys, ${enKeys.size} en keys, ${usedKeys.size} used keys.`);
