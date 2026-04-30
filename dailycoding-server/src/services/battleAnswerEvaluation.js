function normalizeCodeFragment(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/;+$/g, '');
}

function asIndexGroups(rawGroups, blankCount) {
  if (!Array.isArray(rawGroups)) return [];
  const groups = rawGroups
    .map((group) => Array.isArray(group) ? group.map(Number).filter(Number.isInteger) : [])
    .filter((group) => group.length > 0);
  if (groups.length === 0) return [];

  const oneBased = groups.every((group) => group.every((index) => index >= 1 && index <= blankCount));
  const zeroBased = groups.some((group) => group.includes(0));
  const normalized = groups.map((group) => group.map((index) => (oneBased && !zeroBased ? index - 1 : index)));
  const used = new Set();
  const safeGroups = [];

  for (const group of normalized) {
    const safe = [...new Set(group)].filter((index) => index >= 0 && index < blankCount && !used.has(index));
    if (safe.length > 0) {
      safe.forEach((index) => used.add(index));
      safeGroups.push(safe);
    }
  }

  for (let index = 0; index < blankCount; index += 1) {
    if (!used.has(index)) safeGroups.push([index]);
  }

  return safeGroups;
}

function inferAnswerGroups(problem, blanks) {
  const title = String(problem?.title || '');
  const template = String(problem?.codeTemplate || '');
  const normalizedSecond = normalizeCodeFragment(blanks[1]);
  const normalizedThird = normalizeCodeFragment(blanks[2]);
  const isFibonacciRecurrence = title.includes('피보나치')
    && blanks.length === 3
    && new Set([normalizedSecond, normalizedThird]).size === 2
    && new Set([normalizedSecond, normalizedThird]).has('1')
    && new Set([normalizedSecond, normalizedThird]).has('2')
    && template.includes('___2___')
    && template.includes('___3___');

  if (isFibonacciRecurrence) return [[0], [1, 2]];
  if (problem?.orderInsensitive === true) return [blanks.map((_, index) => index)];
  return [];
}

function getAnswerGroups(problem, blanks) {
  const configured = problem?.answerGroups
    || problem?.blankAnswerGroups
    || problem?.blankGroups
    || [];
  const configuredGroups = asIndexGroups(configured, blanks.length);
  if (configuredGroups.length > 0) return configuredGroups;
  return asIndexGroups(inferAnswerGroups(problem, blanks), blanks.length);
}

function sameMultiset(actualValues, expectedValues) {
  if (actualValues.length !== expectedValues.length) return false;
  const counts = new Map();
  expectedValues.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  for (const value of actualValues) {
    const next = (counts.get(value) || 0) - 1;
    if (next < 0) return false;
    if (next === 0) counts.delete(value);
    else counts.set(value, next);
  }
  return counts.size === 0;
}

export function evaluateFillBlankAnswer(problem, answer) {
  const blanks = Array.isArray(problem?.blanks) ? problem.blanks : [];
  if (blanks.length === 0) return false;

  const userAnswers = Array.isArray(answer) ? answer : [answer];
  if (userAnswers.length < blanks.length) return false;

  const expected = blanks.map(normalizeCodeFragment);
  const actual = userAnswers.slice(0, blanks.length).map(normalizeCodeFragment);
  const groups = getAnswerGroups(problem, blanks);

  if (groups.length === 0) {
    return expected.every((value, index) => actual[index] === value);
  }

  return groups.every((group) =>
    sameMultiset(
      group.map((index) => actual[index]),
      group.map((index) => expected[index])
    )
  );
}

export function evaluateBugFixAnswer(problem, answer) {
  const rawKeywords = Array.isArray(problem?.keywords) && problem.keywords.length > 0
    ? problem.keywords
    : [problem?.correctAnswerKeyword].filter(Boolean);
  const submitted = normalizeCodeFragment(answer);
  return rawKeywords.some((keyword) => submitted.includes(normalizeCodeFragment(keyword)));
}
