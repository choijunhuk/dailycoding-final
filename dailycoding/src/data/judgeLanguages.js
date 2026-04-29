export const JUDGE_LANGUAGE_OPTIONS = Object.freeze([
  { value: 'python', label: 'Python 3', monaco: 'python' },
  { value: 'javascript', label: 'JavaScript', monaco: 'javascript' },
  { value: 'cpp', label: 'C++17', monaco: 'cpp' },
  { value: 'java', label: 'Java 11', monaco: 'java' },
  { value: 'c', label: 'C99', monaco: 'c' },
])

export function getJudgeLanguageOption(value) {
  return JUDGE_LANGUAGE_OPTIONS.find((option) => option.value === value) || null
}

export function getJudgeLanguageOptionsForSupported(supportedLanguages) {
  if (!Array.isArray(supportedLanguages)) {
    return [...JUDGE_LANGUAGE_OPTIONS]
  }

  return JUDGE_LANGUAGE_OPTIONS.filter((option) => supportedLanguages.includes(option.value))
}
