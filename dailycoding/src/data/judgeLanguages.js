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

export function detectJudgeLanguageFromCode(code) {
  const source = String(code || '')
  if (!source.trim()) return null

  if (/#include\s*<stdio\.h>/.test(source) || /\bscanf\s*\(/.test(source) || /\bprintf\s*\(/.test(source)) {
    return 'c'
  }
  if (/#include\s*<bits\/stdc\+\+\.h>/.test(source) || /\busing\s+namespace\s+std\b/.test(source) || /\b(cin|cout)\s*(>>|<<)/.test(source)) {
    return 'cpp'
  }
  if (/\bpublic\s+class\s+Main\b/.test(source) || /\bSystem\.out\.(print|println)\s*\(/.test(source)) {
    return 'java'
  }
  if (/\brequire\s*\(\s*['"]fs['"]\s*\)/.test(source) || /\breadFileSync\s*\(\s*0\b/.test(source) || /\bconsole\.log\s*\(/.test(source)) {
    return 'javascript'
  }
  if (/\bdef\s+\w+\s*\(/.test(source) || /\bimport\s+sys\b/.test(source) || /\bprint\s*\(/.test(source)) {
    return 'python'
  }
  return null
}

export function getEffectiveJudgeLanguage(code, currentLang, supportedLanguages) {
  const supportedOptions = getJudgeLanguageOptionsForSupported(supportedLanguages)
  const supportedValues = new Set(supportedOptions.map((option) => option.value))
  const normalizedCurrent = supportedValues.has(currentLang) ? currentLang : supportedOptions[0]?.value
  const detected = detectJudgeLanguageFromCode(code)

  if (detected && supportedValues.has(detected) && detected !== normalizedCurrent) {
    return detected
  }
  return normalizedCurrent || currentLang || 'python'
}
