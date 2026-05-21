export function pickLangText(lang, ko, en) {
  return lang === 'ko' ? ko : en;
}

export function getDateLocale(lang) {
  return lang === 'ko' ? 'ko-KR' : 'en-US';
}

export function formatWithLang(lang, value, options) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(getDateLocale(lang), options);
}

export function withVars(text, vars = {}) {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    text,
  );
}
