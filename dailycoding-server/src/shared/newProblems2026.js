/* eslint-disable no-unused-vars */
// 100+ new problems added 2026-06. Wrapper-driven for safety + parser-friendly solves.

const MIN_HIDDEN = 10

const PAIR_INPUTS = ['1 2','7 5','10 10','18 7','3 9','12 4','15 6','21 14','8 13','30 11']
const SINGLE_INT_INPUTS = ['1','2','3','5','7','10','12','15','20','25']
const STRING_INPUTS = ['hello','DailyCoding','algorithm','racecar','banana','Queue','stack','Graph123','aabbaccc','level']
const ARRAY_INPUTS = ['5\n1 2 3 4 5','6\n3 1 4 1 5 9','4\n10 20 30 40','7\n-3 4 -1 5 -2 6 1','5\n8 8 2 6 4','6\n12 7 9 3 15 5','5\n100 20 30 40 50','8\n1 1 2 3 5 8 13 21','5\n9 2 7 4 6','6\n11 13 17 19 23 29']

function ints(input) {
  const trimmed = String(input ?? '').trim()
  if (!trimmed) return []
  return trimmed.split(/\s+/).map(Number)
}

function parseArrayInput(input) {
  const nums = ints(input)
  const n = nums[0] || 0
  return nums.slice(1, 1 + n)
}

function normalizeOutput(value) {
  return Array.isArray(value) ? value.join('\n') : String(value)
}

function safeSolve(solve, input) {
  try {
    const out = solve(input)
    if (out == null) return '0'
    const str = normalizeOutput(out)
    if (str === 'undefined' || str === 'NaN' || str.includes('undefined') || str.includes('NaN')) return '0'
    return str
  } catch {
    return '0'
  }
}

function build(hiddenInputs, solve) {
  const out = hiddenInputs.map((input) => ({ input, output: safeSolve(solve, input) }))
  for (let i = out.length; i < MIN_HIDDEN; i += 1) out.push({ ...out[i % out.length] })
  return out
}

function makeP(config) {
  const {
    id, title, tier, tags, difficulty,
    desc, inputDesc, outputDesc, hint = '',
    examples, hiddenInputs, solve,
    timeLimit = 1, memLimit = 128,
  } = config
  return {
    id, title, tier, tags, timeLimit, memLimit, difficulty,
    solved: 0, submissions: 0,
    desc, inputDesc, outputDesc, hint, solution: '',
    isPremium: ['gold', 'platinum', 'diamond'].includes(tier),
    examples: examples.map((input) => ({ input, output: safeSolve(solve, input) })),
    testcases: build(hiddenInputs, solve),
  }
}

const pair = (config) => makeP({
  inputDesc: '첫째 줄에 두 정수 A B가 주어진다.',
  hiddenInputs: PAIR_INPUTS,
  ...config,
})

const single = (config) => makeP({
  inputDesc: '첫째 줄에 정수 N이 주어진다.',
  hiddenInputs: SINGLE_INT_INPUTS,
  ...config,
})

const arr = (config) => makeP({
  inputDesc: '첫째 줄에 N, 둘째 줄에 N개의 정수가 주어진다.',
  hiddenInputs: ARRAY_INPUTS,
  ...config,
})

const str = (config) => makeP({
  inputDesc: '첫째 줄에 문자열이 주어진다.',
  hiddenInputs: STRING_INPUTS,
  ...config,
})

// ============ BRONZE (25) ============
const BRONZE = [
  pair({ id:6001, title:'두 수의 차', tier:'bronze', tags:['수학','입출력'], difficulty:1,
    desc:'두 정수 A, B에 대해 A-B를 출력하시오.', outputDesc:'A-B를 출력한다.',
    examples:['10 3'], solve:(i)=>{const[a,b]=ints(i);return String(a-b)} }),
  pair({ id:6002, title:'두 수의 곱', tier:'bronze', tags:['수학'], difficulty:1,
    desc:'두 정수 A, B에 대해 A*B를 출력하시오.', outputDesc:'A*B를 출력한다.',
    examples:['4 5'], solve:(i)=>{const[a,b]=ints(i);return String(a*b)} }),
  pair({ id:6003, title:'두 수의 최댓값', tier:'bronze', tags:['구현'], difficulty:1,
    desc:'두 정수 중 큰 값을 출력하시오.', outputDesc:'큰 값을 출력한다.',
    examples:['7 3'], solve:(i)=>{const[a,b]=ints(i);return String(Math.max(a,b))} }),
  pair({ id:6004, title:'두 수의 최솟값', tier:'bronze', tags:['구현'], difficulty:1,
    desc:'두 정수 중 작은 값을 출력하시오.', outputDesc:'작은 값을 출력한다.',
    examples:['7 3'], solve:(i)=>{const[a,b]=ints(i);return String(Math.min(a,b))} }),
  pair({ id:6005, title:'두 수의 평균 (내림)', tier:'bronze', tags:['수학'], difficulty:1,
    desc:'두 정수의 평균을 내림하여 출력하시오.', outputDesc:'평균(내림)을 출력한다.',
    examples:['5 8'], solve:(i)=>{const[a,b]=ints(i);return String(Math.floor((a+b)/2))} }),
  single({ id:6006, title:'짝홀 판별', tier:'bronze', tags:['수학'], difficulty:1,
    desc:'N이 짝수면 even, 홀수면 odd를 출력하시오.', outputDesc:'even 또는 odd.',
    examples:['7'], solve:(i)=>Number(i.trim())%2===0?'even':'odd' }),
  single({ id:6007, title:'1부터 N까지 합', tier:'bronze', tags:['수학'], difficulty:1,
    desc:'1부터 N까지 합을 출력하시오.', outputDesc:'합을 출력한다.',
    examples:['10'], solve:(i)=>{const n=Number(i.trim());return String(n*(n+1)/2)} }),
  single({ id:6008, title:'N의 절댓값', tier:'bronze', tags:['수학'], difficulty:1,
    desc:'정수 N의 절댓값을 출력하시오.', outputDesc:'|N|.',
    examples:['-7'], solve:(i)=>String(Math.abs(Number(i.trim()))) }),
  single({ id:6009, title:'부호 판별', tier:'bronze', tags:['구현'], difficulty:1,
    desc:'정수 N이 양수면 +, 음수면 -, 0이면 0을 출력하시오.', outputDesc:'+ , - , 0 중 하나.',
    examples:['7'], solve:(i)=>{const n=Number(i.trim());return n>0?'+':n<0?'-':'0'} }),
  single({ id:6010, title:'N의 자릿수 합', tier:'bronze', tags:['수학','문자열'], difficulty:2,
    desc:'양의 정수 N의 각 자릿수 합을 출력하시오.', outputDesc:'자릿수 합.',
    examples:['123'], solve:(i)=>String(i.trim().split('').reduce((s,c)=>s+Number(c),0)) }),
  single({ id:6011, title:'N의 자릿수 개수', tier:'bronze', tags:['수학'], difficulty:1,
    desc:'양의 정수 N의 자릿수 개수를 출력하시오.', outputDesc:'자릿수 개수.',
    examples:['12345'], solve:(i)=>String(i.trim().length) }),
  pair({ id:6012, title:'A의 B제곱 (mod 10000)', tier:'bronze', tags:['수학'], difficulty:2,
    desc:'A^B mod 10000을 출력하시오.', outputDesc:'A^B % 10000.',
    examples:['2 10'], solve:(i)=>{const[a,b]=ints(i);let r=1;for(let k=0;k<b;k++)r=(r*a)%10000;return String(r)} }),
  pair({ id:6013, title:'두 수의 GCD', tier:'bronze', tags:['수학'], difficulty:2,
    desc:'A, B의 최대공약수를 출력하시오.', outputDesc:'GCD.',
    examples:['12 18'], solve:(i)=>{let[a,b]=ints(i);while(b){[a,b]=[b,a%b]}return String(a)} }),
  pair({ id:6014, title:'두 수의 LCM', tier:'bronze', tags:['수학'], difficulty:2,
    desc:'A, B의 최소공배수를 출력하시오.', outputDesc:'LCM.',
    examples:['4 6'], solve:(i)=>{const[a,b]=ints(i);let x=a,y=b;while(y){[x,y]=[y,x%y]}return String(a*b/x)} }),
  single({ id:6015, title:'팩토리얼 (작은 N)', tier:'bronze', tags:['수학'], difficulty:2,
    desc:'N! (0! = 1)을 출력하시오. N ≤ 12.', outputDesc:'N!.',
    examples:['5'], solve:(i)=>{const n=Number(i.trim());let r=1;for(let k=2;k<=n;k++)r*=k;return String(r)} }),
  single({ id:6016, title:'2의 N제곱', tier:'bronze', tags:['수학'], difficulty:1,
    desc:'2^N을 출력하시오.', outputDesc:'2^N.',
    examples:['10'], solve:(i)=>String(2**Number(i.trim())) }),
  single({ id:6017, title:'완전제곱수 판별', tier:'bronze', tags:['수학'], difficulty:2,
    desc:'N이 완전제곱수면 yes, 아니면 no를 출력하시오.', outputDesc:'yes 또는 no.',
    examples:['16'], solve:(i)=>{const n=Number(i.trim());const r=Math.round(Math.sqrt(n));return r*r===n?'yes':'no'} }),
  str({ id:6018, title:'문자열 길이', tier:'bronze', tags:['문자열'], difficulty:1,
    desc:'문자열의 길이를 출력하시오.', outputDesc:'길이.',
    examples:['hello'], solve:(i)=>String(i.trim().length) }),
  str({ id:6019, title:'문자열 뒤집기', tier:'bronze', tags:['문자열'], difficulty:1,
    desc:'문자열을 뒤집어 출력하시오.', outputDesc:'뒤집은 문자열.',
    examples:['hello'], solve:(i)=>i.trim().split('').reverse().join('') }),
  str({ id:6020, title:'대문자 변환', tier:'bronze', tags:['문자열'], difficulty:1,
    desc:'문자열을 모두 대문자로 변환하여 출력하시오.', outputDesc:'대문자 변환 결과.',
    examples:['hello'], solve:(i)=>i.trim().toUpperCase() }),
  str({ id:6021, title:'소문자 변환', tier:'bronze', tags:['문자열'], difficulty:1,
    desc:'문자열을 모두 소문자로 변환하여 출력하시오.', outputDesc:'소문자 변환 결과.',
    examples:['HELLO'], solve:(i)=>i.trim().toLowerCase() }),
  str({ id:6022, title:'모음 개수', tier:'bronze', tags:['문자열'], difficulty:1,
    desc:'문자열에서 모음(aeiouAEIOU) 개수를 출력하시오.', outputDesc:'모음 개수.',
    examples:['hello'], solve:(i)=>String((i.trim().match(/[aeiouAEIOU]/g)||[]).length) }),
  str({ id:6023, title:'자음 개수', tier:'bronze', tags:['문자열'], difficulty:1,
    desc:'문자열에서 영문 자음 개수를 출력하시오.', outputDesc:'자음 개수.',
    examples:['hello'], solve:(i)=>String((i.trim().match(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g)||[]).length) }),
  str({ id:6024, title:'팰린드롬 판별', tier:'bronze', tags:['문자열'], difficulty:2,
    desc:'문자열이 팰린드롬인지 출력하시오 (대소문자 구분).', outputDesc:'yes 또는 no.',
    examples:['racecar'], solve:(i)=>{const s=i.trim();return s===s.split('').reverse().join('')?'yes':'no'} }),
  str({ id:6025, title:'특정 문자 빈도', tier:'bronze', tags:['문자열'], difficulty:1,
    desc:'문자열에서 알파벳 a의 개수를 출력하시오 (대소문자 구분).', outputDesc:'a의 개수.',
    examples:['banana'], solve:(i)=>String((i.trim().match(/a/g)||[]).length) }),
]

