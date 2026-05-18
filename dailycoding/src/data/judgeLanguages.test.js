import { test } from 'vitest'
import assert from 'node:assert/strict'

import { detectJudgeLanguageFromCode, getEffectiveJudgeLanguage } from './judgeLanguages.js'

test('detects C submissions with stdio signatures', () => {
  const code = `#include <stdio.h>
int main(){
  int a, b;
  scanf("%d %d", &a, &b);
  printf("%d", a + b);
  return 0;
}`

  assert.equal(detectJudgeLanguageFromCode(code), 'c')
  assert.equal(getEffectiveJudgeLanguage(code, 'python', ['python', 'c']), 'c')
})

test('keeps current language when detection is unsupported', () => {
  assert.equal(getEffectiveJudgeLanguage('console.log(1)', 'python', ['python', 'c']), 'python')
})

test('detects TypeScript and Go submissions', () => {
  assert.equal(detectJudgeLanguageFromCode('const answer: number = 3\\nconsole.log(answer)'), 'typescript')
  assert.equal(detectJudgeLanguageFromCode('package main\\nimport "fmt"\\nfunc main(){ fmt.Println(3) }'), 'go')
  assert.equal(getEffectiveJudgeLanguage('package main\\nimport "fmt"\\nfunc main(){ fmt.Println(3) }', 'python', ['python', 'go']), 'go')
})