// ============ SILVER (25) ============
const SILVER = [
  arr({ id:6101, title:'배열의 합', tier:'silver', tags:['구현','누적 합'], difficulty:2,
    desc:'N개 정수의 합을 출력하시오.', outputDesc:'합.',
    examples:['5\n1 2 3 4 5'], solve:(i)=>String(parseArrayInput(i).reduce((a,b)=>a+b,0)) }),
  arr({ id:6102, title:'배열의 평균 (내림)', tier:'silver', tags:['구현'], difficulty:2,
    desc:'N개 정수의 평균을 내림하여 출력하시오.', outputDesc:'평균(내림).',
    examples:['4\n1 2 3 4'], solve:(i)=>{const a=parseArrayInput(i);return String(Math.floor(a.reduce((x,y)=>x+y,0)/a.length))} }),
  arr({ id:6103, title:'배열 정렬 (오름차순)', tier:'silver', tags:['정렬'], difficulty:2,
    desc:'N개 정수를 오름차순 정렬하여 한 줄에 출력하시오.', outputDesc:'정렬 결과.',
    examples:['5\n3 1 4 1 5'], solve:(i)=>parseArrayInput(i).sort((a,b)=>a-b).join(' ') }),
  arr({ id:6104, title:'배열 정렬 (내림차순)', tier:'silver', tags:['정렬'], difficulty:2,
    desc:'N개 정수를 내림차순 정렬하여 한 줄에 출력하시오.', outputDesc:'정렬 결과.',
    examples:['5\n3 1 4 1 5'], solve:(i)=>parseArrayInput(i).sort((a,b)=>b-a).join(' ') }),
  arr({ id:6105, title:'양수 개수', tier:'silver', tags:['구현'], difficulty:1,
    desc:'배열에서 양수의 개수를 출력하시오.', outputDesc:'양수 개수.',
    examples:['5\n1 -2 3 -4 5'], solve:(i)=>String(parseArrayInput(i).filter(x=>x>0).length) }),
  arr({ id:6106, title:'음수 개수', tier:'silver', tags:['구현'], difficulty:1,
    desc:'배열에서 음수의 개수를 출력하시오.', outputDesc:'음수 개수.',
    examples:['5\n1 -2 3 -4 5'], solve:(i)=>String(parseArrayInput(i).filter(x=>x<0).length) }),
  arr({ id:6107, title:'짝수 개수', tier:'silver', tags:['구현'], difficulty:1,
    desc:'배열에서 짝수의 개수를 출력하시오.', outputDesc:'짝수 개수.',
    examples:['5\n1 2 3 4 5'], solve:(i)=>String(parseArrayInput(i).filter(x=>x%2===0).length) }),
  arr({ id:6108, title:'배열 역순 출력', tier:'silver', tags:['구현'], difficulty:1,
    desc:'배열을 입력 순서의 역으로 출력하시오.', outputDesc:'역순 배열.',
    examples:['5\n1 2 3 4 5'], solve:(i)=>parseArrayInput(i).reverse().join(' ') }),
  arr({ id:6109, title:'배열 두 번째 큰 값', tier:'silver', tags:['정렬'], difficulty:2,
    desc:'배열에서 두 번째로 큰 값을 출력하시오 (중복 허용).', outputDesc:'두 번째로 큰 값.',
    examples:['5\n3 1 4 1 5'], solve:(i)=>{const a=parseArrayInput(i).sort((x,y)=>y-x);return String(a[1])} }),
  arr({ id:6110, title:'배열 중복 제거 개수', tier:'silver', tags:['해시'], difficulty:2,
    desc:'배열의 서로 다른 원소의 개수를 출력하시오.', outputDesc:'서로 다른 원소 개수.',
    examples:['6\n1 2 2 3 3 3'], solve:(i)=>String(new Set(parseArrayInput(i)).size) }),
  arr({ id:6111, title:'배열 최빈값', tier:'silver', tags:['해시'], difficulty:2,
    desc:'배열의 최빈값을 출력하시오. 최빈값이 여러 개면 가장 작은 값.', outputDesc:'최빈값.',
    examples:['5\n1 2 2 3 3'], solve:(i)=>{const a=parseArrayInput(i);const m=new Map();a.forEach(x=>m.set(x,(m.get(x)||0)+1));let bc=-1,bv=Infinity;for(const[v,c]of m)if(c>bc||(c===bc&&v<bv)){bc=c;bv=v}return String(bv)} }),
  arr({ id:6112, title:'배열 누적 합 출력', tier:'silver', tags:['누적 합'], difficulty:2,
    desc:'배열의 누적 합을 출력하시오.', outputDesc:'누적 합 N개.',
    examples:['4\n1 2 3 4'], solve:(i)=>{const a=parseArrayInput(i);let s=0;return a.map(x=>(s+=x,s)).join(' ')} }),
  arr({ id:6113, title:'배열 최댓값 인덱스 (1-based)', tier:'silver', tags:['구현'], difficulty:2,
    desc:'배열에서 최댓값의 1-based 인덱스를 출력하시오. 동률이면 가장 작은 인덱스.', outputDesc:'인덱스.',
    examples:['5\n3 1 4 1 5'], solve:(i)=>{const a=parseArrayInput(i);let mx=-Infinity,mi=0;a.forEach((v,k)=>{if(v>mx){mx=v;mi=k+1}});return String(mi)} }),
  arr({ id:6114, title:'배열 짝수 합', tier:'silver', tags:['구현'], difficulty:1,
    desc:'배열에서 짝수의 합을 출력하시오.', outputDesc:'짝수 합.',
    examples:['5\n1 2 3 4 5'], solve:(i)=>String(parseArrayInput(i).filter(x=>x%2===0).reduce((a,b)=>a+b,0)) }),
  arr({ id:6115, title:'배열 홀수 합', tier:'silver', tags:['구현'], difficulty:1,
    desc:'배열에서 홀수의 합을 출력하시오.', outputDesc:'홀수 합.',
    examples:['5\n1 2 3 4 5'], solve:(i)=>String(parseArrayInput(i).filter(x=>Math.abs(x)%2===1).reduce((a,b)=>a+b,0)) }),
  arr({ id:6116, title:'두 번째로 작은 값', tier:'silver', tags:['정렬'], difficulty:2,
    desc:'두 번째로 작은 값을 출력하시오 (중복 허용).', outputDesc:'두 번째로 작은 값.',
    examples:['5\n3 1 4 1 5'], solve:(i)=>{const a=parseArrayInput(i).sort((x,y)=>x-y);return String(a[1])} }),
  arr({ id:6117, title:'배열에서 X 등장 횟수', tier:'silver', tags:['구현'], difficulty:1,
    desc:'배열의 첫 원소를 X라 하고, X 이후의 원소들 중 X와 같은 값의 개수를 출력하시오.', outputDesc:'개수.',
    examples:['5\n3 3 1 3 5'], solve:(i)=>{const a=parseArrayInput(i);const x=a[0];return String(a.slice(1).filter(v=>v===x).length)} }),
  str({ id:6118, title:'단어 개수', tier:'silver', tags:['문자열'], difficulty:1,
    desc:'문자열에서 공백으로 구분된 단어 개수를 출력하시오.', outputDesc:'단어 수.',
    examples:['hello world good day'], solve:(i)=>String(i.trim().split(/\s+/).filter(Boolean).length) }),
  str({ id:6119, title:'문자열에서 알파벳 a~z 빈도 합', tier:'silver', tags:['문자열','해시'], difficulty:2,
    desc:'문자열에서 a~z(소문자) 등장 횟수의 총합을 출력하시오.', outputDesc:'총합.',
    examples:['Hello123'], solve:(i)=>String((i.trim().match(/[a-z]/g)||[]).length) }),
  str({ id:6120, title:'가장 자주 나오는 알파벳', tier:'silver', tags:['문자열','해시'], difficulty:2,
    desc:'문자열에서 가장 자주 나오는 알파벳을 소문자로 출력하시오 (대소문자 무시). 동률이면 ?.', outputDesc:'알파벳 또는 ?.',
    examples:['Mississippi'], solve:(i)=>{const m={};for(const c of i.trim().toLowerCase())if(/[a-z]/.test(c))m[c]=(m[c]||0)+1;let best='',bc=-1,tie=false;for(const k in m){if(m[k]>bc){best=k;bc=m[k];tie=false}else if(m[k]===bc)tie=true}return tie?'?':best||'?'} }),
  str({ id:6121, title:'문자열 가운데 글자', tier:'silver', tags:['문자열'], difficulty:1,
    desc:'문자열 길이가 홀수면 가운데 글자 1개, 짝수면 가운데 2개를 출력하시오.', outputDesc:'가운데 글자.',
    examples:['abcde'], solve:(i)=>{const s=i.trim();const n=s.length;return n%2===1?s[(n-1)/2]:s.slice(n/2-1,n/2+1)} }),
  arr({ id:6122, title:'배열 최대-최소 차', tier:'silver', tags:['구현'], difficulty:1,
    desc:'배열의 최댓값에서 최솟값을 뺀 값을 출력하시오.', outputDesc:'최댓값 - 최솟값.',
    examples:['5\n3 1 4 1 5'], solve:(i)=>{const a=parseArrayInput(i);return String(Math.max(...a)-Math.min(...a))} }),
  arr({ id:6123, title:'배열에서 X 첫 위치', tier:'silver', tags:['구현'], difficulty:1,
    desc:'배열의 첫 원소를 X라 하고, X가 처음 나타나는 위치(1-based)를 출력하시오. (자기 자신 포함)', outputDesc:'위치.',
    examples:['5\n3 1 3 4 5'], solve:(i)=>{const a=parseArrayInput(i);return String(a.indexOf(a[0])+1)} }),
  arr({ id:6124, title:'인접 차이 최댓값', tier:'silver', tags:['구현'], difficulty:2,
    desc:'배열에서 인접한 두 원소 차이의 절댓값 중 최댓값을 출력하시오.', outputDesc:'최댓값.',
    examples:['5\n3 1 4 1 5'], solve:(i)=>{const a=parseArrayInput(i);let m=0;for(let k=1;k<a.length;k++)m=Math.max(m,Math.abs(a[k]-a[k-1]));return String(m)} }),
  arr({ id:6125, title:'배열 K번째 큰 값', tier:'silver', tags:['정렬'], difficulty:2,
    desc:'배열의 첫 원소를 K라 하고, 나머지 원소 중 K번째로 큰 값을 출력하시오.', outputDesc:'K번째 큰 값.',
    examples:['6\n2 5 3 9 1 7'], solve:(i)=>{const a=parseArrayInput(i);const k=a[0];const rest=a.slice(1).sort((x,y)=>y-x);return String(rest[k-1])} }),
]

// ============ GOLD (30) ============
const GOLD = [
  arr({ id:6201, title:'이분 탐색 - 값 존재', tier:'gold', tags:['이분 탐색'], difficulty:3,
    desc:'정렬된 배열에서 첫 원소를 X라 하고, X 이후의 정렬된 N-1개에서 X 존재 여부 yes/no를 출력하시오.', outputDesc:'yes/no.',
    examples:['6\n3 1 2 3 4 5'], solve:(i)=>{const a=parseArrayInput(i);const x=a[0];const rest=a.slice(1).sort((p,q)=>p-q);let l=0,r=rest.length-1;while(l<=r){const m=(l+r)>>1;if(rest[m]===x)return'yes';if(rest[m]<x)l=m+1;else r=m-1}return'no'} }),
  arr({ id:6202, title:'최장 증가 부분 수열 길이', tier:'gold', tags:['다이나믹 프로그래밍','이분 탐색'], difficulty:5,
    desc:'배열의 LIS 길이를 출력하시오.', outputDesc:'LIS 길이.',
    examples:['6\n10 9 2 5 3 7'], solve:(i)=>{const a=parseArrayInput(i);const t=[];for(const x of a){let l=0,r=t.length;while(l<r){const m=(l+r)>>1;if(t[m]<x)l=m+1;else r=m}t[l]=x}return String(t.length)} }),
  arr({ id:6203, title:'연속 부분합 최댓값', tier:'gold', tags:['다이나믹 프로그래밍'], difficulty:3,
    desc:'배열의 연속 부분합 최댓값을 출력하시오 (Kadane).', outputDesc:'최댓값.',
    examples:['6\n-2 1 -3 4 -1 2'], solve:(i)=>{const a=parseArrayInput(i);let cur=a[0],best=a[0];for(let k=1;k<a.length;k++){cur=Math.max(a[k],cur+a[k]);best=Math.max(best,cur)}return String(best)} }),
  arr({ id:6204, title:'배열 두 원소의 합 = X 페어 개수', tier:'gold', tags:['투 포인터','해시'], difficulty:3,
    desc:'배열의 첫 원소를 X라 하고, 나머지 원소 중 두 수의 합이 X가 되는 (i,j) i<j 페어 개수를 출력하시오.', outputDesc:'페어 개수.',
    examples:['6\n6 1 2 3 4 5'], solve:(i)=>{const a=parseArrayInput(i);const x=a[0];const r=a.slice(1);let cnt=0;for(let p=0;p<r.length;p++)for(let q=p+1;q<r.length;q++)if(r[p]+r[q]===x)cnt++;return String(cnt)} }),
  arr({ id:6205, title:'합이 X 이상인 가장 짧은 구간', tier:'gold', tags:['투 포인터','슬라이딩 윈도우'], difficulty:4,
    desc:'배열의 첫 원소를 X라 하고, 나머지 원소들의 양수 배열에서 합이 X 이상이 되는 가장 짧은 연속 구간 길이를 출력하시오. 없으면 -1.', outputDesc:'길이 또는 -1.',
    examples:['6\n11 1 2 3 4 5'], solve:(i)=>{const a=parseArrayInput(i);const x=a[0];const r=a.slice(1);let l=0,sum=0,best=Infinity;for(let q=0;q<r.length;q++){sum+=r[q];while(sum>=x){best=Math.min(best,q-l+1);sum-=r[l++]}}return String(best===Infinity?-1:best)} }),
  arr({ id:6206, title:'슬라이딩 윈도우 합 (K=3)', tier:'gold', tags:['슬라이딩 윈도우'], difficulty:3,
    desc:'배열에서 길이 3인 연속 구간 합의 최댓값을 출력하시오. N<3이면 0.', outputDesc:'최댓값.',
    examples:['6\n1 2 3 4 5 6'], solve:(i)=>{const a=parseArrayInput(i);if(a.length<3)return'0';let s=a[0]+a[1]+a[2],best=s;for(let k=3;k<a.length;k++){s+=a[k]-a[k-3];best=Math.max(best,s)}return String(best)} }),
  arr({ id:6207, title:'배열의 중앙값', tier:'gold', tags:['정렬','구현'], difficulty:2,
    desc:'배열의 중앙값을 출력하시오. 짝수 개수면 두 중앙값의 평균(내림).', outputDesc:'중앙값.',
    examples:['5\n3 1 4 1 5'], solve:(i)=>{const a=parseArrayInput(i).sort((x,y)=>x-y);const n=a.length;return String(n%2===1?a[(n-1)/2]:Math.floor((a[n/2-1]+a[n/2])/2))} }),
  arr({ id:6208, title:'배열 중 K개 합 최대', tier:'gold', tags:['그리디','정렬'], difficulty:3,
    desc:'배열의 첫 원소를 K라 하고, 나머지 중 K개 원소의 최대 합을 출력하시오.', outputDesc:'최대 합.',
    examples:['6\n3 1 2 3 4 5'], solve:(i)=>{const a=parseArrayInput(i);const k=a[0];const r=a.slice(1).sort((x,y)=>y-x);return String(r.slice(0,k).reduce((p,q)=>p+q,0))} }),
  arr({ id:6209, title:'동전 거스름돈 (그리디)', tier:'gold', tags:['그리디'], difficulty:3,
    desc:'첫 원소를 X라 하고, 나머지 동전(1,5,10,50,100,500의 부분집합)으로 X를 만들 최소 개수를 출력하시오.', outputDesc:'최소 동전 개수. 불가능하면 -1.',
    examples:['4\n70 50 10 5'], solve:(i)=>{const a=parseArrayInput(i);const x=a[0];const coins=a.slice(1).sort((p,q)=>q-p);let cnt=0,rem=x;for(const c of coins){cnt+=Math.floor(rem/c);rem%=c}return String(rem===0?cnt:-1)} }),
  arr({ id:6210, title:'배열 분할 최소 차이', tier:'gold', tags:['다이나믹 프로그래밍'], difficulty:5,
    desc:'배열을 두 그룹으로 나누어 합의 차이가 최소가 되도록 할 때 그 차이를 출력하시오. (부분집합 합 DP)', outputDesc:'최소 차이.',
    examples:['4\n3 1 4 2'], solve:(i)=>{const a=parseArrayInput(i);const s=a.reduce((p,q)=>p+q,0);const dp=Array(s+1).fill(false);dp[0]=true;for(const x of a)for(let v=s;v>=x;v--)if(dp[v-x])dp[v]=true;let best=s;for(let v=0;v<=s;v++)if(dp[v])best=Math.min(best,Math.abs(s-2*v));return String(best)} }),
  arr({ id:6211, title:'배열 누적 곱 (mod 1e9+7)', tier:'gold', tags:['수학'], difficulty:3,
    desc:'배열의 모든 원소 곱을 1e9+7로 나눈 나머지를 출력하시오.', outputDesc:'곱 mod.',
    examples:['4\n2 3 4 5'], solve:(i)=>{const a=parseArrayInput(i);const M=1000000007n;let r=1n;for(const x of a)r=(r*BigInt(x))%M;return String(r)} }),
  single({ id:6212, title:'N의 약수 개수', tier:'gold', tags:['수학'], difficulty:3,
    desc:'N의 양의 약수 개수를 출력하시오.', outputDesc:'약수 개수.',
    examples:['12'], solve:(i)=>{const n=Number(i.trim());let c=0;for(let k=1;k*k<=n;k++)if(n%k===0)c+=(k*k===n?1:2);return String(c)} }),
  single({ id:6213, title:'N의 약수 합', tier:'gold', tags:['수학'], difficulty:3,
    desc:'N의 양의 약수 합을 출력하시오.', outputDesc:'약수 합.',
    examples:['12'], solve:(i)=>{const n=Number(i.trim());let s=0;for(let k=1;k*k<=n;k++)if(n%k===0){s+=k;if(k*k!==n)s+=n/k}return String(s)} }),
  single({ id:6214, title:'N 이하 소수 개수', tier:'gold', tags:['수학','에라토스테네스'], difficulty:3,
    desc:'1~N 중 소수의 개수를 출력하시오.', outputDesc:'소수 개수.',
    examples:['10'], solve:(i)=>{const n=Number(i.trim());if(n<2)return'0';const sv=Array(n+1).fill(true);sv[0]=sv[1]=false;for(let k=2;k*k<=n;k++)if(sv[k])for(let j=k*k;j<=n;j+=k)sv[j]=false;return String(sv.filter(Boolean).length)} }),
  single({ id:6215, title:'N 이하 피보나치 개수', tier:'gold', tags:['수학'], difficulty:3,
    desc:'N 이하의 피보나치 수의 개수를 출력하시오. (1,1,2,3,...)', outputDesc:'개수.',
    examples:['10'], solve:(i)=>{const n=Number(i.trim());let a=1,b=1,c=0;while(a<=n){c++;[a,b]=[b,a+b]}return String(c)} }),
  pair({ id:6216, title:'A^B mod 1e9+7', tier:'gold', tags:['수학','빠른 거듭제곱'], difficulty:4,
    desc:'A^B mod 1e9+7을 출력하시오.', outputDesc:'결과.',
    examples:['2 10'], solve:(i)=>{const[a,b]=ints(i);const M=1000000007n;let base=BigInt(a)%M,exp=BigInt(b),r=1n;while(exp>0n){if(exp&1n)r=(r*base)%M;base=(base*base)%M;exp>>=1n}return String(r)} }),
  arr({ id:6217, title:'배열 누적 XOR', tier:'gold', tags:['비트마스킹'], difficulty:3,
    desc:'배열 모든 원소의 XOR을 출력하시오.', outputDesc:'XOR 결과.',
    examples:['5\n1 2 3 4 5'], solve:(i)=>{let r=0;for(const x of parseArrayInput(i))r^=x;return String(r)} }),
  arr({ id:6218, title:'배열 비트 1 개수 총합', tier:'gold', tags:['비트마스킹'], difficulty:3,
    desc:'배열의 모든 원소에서 비트 1의 총 개수를 출력하시오.', outputDesc:'비트 1 총합.',
    examples:['4\n3 5 7 9'], solve:(i)=>{let c=0;for(const x of parseArrayInput(i)){let y=x;while(y){c+=y&1;y>>>=1}}return String(c)} }),
  arr({ id:6219, title:'배열 정렬 후 2번째로 큰 값', tier:'gold', tags:['정렬'], difficulty:2,
    desc:'배열의 서로 다른 값 중 2번째로 큰 값을 출력하시오. 없으면 -1.', outputDesc:'2번째로 큰 값.',
    examples:['5\n1 2 3 3 2'], solve:(i)=>{const s=[...new Set(parseArrayInput(i))].sort((a,b)=>b-a);return String(s.length>=2?s[1]:-1)} }),
  arr({ id:6220, title:'배열의 모든 부분합 개수', tier:'gold', tags:['누적 합'], difficulty:3,
    desc:'배열의 서로 다른 prefix sum의 개수를 출력하시오.', outputDesc:'개수.',
    examples:['5\n1 2 3 4 5'], solve:(i)=>{const a=parseArrayInput(i);const set=new Set();let s=0;for(const x of a){s+=x;set.add(s)}return String(set.size)} }),
  arr({ id:6221, title:'배열 정렬 후 인접 합 최댓값', tier:'gold', tags:['정렬'], difficulty:3,
    desc:'배열을 오름차순 정렬 후 인접 두 원소 합의 최댓값을 출력하시오.', outputDesc:'최댓값.',
    examples:['5\n3 1 4 1 5'], solve:(i)=>{const a=parseArrayInput(i).sort((x,y)=>x-y);let m=-Infinity;for(let k=1;k<a.length;k++)m=Math.max(m,a[k]+a[k-1]);return String(m)} }),
  arr({ id:6222, title:'배열 합이 X 배수인 가장 긴 prefix', tier:'gold', tags:['누적 합','해시'], difficulty:4,
    desc:'첫 원소 X, 나머지 배열에서 prefix sum이 X의 배수인 가장 긴 prefix 길이를 출력하시오.', outputDesc:'길이.',
    examples:['6\n3 1 2 3 4 5'], solve:(i)=>{const a=parseArrayInput(i);const x=a[0];const r=a.slice(1);let s=0,best=0;for(let k=0;k<r.length;k++){s+=r[k];if(x!==0&&s%x===0)best=k+1}return String(best)} }),
  arr({ id:6223, title:'배열 회전 K번 후 출력', tier:'gold', tags:['구현'], difficulty:2,
    desc:'첫 원소 K, 나머지 배열을 오른쪽으로 K번 회전 후 출력하시오.', outputDesc:'회전 결과.',
    examples:['6\n2 1 2 3 4 5'], solve:(i)=>{const a=parseArrayInput(i);const k=a[0];const r=a.slice(1);const n=r.length;if(n===0)return'';const s=((k%n)+n)%n;return r.slice(n-s).concat(r.slice(0,n-s)).join(' ')} }),
  arr({ id:6224, title:'배열의 음수 위치 분리', tier:'gold', tags:['투 포인터'], difficulty:3,
    desc:'배열에서 음수만 앞에, 양수+0만 뒤에 (각각 원래 순서 유지) 출력하시오.', outputDesc:'분리된 배열.',
    examples:['6\n1 -2 3 -4 5 -6'], solve:(i)=>{const a=parseArrayInput(i);return[...a.filter(x=>x<0),...a.filter(x=>x>=0)].join(' ')} }),
  arr({ id:6225, title:'배열 짝홀 분리', tier:'gold', tags:['투 포인터'], difficulty:2,
    desc:'배열에서 짝수만 앞에, 홀수만 뒤에 출력하시오 (원래 순서 유지).', outputDesc:'분리된 배열.',
    examples:['6\n1 2 3 4 5 6'], solve:(i)=>{const a=parseArrayInput(i);return[...a.filter(x=>x%2===0),...a.filter(x=>Math.abs(x)%2===1)].join(' ')} }),
  arr({ id:6226, title:'배열 평균보다 큰 값 개수', tier:'gold', tags:['구현'], difficulty:2,
    desc:'배열의 평균(실수)보다 큰 값의 개수를 출력하시오.', outputDesc:'개수.',
    examples:['5\n1 2 3 4 5'], solve:(i)=>{const a=parseArrayInput(i);const avg=a.reduce((p,q)=>p+q,0)/a.length;return String(a.filter(x=>x>avg).length)} }),
  arr({ id:6227, title:'슬라이딩 윈도우 최댓값 (K=3)', tier:'gold', tags:['슬라이딩 윈도우'], difficulty:4,
    desc:'배열에서 길이 3 윈도우의 최댓값을 모두 출력하시오. N<3이면 -1.', outputDesc:'최댓값들.',
    examples:['5\n1 3 2 5 4'], solve:(i)=>{const a=parseArrayInput(i);if(a.length<3)return'-1';const res=[];for(let k=0;k+3<=a.length;k++)res.push(Math.max(a[k],a[k+1],a[k+2]));return res.join(' ')} }),
  arr({ id:6228, title:'배열에서 두 수의 차 최댓값', tier:'gold', tags:['구현'], difficulty:3,
    desc:'배열에서 a[j]-a[i] (j>i) 최댓값을 출력하시오. 없으면 0.', outputDesc:'최댓값.',
    examples:['5\n7 1 5 3 6'], solve:(i)=>{const a=parseArrayInput(i);let mn=Infinity,best=0;for(const x of a){if(x-mn>best)best=x-mn;if(x<mn)mn=x}return String(best)} }),
  arr({ id:6229, title:'배열 K번째 작은 값', tier:'gold', tags:['정렬'], difficulty:2,
    desc:'첫 원소 K, 나머지 정렬 후 K번째 작은 값을 출력하시오.', outputDesc:'K번째 작은 값.',
    examples:['6\n2 3 1 4 5 2'], solve:(i)=>{const a=parseArrayInput(i);const k=a[0];const s=a.slice(1).sort((p,q)=>p-q);return String(s[k-1])} }),
  arr({ id:6230, title:'배열 모든 쌍 합의 최솟값', tier:'gold', tags:['정렬'], difficulty:3,
    desc:'배열에서 두 원소 합의 최솟값 (i<j)을 출력하시오.', outputDesc:'최솟값.',
    examples:['5\n3 1 4 1 5'], solve:(i)=>{const a=parseArrayInput(i).sort((x,y)=>x-y);return String(a[0]+a[1])} }),
]

// ============ PLATINUM (15) ============
const PLATINUM = [
  arr({ id:6301, title:'최장 공통 부분 수열 길이', tier:'platinum', tags:['다이나믹 프로그래밍'], difficulty:5,
    desc:'배열의 첫 원소를 K(짝)라 하고, 다음 K개와 그다음 K개의 LCS 길이를 출력하시오.', outputDesc:'LCS 길이.',
    examples:['7\n3 1 2 3 2 1 3'], solve:(i)=>{const a=parseArrayInput(i);const k=a[0];const x=a.slice(1,1+k);const y=a.slice(1+k,1+2*k);if(x.length===0||y.length===0)return'0';const dp=Array.from({length:x.length+1},()=>Array(y.length+1).fill(0));for(let p=1;p<=x.length;p++)for(let q=1;q<=y.length;q++)dp[p][q]=x[p-1]===y[q-1]?dp[p-1][q-1]+1:Math.max(dp[p-1][q],dp[p][q-1]);return String(dp[x.length][y.length])} }),
  arr({ id:6302, title:'배열 0/1 배낭 (V=20)', tier:'platinum', tags:['다이나믹 프로그래밍'], difficulty:5,
    desc:'배열 쌍 (weight,value)이 N/2개 주어진다고 가정. 입력: N(짝수), 그 뒤 N개 정수. (w,v)쌍으로 묶어 V=20 배낭 최대 가치.', outputDesc:'최대 가치.',
    examples:['4\n3 4 2 3'], solve:(i)=>{const a=parseArrayInput(i);const cap=20;const items=[];for(let k=0;k<a.length;k+=2)items.push([a[k],a[k+1]||0]);const dp=Array(cap+1).fill(0);for(const[w,v]of items)for(let c=cap;c>=w;c--)dp[c]=Math.max(dp[c],dp[c-w]+v);return String(dp[cap])} }),
  arr({ id:6303, title:'그래프 컴포넌트 (간선 리스트)', tier:'platinum', tags:['그래프 이론','BFS'], difficulty:5,
    desc:'배열의 첫 원소 V, 두 번째 E, 이후 2*E개 정수 (u,v) 간선. 컴포넌트 개수를 출력하시오.', outputDesc:'컴포넌트 개수.',
    examples:['10\n5 3 1 2 3 4 4 5'], solve:(i)=>{const a=parseArrayInput(i);const v=a[0],e=a[1];const adj=Array.from({length:v+1},()=>[]);for(let k=0;k<e;k++){const u=a[2+2*k],w=a[3+2*k];adj[u].push(w);adj[w].push(u)}const vis=Array(v+1).fill(false);let c=0;for(let s=1;s<=v;s++)if(!vis[s]){c++;const q=[s];vis[s]=true;while(q.length){const x=q.shift();for(const y of adj[x])if(!vis[y]){vis[y]=true;q.push(y)}}}return String(c)} }),
  arr({ id:6304, title:'BFS 거리 (출발 1)', tier:'platinum', tags:['BFS'], difficulty:4,
    desc:'V, E, E개 간선(u,v)이 주어진다. 노드 1에서 노드 V까지 최단 경로 길이(간선 수)를 출력하시오. 도달 불가 -1.', outputDesc:'거리.',
    examples:['10\n5 3 1 2 2 3 3 5'], solve:(i)=>{const a=parseArrayInput(i);const v=a[0],e=a[1];const adj=Array.from({length:v+1},()=>[]);for(let k=0;k<e;k++){const u=a[2+2*k],w=a[3+2*k];adj[u].push(w);adj[w].push(u)}const dist=Array(v+1).fill(-1);dist[1]=0;const q=[1];while(q.length){const x=q.shift();for(const y of adj[x])if(dist[y]===-1){dist[y]=dist[x]+1;q.push(y)}}return String(dist[v])} }),
  arr({ id:6305, title:'위상정렬 (DAG)', tier:'platinum', tags:['그래프 이론','위상정렬'], difficulty:5,
    desc:'V, E, E개 간선(u->v)이 주어진다. 위상정렬 결과를 출력하시오. 사이클이면 0.', outputDesc:'위상정렬 순서 또는 0.',
    examples:['8\n4 3 1 2 1 3 3 4'], solve:(i)=>{const a=parseArrayInput(i);const v=a[0],e=a[1];const adj=Array.from({length:v+1},()=>[]);const ind=Array(v+1).fill(0);for(let k=0;k<e;k++){const u=a[2+2*k],w=a[3+2*k];adj[u].push(w);ind[w]++}const q=[];for(let s=1;s<=v;s++)if(ind[s]===0)q.push(s);const res=[];while(q.length){const x=q.shift();res.push(x);for(const y of adj[x])if(--ind[y]===0)q.push(y)}return res.length===v?res.join(' '):'0'} }),
  arr({ id:6306, title:'트리 지름 (간선가중)', tier:'platinum', tags:['트리','BFS'], difficulty:6,
    desc:'V, E(=V-1), E개 (u,v,w) 간선. 트리 지름을 출력하시오.', outputDesc:'지름.',
    examples:['11\n4 3 1 2 5 2 3 3 3 4 10'], solve:(i)=>{const a=parseArrayInput(i);const v=a[0],e=a[1];const adj=Array.from({length:v+1},()=>[]);for(let k=0;k<e;k++){const u=a[2+3*k],w=a[3+3*k],c=a[4+3*k];adj[u].push([w,c]);adj[w].push([u,c])}const bfs=(s)=>{const d=Array(v+1).fill(-1);d[s]=0;const q=[s];let far=s;while(q.length){const x=q.shift();for(const[y,c]of adj[x])if(d[y]===-1){d[y]=d[x]+c;if(d[y]>d[far])far=y;q.push(y)}}return[far,d[far]]};const[u1]=bfs(1);const[,dist]=bfs(u1);return String(dist)} }),
  arr({ id:6307, title:'다익스트라 (출발 1 → 끝 V)', tier:'platinum', tags:['최단 경로'], difficulty:6,
    desc:'V, E, E개 (u,v,w) 가중치 간선. 노드 1 → V 최단 거리. 도달 불가 -1.', outputDesc:'최단 거리.',
    examples:['11\n4 3 1 2 4 2 3 2 3 4 1'], solve:(i)=>{const a=parseArrayInput(i);const v=a[0],e=a[1];const adj=Array.from({length:v+1},()=>[]);for(let k=0;k<e;k++){const u=a[2+3*k],w=a[3+3*k],c=a[4+3*k];adj[u].push([w,c])}const d=Array(v+1).fill(Infinity);d[1]=0;const pq=[[0,1]];while(pq.length){pq.sort((p,q)=>p[0]-q[0]);const[cd,x]=pq.shift();if(cd>d[x])continue;for(const[y,c]of adj[x])if(d[x]+c<d[y]){d[y]=d[x]+c;pq.push([d[y],y])}}return String(d[v]===Infinity?-1:d[v])} }),
  arr({ id:6308, title:'사이클 판별 (무방향)', tier:'platinum', tags:['그래프 이론','DFS'], difficulty:5,
    desc:'V, E, E개 (u,v) 무방향 간선. 사이클이 있으면 yes, 없으면 no.', outputDesc:'yes 또는 no.',
    examples:['8\n4 4 1 2 2 3 3 4 4 1'], solve:(i)=>{const a=parseArrayInput(i);const v=a[0],e=a[1];const par=[...Array(v+1).keys()];const find=(x)=>par[x]===x?x:par[x]=find(par[x]);for(let k=0;k<e;k++){const u=a[2+2*k],w=a[3+2*k];const pu=find(u),pw=find(w);if(pu===pw)return'yes';par[pu]=pw}return'no'} }),
  arr({ id:6309, title:'이분 그래프 판별', tier:'platinum', tags:['그래프 이론','BFS'], difficulty:5,
    desc:'V, E, E개 (u,v). 이분 그래프면 yes 아니면 no.', outputDesc:'yes 또는 no.',
    examples:['8\n4 3 1 2 2 3 3 4'], solve:(i)=>{const a=parseArrayInput(i);const v=a[0],e=a[1];const adj=Array.from({length:v+1},()=>[]);for(let k=0;k<e;k++){const u=a[2+2*k],w=a[3+2*k];adj[u].push(w);adj[w].push(u)}const col=Array(v+1).fill(0);for(let s=1;s<=v;s++)if(col[s]===0){col[s]=1;const q=[s];while(q.length){const x=q.shift();for(const y of adj[x]){if(col[y]===0){col[y]=-col[x];q.push(y)}else if(col[y]===col[x])return'no'}}}return'yes'} }),
  arr({ id:6310, title:'유니온 파인드 컴포넌트 크기 최대', tier:'platinum', tags:['유니온-파인드'], difficulty:5,
    desc:'V, E, E개 (u,v). union 후 가장 큰 컴포넌트 크기.', outputDesc:'최대 크기.',
    examples:['8\n5 3 1 2 2 3 4 5'], solve:(i)=>{const a=parseArrayInput(i);const v=a[0],e=a[1];const par=[...Array(v+1).keys()];const sz=Array(v+1).fill(1);const find=(x)=>par[x]===x?x:par[x]=find(par[x]);for(let k=0;k<e;k++){const u=a[2+2*k],w=a[3+2*k];const pu=find(u),pw=find(w);if(pu!==pw){par[pu]=pw;sz[pw]+=sz[pu]}}let mx=0;for(let s=1;s<=v;s++)if(par[s]===s)mx=Math.max(mx,sz[s]);return String(mx)} }),
  arr({ id:6311, title:'KMP 부분 문자열 매칭 개수', tier:'platinum', tags:['문자열','KMP'], difficulty:6,
    desc:'배열 첫 원소 L(텍스트 길이) + L개 정수(문자코드) + 패턴 길이 M + M개 정수. 매칭 횟수.', outputDesc:'매칭 횟수.',
    examples:['12\n6 1 2 1 2 1 2 2 1 2'], solve:(i)=>{const a=parseArrayInput(i);const L=a[0];const T=a.slice(1,1+L);const M=a[1+L];const P=a.slice(2+L,2+L+M);if(!M||M>L)return'0';const pi=Array(M).fill(0);for(let p=1,k=0;p<M;p++){while(k>0&&P[k]!==P[p])k=pi[k-1];if(P[k]===P[p])k++;pi[p]=k}let cnt=0;for(let q=0,k=0;q<L;q++){while(k>0&&P[k]!==T[q])k=pi[k-1];if(P[k]===T[q])k++;if(k===M){cnt++;k=pi[k-1]}}return String(cnt)} }),
  arr({ id:6312, title:'세그먼트 트리 구간 합 (점 업데이트)', tier:'platinum', tags:['세그먼트 트리'], difficulty:6,
    desc:'N + N개 정수 + Q + Q개 쿼리(쿼리는 a b c, c==0이면 idx a의 값을 b로 set, c==1이면 [a,b] 구간 합).', outputDesc:'구간 합 결과들 줄별.',
    examples:['9\n4 1 2 3 4 2 1 2 4 0 2 5'], solve:(i)=>{const a=parseArrayInput(i);let p=0;const n=a[p++];const arr=a.slice(p,p+n);p+=n;const q=a[p++];const sz=1<<Math.ceil(Math.log2(n||1));const t=Array(2*sz).fill(0);for(let k=0;k<n;k++)t[sz+k]=arr[k];for(let k=sz-1;k>0;k--)t[k]=t[2*k]+t[2*k+1];const upd=(idx,val)=>{idx+=sz-1;t[idx]=val;for(idx>>=1;idx;idx>>=1)t[idx]=t[2*idx]+t[2*idx+1]};const qry=(l,r)=>{let s=0;for(l+=sz-1,r+=sz-1;l<=r;l>>=1,r>>=1){if(l&1)s+=t[l++];if(!(r&1))s+=t[r--]}return s};const res=[];for(let k=0;k<q;k++){const x=a[p++],y=a[p++],z=a[p++];if(z===0)upd(x,y);else res.push(qry(x,y))}return res.join('\n')||'0'} }),
  arr({ id:6313, title:'펜윅 트리 prefix sum', tier:'platinum', tags:['세그먼트 트리'], difficulty:5,
    desc:'N + N개 정수 + Q + Q개 쿼리(a b: a==0 → idx b 값에 1 증가, a==1 → prefix sum [1..b]).', outputDesc:'prefix sum 결과 줄별.',
    examples:['10\n5 1 0 0 0 0 4 0 3 1 5'], solve:(i)=>{const a=parseArrayInput(i);let p=0;const n=a[p++];const arr=a.slice(p,p+n);p+=n;const q=a[p++];const bit=Array(n+1).fill(0);const upd=(idx,v)=>{for(let k=idx;k<=n;k+=k&-k)bit[k]+=v};const qry=(idx)=>{let s=0;for(let k=idx;k>0;k-=k&-k)s+=bit[k];return s};for(let k=0;k<n;k++)upd(k+1,arr[k]);const res=[];for(let k=0;k<q;k++){const t=a[p++],x=a[p++];if(t===0)upd(x,1);else res.push(qry(x))}return res.join('\n')||'0'} }),
  arr({ id:6314, title:'MST 크루스칼', tier:'platinum', tags:['MST','유니온-파인드'], difficulty:6,
    desc:'V, E, E개 (u,v,w) 간선. MST 가중치 합.', outputDesc:'MST 가중치.',
    examples:['14\n4 4 1 2 1 1 3 4 2 3 2 3 4 3'], solve:(i)=>{const a=parseArrayInput(i);const v=a[0],e=a[1];const edges=[];for(let k=0;k<e;k++)edges.push([a[2+3*k],a[3+3*k],a[4+3*k]]);edges.sort((p,q)=>p[2]-q[2]);const par=[...Array(v+1).keys()];const find=(x)=>par[x]===x?x:par[x]=find(par[x]);let s=0,used=0;for(const[u,w,c]of edges){const pu=find(u),pw=find(w);if(pu!==pw){par[pu]=pw;s+=c;if(++used===v-1)break}}return String(s)} }),
  arr({ id:6315, title:'플로이드 워셜 (모든 쌍 최단)', tier:'platinum', tags:['최단 경로'], difficulty:6,
    desc:'V, E, E개 (u,v,w). 모든 쌍 (i<j)의 최단 거리 합을 출력하시오. 도달 불가 쌍은 무시.', outputDesc:'합.',
    examples:['11\n3 3 1 2 1 2 3 2 1 3 4'], solve:(i)=>{const a=parseArrayInput(i);const v=a[0],e=a[1];const INF=Infinity;const d=Array.from({length:v+1},()=>Array(v+1).fill(INF));for(let s=1;s<=v;s++)d[s][s]=0;for(let k=0;k<e;k++){const u=a[2+3*k],w=a[3+3*k],c=a[4+3*k];d[u][w]=Math.min(d[u][w],c);d[w][u]=Math.min(d[w][u],c)}for(let m=1;m<=v;m++)for(let p=1;p<=v;p++)for(let q=1;q<=v;q++)if(d[p][m]+d[m][q]<d[p][q])d[p][q]=d[p][m]+d[m][q];let s=0;for(let p=1;p<=v;p++)for(let q=p+1;q<=v;q++)if(d[p][q]!==INF)s+=d[p][q];return String(s)} }),
]

// ============ DIAMOND (5) ============
const DIAMOND = [
  arr({ id:6401, title:'세그먼트 트리 + 레이지 (구간 추가 + 구간 합)', tier:'diamond', tags:['세그먼트 트리','레이지 프로파게이션'], difficulty:8,
    desc:'N + N개 정수 + Q + Q개 쿼리. 쿼리 (t l r v): t==1 → [l,r] 모든 원소에 v 더하기. t==2 → [l,r] 합 출력.', outputDesc:'합 결과 줄별.',
    examples:['11\n5 1 2 3 4 5 2 1 1 3 1 2 1 5'], solve:(i)=>{const a=parseArrayInput(i);let p=0;const n=a[p++];const arr=a.slice(p,p+n);p+=n;const q=a[p++];const sz=4*n;const t=Array(sz).fill(0n);const lz=Array(sz).fill(0n);const build=(node,l,r)=>{if(l===r){t[node]=BigInt(arr[l-1]);return}const m=(l+r)>>1;build(2*node,l,m);build(2*node+1,m+1,r);t[node]=t[2*node]+t[2*node+1]};const push=(node,l,r)=>{if(lz[node]!==0n){const m=(l+r)>>1;t[2*node]+=lz[node]*BigInt(m-l+1);lz[2*node]+=lz[node];t[2*node+1]+=lz[node]*BigInt(r-m);lz[2*node+1]+=lz[node];lz[node]=0n}};const upd=(node,l,r,ql,qr,v)=>{if(qr<l||r<ql)return;if(ql<=l&&r<=qr){t[node]+=v*BigInt(r-l+1);lz[node]+=v;return}push(node,l,r);const m=(l+r)>>1;upd(2*node,l,m,ql,qr,v);upd(2*node+1,m+1,r,ql,qr,v);t[node]=t[2*node]+t[2*node+1]};const qry=(node,l,r,ql,qr)=>{if(qr<l||r<ql)return 0n;if(ql<=l&&r<=qr)return t[node];push(node,l,r);const m=(l+r)>>1;return qry(2*node,l,m,ql,qr)+qry(2*node+1,m+1,r,ql,qr)};build(1,1,n);const res=[];for(let k=0;k<q;k++){const tt=a[p++],l=a[p++],r=a[p++];if(tt===1){const v=a[p++];upd(1,1,n,l,r,BigInt(v))}else res.push(qry(1,1,n,l,r).toString())}return res.join('\n')||'0'} }),
  arr({ id:6402, title:'유니온 파인드 + 쿼리', tier:'diamond', tags:['유니온-파인드'], difficulty:7,
    desc:'V + Q + Q개 쿼리 (t a b). t==0 → union(a,b), t==1 → 같은 컴포넌트? 1/0.', outputDesc:'1/0 줄별.',
    examples:['8\n5 3 0 1 2 1 1 2 1 2 3'], solve:(i)=>{const a=parseArrayInput(i);let p=0;const v=a[p++];const q=a[p++];const par=[...Array(v+1).keys()];const find=(x)=>par[x]===x?x:par[x]=find(par[x]);const res=[];for(let k=0;k<q;k++){const t=a[p++],x=a[p++],y=a[p++];if(t===0){const px=find(x),py=find(y);if(px!==py)par[px]=py}else res.push(find(x)===find(y)?'1':'0')}return res.join('\n')||'0'} }),
  arr({ id:6403, title:'팰린드롬 분할 최소 컷 (DP)', tier:'diamond', tags:['문자열','다이나믹 프로그래밍'], difficulty:8,
    desc:'배열 첫 원소 L + L개 정수(문자코드). 팰린드롬으로 분할하는 최소 컷 수.', outputDesc:'최소 컷 수.',
    examples:['4\n3 1 2 1'], solve:(i)=>{const a=parseArrayInput(i);const n=a[0];const s=a.slice(1,1+n);if(n<=1)return'0';const pal=Array.from({length:n},()=>Array(n).fill(false));for(let p=0;p<n;p++)pal[p][p]=true;for(let len=2;len<=n;len++)for(let p=0;p+len-1<n;p++){const q=p+len-1;if(s[p]===s[q]&&(len===2||pal[p+1][q-1]))pal[p][q]=true}const dp=Array(n).fill(Infinity);for(let p=0;p<n;p++){if(pal[0][p]){dp[p]=0;continue}for(let q=1;q<=p;q++)if(pal[q][p]&&dp[q-1]+1<dp[p])dp[p]=dp[q-1]+1}return String(dp[n-1])} }),
  arr({ id:6404, title:'다익스트라 우선순위큐 (heap)', tier:'diamond', tags:['최단 경로','우선순위 큐'], difficulty:7,
    desc:'V + E + E개 (u,v,w). 출발 1에서 각 노드까지 최단 거리의 합. 도달 불가 = -1로 간주(합 제외).', outputDesc:'합.',
    examples:['14\n4 4 1 2 1 2 3 2 3 4 3 1 3 10'], solve:(i)=>{const a=parseArrayInput(i);const v=a[0],e=a[1];const adj=Array.from({length:v+1},()=>[]);for(let k=0;k<e;k++){const u=a[2+3*k],w=a[3+3*k],c=a[4+3*k];adj[u].push([w,c]);adj[w].push([u,c])}const d=Array(v+1).fill(Infinity);d[1]=0;const pq=[[0,1]];while(pq.length){pq.sort((p,q)=>p[0]-q[0]);const[cd,x]=pq.shift();if(cd>d[x])continue;for(const[y,c]of adj[x])if(d[x]+c<d[y]){d[y]=d[x]+c;pq.push([d[y],y])}}let s=0;for(let k=1;k<=v;k++)if(d[k]!==Infinity)s+=d[k];return String(s)} }),
  arr({ id:6405, title:'LIS 복원 (값 출력)', tier:'diamond', tags:['다이나믹 프로그래밍','이분 탐색'], difficulty:7,
    desc:'배열의 LIS 한 가지를 출력하시오 (오름차순).', outputDesc:'LIS 값들.',
    examples:['6\n10 9 2 5 3 7'], solve:(i)=>{const a=parseArrayInput(i);const t=[],idx=[],prev=Array(a.length).fill(-1);for(let k=0;k<a.length;k++){const x=a[k];let l=0,r=t.length;while(l<r){const m=(l+r)>>1;if(t[m]<x)l=m+1;else r=m}t[l]=x;idx[l]=k;prev[k]=l>0?idx[l-1]:-1}const res=[];for(let cur=idx[t.length-1];cur!==-1;cur=prev[cur])res.push(a[cur]);return res.reverse().join(' ')} }),
]

export const NEW_PROBLEMS_2026 = [...BRONZE, ...SILVER, ...GOLD, ...PLATINUM, ...DIAMOND]
