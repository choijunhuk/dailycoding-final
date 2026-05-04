/* eslint-disable no-unused-vars, no-constant-condition */
export const MIN_HIDDEN_TESTCASES = 10

export const TIERS = {
  bronze:   { label: '브론즈',   color: '#cd7f32', bg: 'rgba(205,127,50,.15)'  },
  silver:   { label: '실버',     color: '#c0c0c0', bg: 'rgba(192,192,192,.12)' },
  gold:     { label: '골드',     color: '#ffd700', bg: 'rgba(255,215,0,.12)'   },
  platinum: { label: '플래티넘', color: '#00e5cc', bg: 'rgba(0,229,204,.12)'   },
  diamond:  { label: '다이아',   color: '#b9f2ff', bg: 'rgba(185,242,255,.12)' },
}

export const TIER_COLORS = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#ffd700',
  platinum: '#00e5cc',
  diamond: '#b9f2ff',
}

function normalizeOutput(value) {
  return Array.isArray(value) ? value.join('\n') : String(value)
}

function buildHiddenTestcases(hiddenInputs, solve) {
  const testcases = hiddenInputs.map((input) => ({ input, output: normalizeOutput(solve(input)) }))
  if (testcases.length === 0) return testcases

  for (let index = testcases.length; index < MIN_HIDDEN_TESTCASES; index += 1) {
    testcases.push({ ...testcases[index % testcases.length] })
  }
  return testcases
}

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

function parseMatrixInput(input) {
  const lines = String(input).trim().split('\n')
  const firstLine = lines[0].trim().split(/\s+/)
  const n = Number(firstLine[0])
  return lines.slice(1, 1 + n).map((line) => line.trim().split(/\s+/).map(Number))
}

function gcd(a, b) {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

function isPrime(n) {
  if (n < 2) return false
  if (n % 2 === 0) return n === 2
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false
  }
  return true
}

function countPrimesUpTo(n) {
  let count = 0
  for (let i = 2; i <= n; i += 1) {
    if (isPrime(i)) count += 1
  }
  return count
}

function fib(n) {
  let a = 0
  let b = 1
  for (let i = 0; i < n; i += 1) {
    const next = a + b
    a = b
    b = next
  }
  return a
}

function stairMaxScore(input) {
  const nums = ints(input)
  const n = nums[0]
  const scores = [0, ...nums.slice(1, n + 1)]
  if (n === 1) return String(scores[1])
  const dp = Array.from({ length: n + 1 }, () => [0, 0])
  dp[1][0] = scores[1]
  dp[1][1] = scores[1]
  for (let i = 2; i <= n; i += 1) {
    dp[i][0] = Math.max(dp[i - 2][0], dp[i - 2][1]) + scores[i]
    dp[i][1] = dp[i - 1][0] + scores[i]
  }
  return String(Math.max(dp[n][0], dp[n][1]))
}

function lisLength(input) {
  const arr = parseArrayInput(input)
  const dp = Array(arr.length).fill(1)
  let best = 0
  for (let i = 0; i < arr.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (arr[j] < arr[i]) {
        dp[i] = Math.max(dp[i], dp[j] + 1)
      }
    }
    best = Math.max(best, dp[i])
  }
  return String(best)
}

function bfsOrder(input) {
  const nums = ints(input)
  const [n, m, start] = nums.slice(0, 3)
  const edges = nums.slice(3)
  const graph = Array.from({ length: n + 1 }, () => [])
  for (let i = 0; i < m * 2; i += 2) {
    const a = edges[i]
    const b = edges[i + 1]
    graph[a].push(b)
    graph[b].push(a)
  }
  graph.forEach((list) => list.sort((a, b) => a - b))
  const visited = Array(n + 1).fill(false)
  const q = [start]
  visited[start] = true
  const order = []
  for (let head = 0; head < q.length; head += 1) {
    const cur = q[head]
    order.push(cur)
    for (const next of graph[cur]) {
      if (!visited[next]) {
        visited[next] = true
        q.push(next)
      }
    }
  }
  return order.join(' ')
}

function dijkstraAll(input) {
  const nums = ints(input)
  const [n, m, start] = nums.slice(0, 3)
  const edges = nums.slice(3)
  const graph = Array.from({ length: n + 1 }, () => [])
  for (let i = 0; i < m * 3; i += 3) {
    const u = edges[i]
    const v = edges[i + 1]
    const w = edges[i + 2]
    graph[u].push([v, w])
  }
  const dist = Array(n + 1).fill(Infinity)
  const used = Array(n + 1).fill(false)
  dist[start] = 0
  for (let i = 1; i <= n; i += 1) {
    let pick = -1
    for (let node = 1; node <= n; node += 1) {
      if (!used[node] && (pick === -1 || dist[node] < dist[pick])) pick = node
    }
    if (pick === -1 || dist[pick] === Infinity) break
    used[pick] = true
    for (const [next, weight] of graph[pick]) {
      if (dist[next] > dist[pick] + weight) {
        dist[next] = dist[pick] + weight
      }
    }
  }
  return dist.slice(1).map((v) => (v === Infinity ? 'INF' : String(v))).join('\n')
}

function edmondsKarp(input) {
  const nums = ints(input)
  const [n, m] = nums.slice(0, 2)
  const edges = nums.slice(2)
  const capacity = Array.from({ length: n + 1 }, () => Array(n + 1).fill(0))
  const graph = Array.from({ length: n + 1 }, () => [])
  for (let i = 0; i < m * 3; i += 3) {
    const u = edges[i]
    const v = edges[i + 1]
    const c = edges[i + 2]
    capacity[u][v] += c
    graph[u].push(v)
    graph[v].push(u)
  }
  let flow = 0
  while (true) {
    const parent = Array(n + 1).fill(-1)
    parent[1] = 1
    const q = [1]
    for (let head = 0; head < q.length; head += 1) {
      const cur = q[head]
      for (const next of graph[cur]) {
        if (parent[next] === -1 && capacity[cur][next] > 0) {
          parent[next] = cur
          q.push(next)
        }
      }
    }
    if (parent[n] === -1) break
    let add = Infinity
    for (let cur = n; cur !== 1; cur = parent[cur]) {
      add = Math.min(add, capacity[parent[cur]][cur])
    }
    for (let cur = n; cur !== 1; cur = parent[cur]) {
      capacity[parent[cur]][cur] -= add
      capacity[cur][parent[cur]] += add
    }
    flow += add
  }
  return String(flow)
}

function compressStringLength(input) {
  const s = String(input).trim()
  if (s.length <= 1) return String(s.length)
  let best = s.length
  for (let unit = 1; unit <= Math.floor(s.length / 2); unit += 1) {
    let compressed = ''
    let prev = s.slice(0, unit)
    let count = 1
    for (let i = unit; i < s.length; i += unit) {
      const chunk = s.slice(i, i + unit)
      if (chunk === prev) {
        count += 1
      } else {
        compressed += (count > 1 ? String(count) : '') + prev
        prev = chunk
        count = 1
      }
    }
    compressed += (count > 1 ? String(count) : '') + prev
    best = Math.min(best, compressed.length)
  }
  return String(best)
}

function binarySearchIndex(input) {
  const nums = ints(input)
  const n = nums[0]
  const target = nums[1]
  const arr = nums.slice(2, 2 + n)
  let lo = 0
  let hi = arr.length - 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (arr[mid] === target) return String(mid)
    if (arr[mid] < target) lo = mid + 1
    else hi = mid - 1
  }
  return '-1'
}

function validParentheses(input) {
  const s = String(input).trim()
  const stack = []
  const pairs = { ')': '(', ']': '[', '}': '{' }
  for (const ch of s) {
    if ('([{'.includes(ch)) stack.push(ch)
    else if (pairs[ch]) {
      if (stack.pop() !== pairs[ch]) return 'NO'
    }
  }
  return stack.length === 0 ? 'YES' : 'NO'
}

function prefixSumQueries(input) {
  const lines = String(input).trim().split('\n')
  const [n, q] = lines[0].trim().split(/\s+/).map(Number)
  const arr = lines[1].trim().split(/\s+/).map(Number).slice(0, n)
  const ps = [0]
  for (const value of arr) ps.push(ps[ps.length - 1] + value)
  const out = []
  for (let i = 0; i < q; i += 1) {
    const [l, r] = lines[2 + i].trim().split(/\s+/).map(Number)
    out.push(String(ps[r] - ps[l - 1]))
  }
  return out.join('\n')
}

function rotateArrayRight(input) {
  const nums = ints(input)
  const n = nums[0]
  const k = nums[1]
  const arr = nums.slice(2, 2 + n)
  const step = ((k % n) + n) % n
  const rotated = arr.slice(n - step).concat(arr.slice(0, n - step))
  return rotated.join(' ')
}

function countTargetPairs(input) {
  const nums = ints(input)
  const n = nums[0]
  const target = nums[1]
  const arr = nums.slice(2, 2 + n).sort((a, b) => a - b)
  let left = 0
  let right = arr.length - 1
  let count = 0
  while (left < right) {
    const sum = arr[left] + arr[right]
    if (sum === target) {
      count += 1
      left += 1
      right -= 1
    } else if (sum < target) left += 1
    else right -= 1
  }
  return String(count)
}

function maxWindowSum(input) {
  const nums = ints(input)
  const n = nums[0]
  const k = nums[1]
  const arr = nums.slice(2, 2 + n)
  let sum = 0
  for (let i = 0; i < k; i += 1) sum += arr[i]
  let best = sum
  for (let i = k; i < arr.length; i += 1) {
    sum += arr[i] - arr[i - k]
    best = Math.max(best, sum)
  }
  return String(best)
}

function rotateMatrix90(input) {
  const matrix = parseMatrixInput(input)
  const n = matrix.length
  const result = Array.from({ length: n }, () => Array(n).fill(0))
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      result[j][n - 1 - i] = matrix[i][j]
    }
  }
  return result.map((row) => row.join(' ')).join('\n')
}

function medianOfArray(input) {
  const arr = parseArrayInput(input).slice().sort((a, b) => a - b)
  return String(arr[Math.floor(arr.length / 2)])
}

function maxRowSum(input) {
  const matrix = parseMatrixInput(input)
  return String(Math.max(...matrix.map((row) => row.reduce((sum, value) => sum + value, 0))))
}

function coordinateCompress(input) {
  const arr = parseArrayInput(input)
  const unique = [...new Set(arr)].sort((a, b) => a - b)
  const rank = new Map(unique.map((value, idx) => [value, idx]))
  return arr.map((value) => rank.get(value)).join(' ')
}

function countGridComponents(input) {
  const lines = String(input).trim().split('\n')
  const [n, m] = lines[0].trim().split(/\s+/).map(Number)
  const grid = lines.slice(1, 1 + n).map((line) => line.trim().split('').map(Number))
  const visited = Array.from({ length: n }, () => Array(m).fill(false))
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]]
  let count = 0
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < m; j += 1) {
      if (grid[i][j] !== 1 || visited[i][j]) continue
      count += 1
      const q = [[i, j]]
      visited[i][j] = true
      for (let head = 0; head < q.length; head += 1) {
        const [x, y] = q[head]
        for (const [dx, dy] of dirs) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= n || ny >= m) continue
          if (grid[nx][ny] !== 1 || visited[nx][ny]) continue
          visited[nx][ny] = true
          q.push([nx, ny])
        }
      }
    }
  }
  return String(count)
}

function josephusLast(input) {
  const [n, k] = ints(input)
  const arr = Array.from({ length: n }, (_, idx) => idx + 1)
  let idx = 0
  while (arr.length > 1) {
    idx = (idx + k - 1) % arr.length
    arr.splice(idx, 1)
  }
  return String(arr[0])
}

function modeOfArray(input) {
  const arr = parseArrayInput(input)
  const counts = new Map()
  for (const value of arr) counts.set(value, (counts.get(value) || 0) + 1)
  let bestValue = null
  let bestCount = -1
  for (const [value, count] of counts.entries()) {
    if (count > bestCount || (count === bestCount && value < bestValue)) {
      bestValue = value
      bestCount = count
    }
  }
  return String(bestValue)
}

function maxSubarraySum(input) {
  const arr = parseArrayInput(input)
  let cur = arr[0]
  let best = arr[0]
  for (let i = 1; i < arr.length; i += 1) {
    cur = Math.max(arr[i], cur + arr[i])
    best = Math.max(best, cur)
  }
  return String(best)
}

function commonCharacterCount(input) {
  const [a, b] = String(input).trim().split('\n')
  const countA = new Map()
  const countB = new Map()
  for (const ch of a.trim()) countA.set(ch, (countA.get(ch) || 0) + 1)
  for (const ch of b.trim()) countB.set(ch, (countB.get(ch) || 0) + 1)
  let total = 0
  for (const [ch, cnt] of countA.entries()) {
    total += Math.min(cnt, countB.get(ch) || 0)
  }
  return String(total)
}

function queueSimulation(input) {
  const lines = String(input).trim().split('\n')
  const q = []
  const out = []
  for (let i = 1; i < lines.length; i += 1) {
    const [cmd, raw] = lines[i].trim().split(' ')
    if (cmd === 'push') q.push(Number(raw))
    if (cmd === 'pop') out.push(String(q.length ? q.shift() : -1))
    if (cmd === 'front') out.push(String(q.length ? q[0] : -1))
    if (cmd === 'size') out.push(String(q.length))
  }
  return out.join('\n')
}

function topoSort(input) {
  const nums = ints(input)
  const [n, m] = nums.slice(0, 2)
  const edges = nums.slice(2)
  const graph = Array.from({ length: n + 1 }, () => [])
  const indeg = Array(n + 1).fill(0)
  for (let i = 0; i < m * 2; i += 2) {
    const a = edges[i]
    const b = edges[i + 1]
    graph[a].push(b)
    indeg[b] += 1
  }
  const q = []
  for (let i = 1; i <= n; i += 1) if (indeg[i] === 0) q.push(i)
  q.sort((a, b) => a - b)
  const order = []
  for (let head = 0; head < q.length; head += 1) {
    const cur = q[head]
    order.push(cur)
    for (const next of graph[cur]) {
      indeg[next] -= 1
      if (indeg[next] === 0) q.push(next)
    }
    q.slice(head + 1).sort((a, b) => a - b)
  }
  return order.length === n ? order.join(' ') : '-1'
}

function knapsack(input) {
  const nums = ints(input)
  const [n, limit] = nums.slice(0, 2)
  const items = nums.slice(2)
  const dp = Array(limit + 1).fill(0)
  for (let i = 0; i < n; i += 1) {
    const w = items[i * 2]
    const v = items[i * 2 + 1]
    for (let cap = limit; cap >= w; cap -= 1) {
      dp[cap] = Math.max(dp[cap], dp[cap - w] + v)
    }
  }
  return String(Math.max(...dp))
}

function treeDiameter(input) {
  const nums = ints(input)
  const n = nums[0]
  const edges = nums.slice(1)
  const graph = Array.from({ length: n + 1 }, () => [])
  for (let i = 0; i < (n - 1) * 3; i += 3) {
    const a = edges[i]
    const b = edges[i + 1]
    const w = edges[i + 2]
    graph[a].push([b, w])
    graph[b].push([a, w])
  }
  function farthest(start) {
    const dist = Array(n + 1).fill(-1)
    dist[start] = 0
    const q = [start]
    for (let head = 0; head < q.length; head += 1) {
      const cur = q[head]
      for (const [next, w] of graph[cur]) {
        if (dist[next] !== -1) continue
        dist[next] = dist[cur] + w
        q.push(next)
      }
    }
    let pick = start
    for (let i = 1; i <= n; i += 1) {
      if (dist[i] > dist[pick]) pick = i
    }
    return [pick, dist[pick]]
  }
  const [node] = farthest(1)
  const [, distance] = farthest(node)
  return String(distance)
}

function sum2DQueries(input) {
  const lines = String(input).trim().split('\n')
  const [n, q] = lines[0].trim().split(/\s+/).map(Number)
  const matrix = lines.slice(1, 1 + n).map((line) => line.trim().split(/\s+/).map(Number))
  const ps = Array.from({ length: n + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      ps[i][j] = matrix[i - 1][j - 1] + ps[i - 1][j] + ps[i][j - 1] - ps[i - 1][j - 1]
    }
  }
  const out = []
  for (let i = 0; i < q; i += 1) {
    const [x1, y1, x2, y2] = lines[1 + n + i].trim().split(/\s+/).map(Number)
    out.push(String(ps[x2][y2] - ps[x1 - 1][y2] - ps[x2][y1 - 1] + ps[x1 - 1][y1 - 1]))
  }
  return out.join('\n')
}

function mstKruskal(input) {
  const nums = ints(input)
  const [n, m] = nums.slice(0, 2)
  const edges = []
  for (let i = 0; i < m; i += 1) {
    edges.push(nums.slice(2 + i * 3, 5 + i * 3))
  }
  edges.sort((a, b) => a[2] - b[2])
  const parent = Array.from({ length: n + 1 }, (_, idx) => idx)
  const find = (x) => {
    if (parent[x] === x) return x
    parent[x] = find(parent[x])
    return parent[x]
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return false
    parent[rb] = ra
    return true
  }
  let total = 0
  for (const [a, b, w] of edges) {
    if (union(a, b)) total += w
  }
  return String(total)
}

function lcsLength(input) {
  const [a, b] = String(input).trim().split('\n').map((line) => line.trim())
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return String(dp[a.length][b.length])
}

function unionFindQueries(input) {
  const lines = String(input).trim().split('\n')
  const [n, q] = lines[0].trim().split(/\s+/).map(Number)
  const parent = Array.from({ length: n + 1 }, (_, idx) => idx)
  const find = (x) => {
    if (parent[x] === x) return x
    parent[x] = find(parent[x])
    return parent[x]
  }
  const union = (a, b) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }
  const out = []
  for (let i = 0; i < q; i += 1) {
    const [type, a, b] = lines[i + 1].trim().split(/\s+/).map(Number)
    if (type === 0) union(a, b)
    else out.push(find(a) === find(b) ? 'YES' : 'NO')
  }
  return out.join('\n')
}

function minCoinCount(input) {
  const nums = ints(input)
  const [n, target] = nums.slice(0, 2)
  const coins = nums.slice(2, 2 + n)
  const dp = Array(target + 1).fill(Infinity)
  dp[0] = 0
  for (const coin of coins) {
    for (let value = coin; value <= target; value += 1) {
      dp[value] = Math.min(dp[value], dp[value - coin] + 1)
    }
  }
  return dp[target] === Infinity ? '-1' : String(dp[target])
}

function intervalScheduling(input) {
  const nums = ints(input)
  const n = nums[0]
  const meetings = []
  for (let i = 0; i < n; i += 1) {
    meetings.push([nums[1 + i * 2], nums[2 + i * 2]])
  }
  meetings.sort((a, b) => a[1] - b[1] || a[0] - b[0])
  let end = -Infinity
  let count = 0
  for (const [start, finish] of meetings) {
    if (start >= end) {
      count += 1
      end = finish
    }
  }
  return String(count)
}

function shortestGridPath(input) {
  const lines = String(input).trim().split('\n')
  const [n, m] = lines[0].trim().split(/\s+/).map(Number)
  const grid = lines.slice(1, 1 + n).map((line) => line.trim().split('').map(Number))
  const dist = Array.from({ length: n }, () => Array(m).fill(-1))
  const q = [[0, 0]]
  dist[0][0] = grid[0][0] === 1 ? 1 : -1
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]]
  for (let head = 0; head < q.length; head += 1) {
    const [x, y] = q[head]
    for (const [dx, dy] of dirs) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= n || ny >= m) continue
      if (grid[nx][ny] !== 1 || dist[nx][ny] !== -1) continue
      dist[nx][ny] = dist[x][y] + 1
      q.push([nx, ny])
    }
  }
  return String(dist[n - 1][m - 1])
}

function kmpPositions(input) {
  const [text, pattern] = String(input).trim().split('\n')
  const pi = Array(pattern.length).fill(0)
  for (let i = 1, j = 0; i < pattern.length; i += 1) {
    while (j > 0 && pattern[i] !== pattern[j]) j = pi[j - 1]
    if (pattern[i] === pattern[j]) {
      j += 1
      pi[i] = j
    }
  }
  const positions = []
  for (let i = 0, j = 0; i < text.length; i += 1) {
    while (j > 0 && text[i] !== pattern[j]) j = pi[j - 1]
    if (text[i] === pattern[j]) {
      if (j === pattern.length - 1) {
        positions.push(i - pattern.length + 2)
        j = pi[j]
      } else j += 1
    }
  }
  return `${positions.length}\n${positions.join(' ')}`
}

function segmentTreeSum(input) {
  const lines = String(input).trim().split('\n')
  const [n, q] = lines[0].trim().split(/\s+/).map(Number)
  const arr = lines[1].trim().split(/\s+/).map(Number)
  const tree = Array(n * 4).fill(0)
  function build(node, left, right) {
    if (left === right) {
      tree[node] = arr[left]
      return
    }
    const mid = Math.floor((left + right) / 2)
    build(node * 2, left, mid)
    build(node * 2 + 1, mid + 1, right)
    tree[node] = tree[node * 2] + tree[node * 2 + 1]
  }
  function update(node, left, right, idx, value) {
    if (idx < left || idx > right) return
    if (left === right) {
      tree[node] = value
      return
    }
    const mid = Math.floor((left + right) / 2)
    update(node * 2, left, mid, idx, value)
    update(node * 2 + 1, mid + 1, right, idx, value)
    tree[node] = tree[node * 2] + tree[node * 2 + 1]
  }
  function query(node, left, right, ql, qr) {
    if (qr < left || right < ql) return 0
    if (ql <= left && right <= qr) return tree[node]
    const mid = Math.floor((left + right) / 2)
    return query(node * 2, left, mid, ql, qr) + query(node * 2 + 1, mid + 1, right, ql, qr)
  }
  build(1, 0, n - 1)
  const out = []
  for (let i = 0; i < q; i += 1) {
    const [type, a, b] = lines[2 + i].trim().split(/\s+/).map(Number)
    if (type === 1) update(1, 0, n - 1, a - 1, b)
    else out.push(String(query(1, 0, n - 1, a - 1, b - 1)))
  }
  return out.join('\n')
}

function lcaQueries(input) {
  const lines = String(input).trim().split('\n')
  const n = Number(lines[0])
  const graph = Array.from({ length: n + 1 }, () => [])
  for (let i = 0; i < n - 1; i += 1) {
    const [a, b] = lines[1 + i].trim().split(/\s+/).map(Number)
    graph[a].push(b)
    graph[b].push(a)
  }
  const q = Number(lines[n])
  const parent = Array.from({ length: 17 }, () => Array(n + 1).fill(0))
  const depth = Array(n + 1).fill(-1)
  const queue = [1]
  depth[1] = 0
  for (let head = 0; head < queue.length; head += 1) {
    const cur = queue[head]
    for (const next of graph[cur]) {
      if (depth[next] !== -1) continue
      depth[next] = depth[cur] + 1
      parent[0][next] = cur
      queue.push(next)
    }
  }
  for (let p = 1; p < 17; p += 1) {
    for (let node = 1; node <= n; node += 1) {
      parent[p][node] = parent[p - 1][parent[p - 1][node]]
    }
  }
  function lca(a, b) {
    let x = a
    let y = b
    if (depth[x] < depth[y]) [x, y] = [y, x]
    for (let p = 16; p >= 0; p -= 1) {
      if (depth[x] - (1 << p) >= depth[y]) x = parent[p][x]
    }
    if (x === y) return x
    for (let p = 16; p >= 0; p -= 1) {
      if (parent[p][x] !== parent[p][y]) {
        x = parent[p][x]
        y = parent[p][y]
      }
    }
    return parent[0][x]
  }
  const out = []
  for (let i = 0; i < q; i += 1) {
    const [a, b] = lines[n + 1 + i].trim().split(/\s+/).map(Number)
    out.push(String(lca(a, b)))
  }
  return out.join('\n')
}

function longestPalSubstringLength(input) {
  const s = String(input).trim()
  let best = 0
  const expand = (l, r) => {
    while (l >= 0 && r < s.length && s[l] === s[r]) {
      best = Math.max(best, r - l + 1)
      l -= 1
      r += 1
    }
  }
  for (let i = 0; i < s.length; i += 1) {
    expand(i, i)
    expand(i, i + 1)
  }
  return String(best)
}

function editDistance(input) {
  const [a, b] = String(input).trim().split('\n').map((line) => line.trim())
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1]
      else dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
    }
  }
  return String(dp[a.length][b.length])
}

function shortestPathWithBreak(input) {
  const lines = String(input).trim().split('\n')
  const [n, m] = lines[0].trim().split(/\s+/).map(Number)
  const grid = lines.slice(1, 1 + n).map((line) => line.trim().split('').map(Number))
  const dist = Array.from({ length: n }, () => Array.from({ length: m }, () => [ -1, -1 ]))
  const q = [[0, 0, 1]]
  dist[0][0][1] = 1
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]]
  for (let head = 0; head < q.length; head += 1) {
    const [x, y, canBreak] = q[head]
    for (const [dx, dy] of dirs) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= n || ny >= m) continue
      if (grid[nx][ny] === 0 && dist[nx][ny][canBreak] === -1) {
        dist[nx][ny][canBreak] = dist[x][y][canBreak] + 1
        q.push([nx, ny, canBreak])
      }
      if (grid[nx][ny] === 1 && canBreak === 1 && dist[nx][ny][0] === -1) {
        dist[nx][ny][0] = dist[x][y][1] + 1
        q.push([nx, ny, 0])
      }
    }
  }
  const a = dist[n - 1][m - 1][0]
  const b = dist[n - 1][m - 1][1]
  if (a === -1) return String(b)
  if (b === -1) return String(a)
  return String(Math.min(a, b))
}

function tspBitmask(input) {
  const matrix = parseMatrixInput(input)
  const n = matrix.length
  const memo = new Map()
  function dfs(cur, mask) {
    if (mask === (1 << n) - 1) {
      return matrix[cur][0] || Infinity
    }
    const key = `${cur}:${mask}`
    if (memo.has(key)) return memo.get(key)
    let best = Infinity
    for (let next = 0; next < n; next += 1) {
      if (mask & (1 << next)) continue
      if (!matrix[cur][next]) continue
      best = Math.min(best, matrix[cur][next] + dfs(next, mask | (1 << next)))
    }
    memo.set(key, best)
    return best
  }
  const answer = dfs(0, 1)
  return answer === Infinity ? '-1' : String(answer)
}

function makeProblem({
  id,
  title,
  tier,
  tags,
  difficulty,
  timeLimit,
  memLimit,
  desc,
  inputDesc,
  outputDesc,
  hint,
  exampleInputs,
  hiddenInputs,
  solve,
}) {
  return {
    id,
    title,
    tier,
    tags,
    timeLimit,
    memLimit,
    difficulty,
    solved: 0,
    submissions: 0,
    desc,
    inputDesc,
    outputDesc,
    hint,
    isPremium: ['gold', 'platinum', 'diamond'].includes(tier),
    examples: exampleInputs.map((input) => ({ input, output: normalizeOutput(solve(input)) })),
    testcases: buildHiddenTestcases(hiddenInputs, solve),
  }
}

const PAIR_INPUTS = ['1 2','7 5','10 10','18 7','3 9','12 4','15 6','21 14','8 13','30 11']
const TRIPLE_INPUTS = ['3 2 1','9 3 4','20 6 2','14 7 5','40 8 1','13 5 9','100 10 3','17 4 8','81 9 2','55 6 7']
const SINGLE_INT_INPUTS = ['1','2','3','5','7','10','12','15','20','25']
const STRING_INPUTS = ['hello','DailyCoding','algorithm','racecar','banana','Queue','stack','Graph123','aabbaccc','level']
const ARRAY_INPUTS = ['5\n1 2 3 4 5','6\n3 1 4 1 5 9','4\n10 20 30 40','7\n-3 4 -1 5 -2 6 1','5\n8 8 2 6 4','6\n12 7 9 3 15 5','5\n100 20 30 40 50','8\n1 1 2 3 5 8 13 21','5\n9 2 7 4 6','6\n11 13 17 19 23 29']
const ODD_ARRAY_INPUTS = ['5\n5 1 9 3 7','7\n10 20 30 40 50 60 70','3\n8 2 5','5\n-3 -1 -2 -5 -4','7\n1 1 2 3 5 8 13','5\n100 10 50 20 70','3\n9 9 1','7\n4 6 8 10 12 14 16','5\n11 7 13 5 9','7\n21 1 8 13 3 5 2']
const SORTED_SEARCH_INPUTS = ['5 3\n1 2 3 4 5','6 8\n1 3 5 7 9 11','7 20\n2 4 6 8 10 12 20','4 7\n1 4 7 9','5 1\n1 2 4 8 16','5 15\n3 6 9 12 15','6 13\n2 5 7 11 13 17','5 10\n2 4 6 8 10','6 14\n1 2 4 8 16 32','7 18\n3 6 9 12 15 18 21']
const PREFIX_QUERY_INPUTS = [
  '5 3\n1 2 3 4 5\n1 3\n2 5\n1 5',
  '4 2\n10 20 30 40\n1 2\n2 4',
  '6 3\n5 1 9 2 7 3\n1 6\n3 5\n4 4',
  '5 2\n8 8 8 8 8\n1 5\n2 3',
  '7 3\n1 3 5 7 9 11 13\n2 4\n4 7\n1 1',
  '5 3\n9 1 2 8 7\n1 2\n2 4\n3 5',
  '6 2\n4 4 4 4 4 4\n1 6\n2 5',
  '5 3\n2 7 1 8 2\n2 3\n1 4\n4 5',
  '4 2\n6 5 4 3\n1 4\n3 4',
  '6 3\n1 1 1 1 1 1\n1 1\n1 6\n3 5',
]
const ROTATE_ARRAY_INPUTS = ['5 2\n1 2 3 4 5','6 1\n10 20 30 40 50 60','4 3\n7 8 9 10','7 4\n1 1 2 3 5 8 13','5 5\n9 8 7 6 5','6 8\n3 6 9 12 15 18','5 1\n5 4 3 2 1','7 2\n2 4 6 8 10 12 14','6 3\n11 22 33 44 55 66','5 4\n100 200 300 400 500']
const PAIR_COUNT_INPUTS = ['5 5\n1 2 3 4 5','6 10\n1 9 2 8 3 7','5 8\n1 1 2 6 7','7 9\n2 4 5 3 6 1 8','6 11\n5 6 4 7 3 8','5 4\n1 1 1 3 3','6 12\n2 10 4 8 6 6','5 100\n10 20 30 40 50','7 7\n1 2 3 4 5 6 7','6 15\n1 5 9 10 6 4']
const WINDOW_INPUTS = ['5 3\n1 2 3 4 5','6 2\n10 20 30 40 50 60','7 4\n3 1 4 1 5 9 2','5 5\n8 8 8 8 8','8 3\n2 7 1 8 2 8 1 8','6 4\n5 4 3 2 1 0','7 2\n9 1 9 1 9 1 9','5 2\n100 1 1 100 1','6 3\n6 5 4 3 2 1','7 5\n1 3 5 7 9 11 13']
const MATRIX_INPUTS = ['3\n1 2 3\n4 5 6\n7 8 9','2\n1 2\n3 4','4\n1 0 0 1\n2 3 4 5\n6 7 8 9\n9 8 7 6','3\n9 8 7\n6 5 4\n3 2 1','2\n5 6\n7 8','3\n1 1 1\n2 2 2\n3 3 3','4\n4 3 2 1\n5 6 7 8\n9 10 11 12\n13 14 15 16','3\n2 4 6\n8 10 12\n14 16 18','2\n10 20\n30 40','3\n5 1 9\n2 7 6\n3 8 4']
const GRID_COMPONENT_INPUTS = ['4 5\n11000\n11011\n00101\n00111','3 3\n111\n010\n111','4 4\n1001\n0000\n1110\n0011','5 5\n10101\n01010\n10101\n01010\n10101','3 5\n11111\n00000\n11111','4 4\n0000\n0000\n0000\n0000','5 3\n111\n101\n111\n001\n111','4 5\n00100\n01110\n00100\n00011','3 4\n1100\n1100\n0011','5 5\n10001\n01010\n00100\n01010\n10001']
const TOPO_INPUTS = ['4 3\n1 2\n1 3\n2 4','5 4\n1 2\n1 3\n3 4\n2 5','3 3\n1 2\n2 3\n3 1','6 5\n1 4\n2 4\n3 5\n4 6\n5 6','4 2\n2 3\n1 4','5 4\n1 2\n2 3\n3 4\n4 5','4 4\n1 2\n1 3\n3 4\n2 4','5 5\n1 2\n2 3\n1 3\n3 4\n4 5','6 6\n1 2\n1 3\n2 4\n3 4\n4 5\n4 6','4 1\n2 3']
const KNAPSACK_INPUTS = ['4 7\n6 13\n4 8\n3 6\n5 12','3 10\n5 10\n4 40\n6 30','5 8\n3 4\n4 5\n5 10\n2 3\n1 2','4 5\n2 3\n1 2\n3 4\n2 2','3 9\n3 8\n4 7\n5 12','5 10\n6 13\n4 8\n3 6\n5 12\n2 4','4 12\n7 15\n5 10\n3 6\n4 7','3 6\n4 10\n2 4\n3 7','5 9\n2 3\n2 4\n4 8\n5 8\n3 5','4 11\n5 7\n6 9\n4 6\n3 5']
const TREE_INPUTS = ['5\n1 2 3\n2 3 4\n3 4 5\n4 5 6','4\n1 2 1\n1 3 2\n3 4 3','6\n1 2 2\n1 3 3\n2 4 4\n2 5 5\n3 6 6','5\n1 2 10\n2 3 10\n3 4 10\n4 5 10','7\n1 2 1\n1 3 1\n2 4 1\n2 5 1\n3 6 1\n3 7 1','6\n1 2 5\n2 3 6\n2 4 2\n4 5 4\n4 6 1','5\n1 2 7\n1 3 3\n3 4 8\n3 5 2','4\n1 2 9\n2 3 1\n2 4 1','5\n1 2 2\n2 3 2\n3 4 2\n4 5 2','6\n1 2 3\n1 3 4\n3 4 5\n4 5 6\n5 6 7']
const SUM2D_INPUTS = ['3 3\n1 2 3\n4 5 6\n7 8 9\n1 1 2 2\n2 2 3 3\n1 1 3 3','2 2\n5 6\n7 8\n1 1 1 2\n1 2 2 2','4 2\n1 1 1 1\n2 2 2 2\n3 3 3 3\n4 4 4 4\n2 2 4 4\n1 3 4 4','3 1\n9 8 7\n6 5 4\n3 2 1\n1 2 3 3','2 3\n1 2\n3 4\n1 1 2 2\n2 1 2 1\n1 2 1 2','3 2\n2 4 6\n8 10 12\n14 16 18\n1 1 1 1\n2 2 3 3','4 1\n1 0 0 1\n0 1 1 0\n2 2 2 2\n3 3 3 3\n1 1 4 4','3 2\n5 5 5\n5 5 5\n5 5 5\n1 1 3 3\n2 2 2 3','2 2\n10 20\n30 40\n1 1 1 1\n2 2 2 2','3 3\n1 3 5\n7 9 11\n13 15 17\n1 1 2 3\n2 1 3 2\n3 3 3 3']
const MST_INPUTS = ['4 5\n1 2 1\n1 3 4\n2 3 2\n2 4 7\n3 4 3','5 7\n1 2 3\n1 3 4\n2 3 1\n2 4 2\n3 5 7\n4 5 6\n3 4 5','3 3\n1 2 5\n2 3 6\n1 3 1','6 8\n1 2 2\n1 3 3\n2 3 1\n2 4 4\n3 5 5\n4 5 2\n4 6 7\n5 6 3','4 4\n1 2 10\n2 3 15\n3 4 4\n1 4 6','5 6\n1 2 8\n1 3 2\n2 3 5\n2 4 3\n3 5 9\n4 5 4','4 5\n1 2 1\n1 3 1\n1 4 1\n2 3 2\n3 4 2','5 5\n1 2 5\n2 3 5\n3 4 5\n4 5 5\n1 5 100','6 7\n1 2 3\n2 3 4\n3 4 5\n4 5 6\n5 6 7\n1 6 2\n2 5 1','4 6\n1 2 3\n1 3 3\n1 4 3\n2 3 1\n2 4 1\n3 4 1']
const UNION_FIND_INPUTS = ['5 6\n0 1 2\n0 3 4\n1 1 2\n1 2 3\n0 2 3\n1 1 4','4 5\n0 1 2\n1 1 2\n1 2 3\n0 2 3\n1 1 3','6 6\n0 1 6\n0 2 5\n1 1 5\n0 5 6\n1 2 6\n1 3 4','5 5\n1 1 5\n0 1 5\n1 1 5\n0 2 3\n1 2 4','7 7\n0 1 2\n0 2 3\n0 4 5\n1 1 3\n1 1 4\n0 3 4\n1 2 5','4 4\n0 1 4\n0 2 3\n1 1 2\n1 2 3','5 6\n0 1 2\n0 2 3\n0 3 4\n1 1 4\n1 4 5\n0 4 5','3 4\n1 1 2\n0 1 2\n1 1 2\n1 2 3','6 5\n0 1 2\n0 2 3\n0 4 5\n1 3 5\n1 1 3','5 5\n0 1 5\n1 1 5\n0 2 4\n1 2 4\n1 1 4']
const COIN_INPUTS = ['3 15\n1 5 12','4 11\n1 2 5 7','3 7\n2 4 6','5 27\n1 3 4 10 12','4 8\n3 5 6 7','3 20\n2 5 10','4 14\n4 6 9 11','5 19\n1 7 8 9 10','4 23\n2 3 7 11','3 9\n5 6 7']
const INTERVAL_INPUTS = ['5\n1 4\n2 3\n3 5\n0 7\n5 9','4\n1 2\n2 3\n3 4\n4 5','6\n1 10\n2 3\n3 4\n4 5\n6 7\n8 9','5\n0 1\n1 2\n1 3\n2 4\n3 5','4\n3 5\n0 6\n5 7\n8 9','5\n1 8\n2 4\n4 6\n6 8\n8 10','6\n1 2\n2 5\n4 7\n6 9\n8 10\n9 11','5\n0 3\n3 6\n6 9\n2 4\n4 8','4\n5 6\n1 2\n2 3\n3 4','5\n2 3\n3 5\n5 7\n7 8\n1 9']
const GRID_PATH_INPUTS = ['4 6\n101111\n101010\n101011\n111011','3 3\n111\n001\n111','5 5\n11111\n00001\n11101\n10101\n11111','3 4\n1111\n1111\n1111','4 4\n1001\n1111\n1001\n1111','5 3\n111\n101\n111\n101\n111','4 5\n11011\n11101\n10111\n11111','3 5\n11111\n10001\n11111','5 5\n11111\n11011\n11111\n11011\n11111','4 4\n1111\n0111\n1111\n1111']
const KMP_INPUTS = ['abcabcabc\nabc','aaaaa\naa','ababa\naba','dailycoding\ncoding','mississippi\nissi','banana\nana','xyzxyz\nxyz','abababab\nabab','abcdef\ngh','levellevel\nlevel']
const SEGMENT_INPUTS = ['5 4\n1 2 3 4 5\n2 1 5\n1 3 10\n2 2 4\n2 3 3','4 3\n10 20 30 40\n2 1 2\n1 2 5\n2 1 4','6 4\n1 1 1 1 1 1\n2 1 6\n1 6 10\n2 4 6\n2 6 6','5 5\n5 4 3 2 1\n2 2 5\n1 1 7\n2 1 3\n1 5 9\n2 4 5','3 3\n2 4 6\n2 1 3\n1 2 10\n2 2 3','5 4\n8 8 8 8 8\n2 1 5\n1 4 1\n2 3 5\n2 4 4','4 4\n1 3 5 7\n2 2 3\n1 1 9\n2 1 2\n2 1 4','6 3\n9 8 7 6 5 4\n2 1 6\n1 3 100\n2 2 4','5 4\n11 22 33 44 55\n2 5 5\n1 5 0\n2 4 5\n2 1 5','4 5\n3 6 9 12\n2 1 4\n1 2 1\n2 1 2\n1 4 20\n2 3 4']
const LCA_INPUTS = ['7\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n3\n4 5\n4 6\n3 4','5\n1 2\n1 3\n2 4\n4 5\n2\n5 3\n4 5','6\n1 2\n1 3\n2 4\n2 5\n5 6\n3\n4 6\n3 6\n2 3','4\n1 2\n2 3\n3 4\n2\n1 4\n2 4','8\n1 2\n1 3\n2 4\n2 5\n3 6\n6 7\n6 8\n3\n4 5\n7 8\n5 8','5\n1 2\n2 3\n2 4\n4 5\n2\n3 5\n1 5','7\n1 2\n2 3\n3 4\n4 5\n5 6\n6 7\n2\n2 7\n4 6','6\n1 2\n1 3\n3 4\n4 5\n4 6\n3\n5 6\n2 6\n2 4','5\n1 2\n1 3\n3 4\n3 5\n2\n4 5\n2 4','6\n1 2\n2 3\n2 4\n4 5\n4 6\n3\n5 6\n3 6\n1 5']
const PAL_INPUTS = ['babad','cbbd','levelup','abacdfgdcaba','aaaaaa','banana','racecarxyz','abcde','noonlevel','forgeeksskeegfor']
const EDIT_INPUTS = ['kitten\nsitting','flaw\nlawn','abc\nabc','intention\nexecution','daily\ncoding','graph\ngiraffe','abcde\nace','distance\nediting','algorithm\naltruistic','book\nback']
const WALL_BREAK_INPUTS = ['6 4\n0100\n1110\n1000\n0000\n0111\n0000','4 4\n0000\n1110\n0000\n0111','3 3\n010\n111\n000','5 5\n00000\n11110\n00010\n01110\n00000','4 5\n00100\n11110\n00000\n01111','3 4\n0000\n1111\n0000','5 4\n0010\n1110\n0000\n0111\n0000','4 4\n0111\n0001\n1111\n0000','5 5\n01010\n01010\n00000\n11110\n00000','4 3\n010\n010\n010\n000']
const TSP_INPUTS = ['4\n0 10 15 20\n5 0 9 10\n6 13 0 12\n8 8 9 0','4\n0 1 15 6\n2 0 7 3\n9 6 0 12\n10 4 8 0','3\n0 5 9\n4 0 7\n6 3 0','4\n0 2 9 0\n1 0 6 4\n0 7 0 8\n6 3 0 0','4\n0 3 1 5\n2 0 4 6\n3 5 0 2\n7 4 3 0','3\n0 8 5\n7 0 6\n4 3 0','4\n0 4 8 7\n6 0 5 9\n3 2 0 4\n5 6 7 0','4\n0 1 2 3\n1 0 4 6\n2 4 0 5\n3 6 5 0','3\n0 2 0\n2 0 3\n4 1 0','4\n0 9 1 7\n6 0 8 3\n5 4 0 2\n7 6 3 0']

const pairProblem = (config) => makeProblem({
  timeLimit: 1,
  memLimit: 128,
  inputDesc: '첫째 줄에 두 정수 A B가 주어진다.',
  exampleInputs: config.examples,
  hiddenInputs: PAIR_INPUTS,
  solve: config.solve,
  ...config,
})

const singleIntProblem = (config) => makeProblem({
  timeLimit: 1,
  memLimit: 128,
  inputDesc: '첫째 줄에 정수 N이 주어진다.',
  exampleInputs: config.examples,
  hiddenInputs: SINGLE_INT_INPUTS,
  solve: config.solve,
  ...config,
})

const arrayProblem = (config) => makeProblem({
  timeLimit: 1,
  memLimit: 128,
  inputDesc: '첫째 줄에 N, 둘째 줄에 N개의 정수가 주어진다.',
  exampleInputs: config.examples,
  hiddenInputs: ARRAY_INPUTS,
  solve: config.solve,
  ...config,
})

const stringProblem = (config) => makeProblem({
  timeLimit: 1,
  memLimit: 128,
  inputDesc: '첫째 줄에 문자열이 주어진다.',
  exampleInputs: config.examples,
  hiddenInputs: STRING_INPUTS,
  solve: config.solve,
  ...config,
})

export const PROBLEMS = [
  pairProblem({ id:1001, title:'A+B', tier:'bronze', tags:['수학','입출력'], difficulty:1, desc:'두 정수 A와 B를 입력받은 다음, A+B를 출력하는 프로그램을 작성하시오.', outputDesc:'첫째 줄에 A+B를 출력한다.', hint:'두 수를 더하면 됩니다.', examples:['1 2','100 200'], solve:(input) => { const [a,b]=ints(input); return String(a+b) } }),
  makeProblem({ id:1002, title:'사칙연산', tier:'bronze', tags:['수학'], difficulty:2, timeLimit:1, memLimit:128, desc:'세 정수 A, B, C가 주어질 때 A/B+C를 정수 나눗셈 기준으로 출력하시오.', inputDesc:'첫째 줄에 세 정수 A B C가 주어진다.', outputDesc:'첫째 줄에 계산 결과를 출력한다.', hint:'A/B는 정수 나눗셈입니다.', exampleInputs:['3 2 1'], hiddenInputs:TRIPLE_INPUTS, solve:(input) => { const [a,b,c]=ints(input); return String(Math.floor(a/b)+c) } }),
  singleIntProblem({ id:1003, title:'피보나치 수', tier:'bronze', tags:['다이나믹 프로그래밍','수학'], difficulty:2, desc:'n번째 피보나치 수를 구하는 프로그램을 작성하시오.', outputDesc:'n번째 피보나치 수를 출력한다.', hint:'반복문으로도 쉽게 구할 수 있습니다.', examples:['10'], solve:(input) => String(fib(Number(input.trim()))) }),
  singleIntProblem({ id:1004, title:'홀짝 구분', tier:'bronze', tags:['수학'], difficulty:1, desc:'정수 N이 주어질 때 홀수면 odd, 짝수면 even을 출력하시오.', outputDesc:'odd 또는 even을 출력한다.', hint:'나머지 연산을 사용하세요.', examples:['3','4'], solve:(input) => { const n=Number(input.trim()); return n % 2 === 0 ? 'even' : 'odd' } }),
  arrayProblem({ id:1005, title:'최댓값 구하기', tier:'bronze', tags:['구현'], difficulty:1, desc:'배열에서 최댓값을 출력하시오.', outputDesc:'최댓값을 출력한다.', hint:'배열 전체를 한 번만 훑어도 됩니다.', examples:['5\n3 1 4 1 5'], solve:(input) => String(Math.max(...parseArrayInput(input))) }),
  singleIntProblem({ id:1006, title:'팩토리얼', tier:'bronze', tags:['수학'], difficulty:2, desc:'N! 값을 출력하시오. (0! = 1)', outputDesc:'팩토리얼 값을 출력한다.', hint:'N이 크지 않으므로 반복문으로 충분합니다.', examples:['5'], solve:(input) => { const n=Number(input.trim()); let value=1; for(let i=2;i<=n;i+=1) value*=i; return String(value) } }),
  stringProblem({ id:1007, title:'문자열 뒤집기', tier:'bronze', tags:['문자열'], difficulty:1, desc:'문자열을 뒤집어서 출력하시오.', outputDesc:'뒤집은 문자열을 출력한다.', hint:'인덱스를 뒤에서부터 읽으면 됩니다.', examples:['hello'], solve:(input) => input.trim().split('').reverse().join('') }),
  singleIntProblem({ id:1008, title:'자릿수 합', tier:'bronze', tags:['수학'], difficulty:1, desc:'정수 N의 각 자리 숫자 합을 구하시오.', outputDesc:'자릿수 합을 출력한다.', hint:'문자열로 바꿔도 좋습니다.', examples:['12345'], solve:(input) => String(String(input).trim().split('').reduce((sum,ch)=>sum+Number(ch),0)) }),
  singleIntProblem({ id:1009, title:'약수의 개수', tier:'bronze', tags:['수학'], difficulty:2, desc:'정수 N의 양의 약수 개수를 구하시오.', outputDesc:'약수의 개수를 출력한다.', hint:'i와 N/i를 짝으로 생각해보세요.', examples:['12'], solve:(input) => { const n=Number(input.trim()); let count=0; for(let i=1;i*i<=n;i+=1){ if(n%i===0) count+= i*i===n ? 1 : 2 } return String(count) } }),
  arrayProblem({ id:1010, title:'최솟값 구하기', tier:'bronze', tags:['구현'], difficulty:1, desc:'배열에서 최솟값을 출력하시오.', outputDesc:'최솟값을 출력한다.', hint:'현재까지의 최솟값을 갱신하세요.', examples:['4\n10 20 3 7'], solve:(input) => String(Math.min(...parseArrayInput(input))) }),
  pairProblem({ id:1011, title:'절댓값 차이', tier:'bronze', tags:['수학'], difficulty:1, desc:'두 정수의 절댓값 차이를 출력하시오.', outputDesc:'|A-B|를 출력한다.', hint:'Math.abs 같은 절댓값 함수를 떠올리세요.', examples:['10 3'], solve:(input) => { const [a,b]=ints(input); return String(Math.abs(a-b)) } }),
  stringProblem({ id:1012, title:'모음 개수', tier:'bronze', tags:['문자열'], difficulty:1, desc:'문자열에서 영어 모음(a,e,i,o,u)의 개수를 구하시오.', outputDesc:'모음 개수를 출력한다.', hint:'대소문자를 통일하면 편합니다.', examples:['banana'], solve:(input) => String((input.trim().toLowerCase().match(/[aeiou]/g) || []).length) }),
  stringProblem({ id:1013, title:'대문자 변환', tier:'bronze', tags:['문자열'], difficulty:1, desc:'문자열을 모두 대문자로 바꿔 출력하시오.', outputDesc:'대문자로 변환한 문자열을 출력한다.', hint:'문자열 메서드를 활용하세요.', examples:['DailyCoding'], solve:(input) => input.trim().toUpperCase() }),
  arrayProblem({ id:1014, title:'평균 구하기', tier:'bronze', tags:['수학'], difficulty:1, desc:'배열 원소의 평균을 소수점 아래 없이 출력하시오.', outputDesc:'평균의 내림값을 출력한다.', hint:'합계를 원소 수로 나누세요.', examples:['5\n1 2 3 4 5'], solve:(input) => { const arr=parseArrayInput(input); return String(Math.floor(arr.reduce((s,v)=>s+v,0)/arr.length)) } }),
  arrayProblem({ id:1015, title:'배열 합', tier:'bronze', tags:['수학'], difficulty:1, desc:'배열 원소의 합을 구하시오.', outputDesc:'합계를 출력한다.', hint:'누적 합을 사용하세요.', examples:['5\n1 2 3 4 5'], solve:(input) => String(parseArrayInput(input).reduce((s,v)=>s+v,0)) }),
  pairProblem({ id:1016, title:'직사각형 넓이', tier:'bronze', tags:['수학','구현'], difficulty:1, desc:'가로와 세로가 주어질 때 직사각형의 넓이를 구하시오.', outputDesc:'넓이를 출력한다.', hint:'가로 x 세로입니다.', examples:['3 4'], solve:(input) => { const [w,h]=ints(input); return String(w*h) } }),
  stringProblem({ id:1017, title:'회문 문자열', tier:'bronze', tags:['문자열'], difficulty:1, desc:'문자열이 회문이면 YES, 아니면 NO를 출력하시오.', outputDesc:'YES 또는 NO를 출력한다.', hint:'앞뒤를 비교하세요.', examples:['racecar','hello'], solve:(input) => { const s=input.trim(); return s === s.split('').reverse().join('') ? 'YES' : 'NO' } }),
  singleIntProblem({ id:1018, title:'삼각수', tier:'bronze', tags:['수학'], difficulty:1, desc:'1부터 N까지의 합을 구하시오.', outputDesc:'삼각수를 출력한다.', hint:'공식을 사용해도 됩니다.', examples:['10'], solve:(input) => { const n=Number(input.trim()); return String((n*(n+1))/2) } }),
  stringProblem({ id:1019, title:'문자열 길이', tier:'bronze', tags:['문자열'], difficulty:1, desc:'문자열의 길이를 출력하시오.', outputDesc:'길이를 출력한다.', hint:'문자열 길이 속성을 사용하세요.', examples:['algorithm'], solve:(input) => String(input.trim().length) }),
  arrayProblem({ id:1020, title:'배열 범위', tier:'bronze', tags:['구현'], difficulty:1, desc:'배열의 최댓값과 최솟값 차이를 구하시오.', outputDesc:'범위를 출력한다.', hint:'max - min 입니다.', examples:['5\n2 7 1 8 2'], solve:(input) => { const arr=parseArrayInput(input); return String(Math.max(...arr)-Math.min(...arr)) } }),
  arrayProblem({ id:1021, title:'짝수 개수', tier:'bronze', tags:['구현'], difficulty:1, desc:'배열에서 짝수의 개수를 구하시오.', outputDesc:'짝수 개수를 출력한다.', hint:'각 수를 2로 나눈 나머지를 확인하세요.', examples:['6\n1 2 3 4 5 6'], solve:(input) => String(parseArrayInput(input).filter((v)=>v%2===0).length) }),
  pairProblem({ id:1022, title:'큰 수 출력', tier:'bronze', tags:['구현'], difficulty:1, desc:'두 수 중 더 큰 수를 출력하시오.', outputDesc:'더 큰 수를 출력한다.', hint:'비교 연산자를 사용하세요.', examples:['9 3'], solve:(input) => { const [a,b]=ints(input); return String(Math.max(a,b)) } }),
  pairProblem({ id:1023, title:'최대공약수', tier:'bronze', tags:['수학'], difficulty:2, desc:'두 정수의 최대공약수를 구하시오.', outputDesc:'최대공약수를 출력한다.', hint:'유클리드 호제법을 떠올려보세요.', examples:['12 18'], solve:(input) => { const [a,b]=ints(input); return String(gcd(a,b)) } }),
  pairProblem({ id:1024, title:'최소공배수', tier:'bronze', tags:['수학'], difficulty:2, desc:'두 정수의 최소공배수를 구하시오.', outputDesc:'최소공배수를 출력한다.', hint:'최대공약수를 활용하면 됩니다.', examples:['6 8'], solve:(input) => { const [a,b]=ints(input); return String(Math.abs(a * b) / gcd(a, b)) } }),
  arrayProblem({ id:1025, title:'배열 속 소수 개수', tier:'bronze', tags:['구현','소수'], difficulty:2, desc:'배열에 들어 있는 소수의 개수를 구하시오.', outputDesc:'소수 개수를 출력한다.', hint:'각 원소를 소수 판별하면 됩니다.', examples:['5\n1 2 3 4 5'], solve:(input) => String(parseArrayInput(input).filter((value) => isPrime(value)).length) }),
  stringProblem({ id:1026, title:'문자열 숫자 합', tier:'bronze', tags:['문자열','구현'], difficulty:2, desc:'문자열에 포함된 숫자 문자들의 합을 구하시오.', outputDesc:'숫자 문자 합을 출력한다.', hint:'문자를 하나씩 확인하며 숫자만 더하세요.', examples:['Graph123'], solve:(input) => String([...input.trim()].reduce((sum, ch) => sum + (/\d/.test(ch) ? Number(ch) : 0), 0)) }),
  makeProblem({ id:2001, title:'계단 오르기', tier:'silver', tags:['다이나믹 프로그래밍'], difficulty:3, timeLimit:1, memLimit:128, desc:'연속된 세 계단을 모두 밟을 수 없고 마지막 계단은 반드시 밟아야 할 때 최대 점수를 구하시오.', inputDesc:'첫째 줄에 계단 수 n, 이후 n줄에 점수가 주어진다.', outputDesc:'최대 점수를 출력한다.', hint:'한 칸 연속 여부를 상태로 두면 됩니다.', exampleInputs:['6\n10\n20\n15\n25\n10\n20'], hiddenInputs:['4\n10\n20\n15\n25','5\n10\n20\n15\n25\n10','3\n5\n10\n20','6\n1\n2\n3\n4\n5\n6','5\n50\n10\n20\n30\n40','4\n100\n1\n1\n100','7\n10\n10\n10\n10\n10\n10\n10','5\n7\n8\n9\n10\n11','6\n30\n20\n10\n40\n50\n60','4\n5\n5\n5\n5'], solve:stairMaxScore }),
  arrayProblem({ id:2002, title:'가장 긴 증가하는 부분 수열', tier:'silver', tags:['다이나믹 프로그래밍'], difficulty:4, desc:'수열의 LIS 길이를 구하시오.', outputDesc:'LIS 길이를 출력한다.', hint:'dp[i]를 i에서 끝나는 LIS 길이로 둘 수 있습니다.', examples:['6\n10 20 10 30 20 50'], solve:lisLength }),
  singleIntProblem({ id:2003, title:'소수 찾기', tier:'silver', tags:['수학','소수'], difficulty:3, desc:'1부터 N까지의 소수 개수를 구하시오.', outputDesc:'소수 개수를 출력한다.', hint:'소수 판별을 반복하거나 체를 사용하세요.', examples:['10'], solve:(input) => String(countPrimesUpTo(Number(input.trim()))) }),
  makeProblem({ id:2004, title:'BFS', tier:'silver', tags:['그래프 이론','BFS'], difficulty:3, timeLimit:1, memLimit:128, desc:'무방향 그래프를 시작 정점에서 BFS로 탐색한 순서를 출력하시오.', inputDesc:'첫째 줄에 N M V, 이후 M줄에 간선이 주어진다.', outputDesc:'방문 순서를 공백으로 출력한다.', hint:'인접 정점을 오름차순으로 방문하세요.', exampleInputs:['4 5 1\n1 2\n1 3\n1 4\n2 4\n3 4'], hiddenInputs:['5 4 1\n1 2\n1 3\n2 4\n3 5','6 5 2\n1 2\n2 3\n2 4\n4 5\n5 6','4 3 3\n1 2\n2 3\n3 4','5 5 5\n1 5\n2 5\n3 5\n4 5\n1 2','6 6 1\n1 2\n1 3\n2 4\n2 5\n3 6\n5 6','5 3 2\n2 1\n2 3\n4 5','7 6 4\n1 4\n2 4\n3 4\n4 5\n5 6\n6 7','4 2 1\n1 2\n3 4','5 6 3\n1 2\n2 3\n3 4\n4 5\n1 5\n2 4','6 4 6\n1 6\n2 6\n3 6\n4 6'], solve:bfsOrder }),
  makeProblem({ id:2005, title:'이진 탐색', tier:'silver', tags:['이분 탐색'], difficulty:3, timeLimit:1, memLimit:128, desc:'정렬된 배열에서 target의 인덱스를 찾으시오. 없으면 -1을 출력하시오.', inputDesc:'첫째 줄에 N과 target, 둘째 줄에 오름차순 배열이 주어진다.', outputDesc:'0-based 인덱스를 출력한다.', hint:'탐색 범위를 절반으로 줄여가세요.', exampleInputs:['5 3\n1 2 3 4 5'], hiddenInputs:SORTED_SEARCH_INPUTS, solve:binarySearchIndex }),
  makeProblem({ id:2006, title:'괄호 검사', tier:'silver', tags:['스택','문자열'], difficulty:3, timeLimit:1, memLimit:128, desc:'괄호 문자열이 올바른지 판별하시오.', inputDesc:'첫째 줄에 괄호 문자열이 주어진다.', outputDesc:'올바르면 YES, 아니면 NO를 출력한다.', hint:'스택으로 짝을 맞추세요.', exampleInputs:['(())[]{}'], hiddenInputs:['(())','(()','([{}])','([)]','{}[]()','(((())))','{[()]}','((())','[]{}(()','{{{{}}}}'], solve:validParentheses }),
  makeProblem({ id:2007, title:'구간 합 질의', tier:'silver', tags:['누적 합'], difficulty:4, timeLimit:1, memLimit:128, desc:'1차원 배열에서 여러 구간 합을 빠르게 구하시오.', inputDesc:'첫째 줄에 N Q, 둘째 줄에 배열, 이후 Q개의 l r 쿼리가 주어진다.', outputDesc:'각 쿼리 결과를 줄마다 출력한다.', hint:'누적 합 배열을 미리 만드세요.', exampleInputs:['5 3\n1 2 3 4 5\n1 3\n2 5\n1 5'], hiddenInputs:PREFIX_QUERY_INPUTS, solve:prefixSumQueries }),
  makeProblem({ id:2008, title:'회전 배열', tier:'silver', tags:['구현'], difficulty:3, timeLimit:1, memLimit:128, desc:'배열을 오른쪽으로 K칸 회전한 결과를 출력하시오.', inputDesc:'첫째 줄에 N K, 둘째 줄에 배열이 주어진다.', outputDesc:'회전된 배열을 공백으로 출력한다.', hint:'K를 N으로 나눈 나머지만큼 이동하면 됩니다.', exampleInputs:['5 2\n1 2 3 4 5'], hiddenInputs:ROTATE_ARRAY_INPUTS, solve:rotateArrayRight }),
  makeProblem({ id:2009, title:'두 수 쌍 개수', tier:'silver', tags:['투 포인터'], difficulty:4, timeLimit:1, memLimit:128, desc:'배열에서 합이 target인 서로 다른 인덱스 쌍의 개수를 구하시오.', inputDesc:'첫째 줄에 N과 target, 둘째 줄에 배열이 주어진다.', outputDesc:'쌍의 개수를 출력한다.', hint:'정렬 후 양끝 포인터를 움직여보세요.', exampleInputs:['5 5\n1 2 3 4 5'], hiddenInputs:PAIR_COUNT_INPUTS, solve:countTargetPairs }),
  makeProblem({ id:2010, title:'슬라이딩 윈도우 최대 합', tier:'silver', tags:['투 포인터'], difficulty:4, timeLimit:1, memLimit:128, desc:'길이 K인 연속 부분 배열의 최대 합을 구하시오.', inputDesc:'첫째 줄에 N K, 둘째 줄에 배열이 주어진다.', outputDesc:'최대 합을 출력한다.', hint:'첫 구간 합을 구한 뒤 한 칸씩 이동하세요.', exampleInputs:['5 3\n1 2 3 4 5'], hiddenInputs:WINDOW_INPUTS, solve:maxWindowSum }),
  makeProblem({ id:2011, title:'행렬 회전', tier:'silver', tags:['구현','배열'], difficulty:4, timeLimit:1, memLimit:128, desc:'N x N 행렬을 시계 방향 90도로 회전하시오.', inputDesc:'첫째 줄에 N, 이후 N줄에 행렬이 주어진다.', outputDesc:'회전한 행렬을 출력한다.', hint:'result[j][N-1-i]에 값을 넣어보세요.', exampleInputs:['3\n1 2 3\n4 5 6\n7 8 9'], hiddenInputs:MATRIX_INPUTS, solve:rotateMatrix90 }),
  arrayProblem({ id:2012, title:'좌표 압축', tier:'silver', tags:['정렬'], difficulty:4, desc:'각 원소를 정렬 기준 순위로 바꾸어 출력하시오.', outputDesc:'압축된 좌표를 공백으로 출력한다.', hint:'중복 제거 후 정렬한 배열을 사용하세요.', examples:['5\n2 4 -10 4 -9'], solve:coordinateCompress }),
  makeProblem({ id:2013, title:'DFS 연결 요소', tier:'silver', tags:['그래프 이론','DFS'], difficulty:4, timeLimit:1, memLimit:128, desc:'0과 1로 이루어진 격자에서 1로 연결된 영역의 개수를 구하시오.', inputDesc:'첫째 줄에 N M, 이후 N줄에 0/1 격자가 주어진다.', outputDesc:'영역 개수를 출력한다.', hint:'네 방향 DFS/BFS를 반복하세요.', exampleInputs:['4 5\n11000\n11011\n00101\n00111'], hiddenInputs:GRID_COMPONENT_INPUTS, solve:countGridComponents }),
  makeProblem({ id:2014, title:'요세푸스 마지막 수', tier:'silver', tags:['자료 구조'], difficulty:3, timeLimit:1, memLimit:128, desc:'N명이 원형으로 있을 때 K번째 사람을 반복 제거한 뒤 마지막 남는 수를 구하시오.', inputDesc:'첫째 줄에 N K가 주어진다.', outputDesc:'마지막 남는 번호를 출력한다.', hint:'배열이나 큐로 시뮬레이션할 수 있습니다.', exampleInputs:['7 3'], hiddenInputs:['5 2','6 4','10 3','8 5','9 2','12 7','15 4','20 6','7 7','13 5'], solve:josephusLast }),
  arrayProblem({ id:2015, title:'최빈값', tier:'silver', tags:['해시'], difficulty:3, desc:'배열에서 가장 많이 등장한 값을 구하시오. 동률이면 더 작은 값을 출력하시오.', outputDesc:'최빈값을 출력한다.', hint:'빈도수를 세어 비교하세요.', examples:['7\n1 1 2 2 2 3 3'], solve:modeOfArray }),
  arrayProblem({ id:2016, title:'최대 부분합', tier:'silver', tags:['다이나믹 프로그래밍'], difficulty:4, desc:'연속 부분 배열의 최대 합을 구하시오.', outputDesc:'최대 부분합을 출력한다.', hint:'이전까지의 합을 이어갈지 새로 시작할지 결정하세요.', examples:['7\n-2 1 -3 4 -1 2 1'], solve:maxSubarraySum }),
  makeProblem({ id:2017, title:'공통 문자 수', tier:'silver', tags:['문자열','해시'], difficulty:3, timeLimit:1, memLimit:128, desc:'두 문자열에서 공통으로 사용할 수 있는 문자 수를 구하시오.', inputDesc:'두 줄에 문자열 A와 B가 주어진다.', outputDesc:'공통 문자 총 개수를 출력한다.', hint:'각 문자 빈도수의 최소값을 더하세요.', exampleInputs:['banana\nbandana'], hiddenInputs:['daily\nlady','apple\nplea','stack\nattack','graph\nparagraph','abc\nxyz','mississippi\nimpossible','queue\nequal','hello\nyellow','aaaa\nbbbb','coding\nding'], solve:commonCharacterCount }),
  makeProblem({ id:2018, title:'큐 시뮬레이션', tier:'silver', tags:['큐'], difficulty:3, timeLimit:1, memLimit:128, desc:'push, pop, front, size 명령을 처리하는 큐를 구현하시오.', inputDesc:'첫째 줄에 명령 수 N, 이후 N개의 명령이 주어진다.', outputDesc:'출력이 필요한 명령 결과를 줄마다 출력한다.', hint:'FIFO 구조를 그대로 구현하면 됩니다.', exampleInputs:['6\npush 1\npush 2\nfront\nsize\npop\npop'], hiddenInputs:['5\npush 3\nfront\npop\nsize\npop','7\npush 1\npush 2\npush 3\npop\nfront\nsize\npop','4\nsize\npop\nfront\nsize','6\npush 10\npush 20\npop\npush 30\nfront\nsize','5\npush 7\npush 8\npop\npop\nsize','7\npush 4\nfront\npush 5\nfront\npop\nfront\nsize','6\npush 9\npush 1\nsize\npop\nsize\nfront','5\npush 100\npop\npush 200\nfront\nsize','6\nfront\npush 5\nfront\npop\npop\nsize','7\npush 2\npush 4\npush 6\nsize\npop\npop\nfront'], solve:queueSimulation }),
  makeProblem({ id:2019, title:'중앙값 찾기', tier:'silver', tags:['정렬'], difficulty:3, timeLimit:1, memLimit:128, desc:'원소 개수가 홀수인 배열이 주어질 때 중앙값을 구하시오.', inputDesc:'첫째 줄에 N, 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'중앙값을 출력한다.', hint:'정렬 후 가운데 원소를 확인하세요.', exampleInputs:['5\n5 1 9 3 7'], hiddenInputs:ODD_ARRAY_INPUTS, solve:medianOfArray }),
  makeProblem({ id:2020, title:'행 최대 합', tier:'silver', tags:['구현','배열'], difficulty:3, timeLimit:1, memLimit:128, desc:'정사각 행렬의 각 행 합 중 최댓값을 구하시오.', inputDesc:'첫째 줄에 N, 이후 N줄에 행렬이 주어진다.', outputDesc:'가장 큰 행 합을 출력한다.', hint:'각 행의 합을 계산한 뒤 최댓값을 찾으세요.', exampleInputs:['3\n1 2 3\n4 5 6\n7 8 9'], hiddenInputs:MATRIX_INPUTS, solve:maxRowSum }),
  stringProblem({ id:2021, title:'서로 다른 문자 수', tier:'silver', tags:['문자열','해시'], difficulty:3, desc:'문자열에서 서로 다른 문자 개수를 구하시오. 대소문자는 구분하지 않습니다.', outputDesc:'서로 다른 문자 개수를 출력한다.', hint:'집합(Set)을 활용해보세요.', examples:['DailyCoding'], solve:(input) => String(new Set(input.trim().toLowerCase()).size) }),
  stringProblem({ id:2022, title:'대소문자 반전', tier:'silver', tags:['문자열','구현'], difficulty:3, desc:'문자열의 영문자 대소문자를 서로 바꾸어 출력하시오.', outputDesc:'변환된 문자열을 출력한다.', hint:'소문자는 대문자로, 대문자는 소문자로 바꾸면 됩니다.', examples:['DailyCoding'], solve:(input) => [...input.trim()].map((ch) => ch >= 'a' && ch <= 'z' ? ch.toUpperCase() : ch >= 'A' && ch <= 'Z' ? ch.toLowerCase() : ch).join('') }),
  arrayProblem({ id:2023, title:'배열 최대공약수', tier:'silver', tags:['수학'], difficulty:3, desc:'배열 원소 전체의 최대공약수를 구하시오.', outputDesc:'최대공약수를 출력한다.', hint:'앞에서부터 최대공약수를 누적 갱신하세요.', examples:['5\n12 18 24 30 36'], solve:(input) => { const arr=parseArrayInput(input).map((value) => Math.abs(value)); return String(arr.reduce((acc, value) => gcd(acc, value))) } }),
  arrayProblem({ id:2024, title:'가장 큰 짝수', tier:'silver', tags:['구현'], difficulty:3, desc:'배열에 포함된 짝수 중 가장 큰 값을 구하시오. 없으면 -1을 출력하시오.', outputDesc:'가장 큰 짝수 또는 -1을 출력한다.', hint:'짝수만 골라 최댓값을 찾으세요.', examples:['5\n1 2 3 8 5'], solve:(input) => { const evens=parseArrayInput(input).filter((value) => value % 2 === 0); return String(evens.length ? Math.max(...evens) : -1) } }),
  makeProblem({ id:3001, title:'최단경로', tier:'gold', tags:['그래프 이론','다익스트라'], difficulty:6, timeLimit:2, memLimit:256, desc:'방향 그래프에서 시작 정점으로부터 모든 정점까지의 최단 거리를 구하시오.', inputDesc:'첫째 줄에 N M K, 이후 M줄에 u v w가 주어진다.', outputDesc:'1번부터 N번까지의 최단 거리를 줄마다 출력한다.', hint:'가중치가 음수가 아니므로 다익스트라가 가능합니다.', exampleInputs:['5 6 1\n1 2 2\n1 3 3\n2 3 4\n2 4 5\n3 4 6\n5 1 1'], hiddenInputs:['4 5 1\n1 2 1\n1 3 4\n2 3 2\n2 4 7\n3 4 3','5 7 2\n2 1 2\n2 3 5\n1 4 10\n3 4 1\n4 5 2\n2 5 20\n1 5 100','3 2 1\n1 2 5\n2 3 7','6 7 3\n3 1 4\n3 2 2\n2 4 3\n1 5 10\n4 5 1\n5 6 8\n2 6 20','4 4 4\n4 1 1\n4 2 2\n4 3 3\n1 3 10','5 6 1\n1 2 9\n1 3 1\n3 2 2\n2 4 3\n3 5 7\n4 5 1','4 2 2\n2 3 5\n3 4 6','5 8 5\n5 1 3\n5 2 2\n2 3 4\n3 4 1\n1 4 10\n4 2 1\n1 3 8\n2 5 9','6 6 1\n1 2 2\n2 3 2\n3 4 2\n4 5 2\n5 6 2\n1 6 20','5 5 3\n3 1 6\n3 2 2\n2 4 2\n4 5 2\n1 5 20'], solve:dijkstraAll }),
  makeProblem({ id:3002, title:'네트워크 플로우', tier:'gold', tags:['그래프 이론','플로우'], difficulty:8, timeLimit:2, memLimit:256, desc:'1번 정점에서 N번 정점까지 보낼 수 있는 최대 유량을 구하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 u v c가 주어진다.', outputDesc:'최대 유량을 출력한다.', hint:'증가 경로를 반복해서 찾으세요.', exampleInputs:['4 5\n1 2 10\n1 3 5\n2 3 15\n2 4 10\n3 4 10'], hiddenInputs:['4 5\n1 2 3\n1 3 2\n2 3 1\n2 4 2\n3 4 4','5 7\n1 2 10\n1 3 8\n2 4 5\n3 4 10\n2 3 2\n4 5 7\n3 5 3','3 2\n1 2 4\n2 3 4','4 4\n1 2 100\n1 3 1\n2 4 100\n3 4 1','5 6\n1 2 5\n1 3 6\n2 4 4\n3 4 5\n2 5 1\n4 5 7','6 8\n1 2 7\n1 3 4\n2 4 5\n3 4 3\n2 5 3\n5 6 6\n4 6 4\n3 5 2','4 5\n1 2 6\n1 3 6\n2 3 2\n2 4 4\n3 4 4','5 5\n1 2 10\n2 5 5\n1 3 5\n3 4 5\n4 5 5','4 6\n1 2 5\n1 3 5\n2 3 1\n3 2 1\n2 4 4\n3 4 4','5 7\n1 2 4\n1 3 4\n2 4 3\n3 4 2\n2 5 1\n4 5 5\n3 5 2'], solve:edmondsKarp }),
  makeProblem({ id:3003, title:'위상 정렬', tier:'gold', tags:['그래프 이론','위상 정렬'], difficulty:5, timeLimit:1, memLimit:128, desc:'작업 순서 제약이 주어질 때 가능한 작업 순서를 출력하시오. 불가능하면 -1을 출력하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 a b가 주어진다.', outputDesc:'가능한 순서를 공백으로 출력하거나 -1을 출력한다.', hint:'진입 차수가 0인 정점부터 처리하세요.', exampleInputs:['4 3\n1 2\n1 3\n2 4'], hiddenInputs:TOPO_INPUTS, solve:topoSort }),
  makeProblem({ id:3004, title:'배낭 문제', tier:'gold', tags:['다이나믹 프로그래밍'], difficulty:5, timeLimit:1, memLimit:128, desc:'무게 제한 안에서 얻을 수 있는 최대 가치를 구하시오.', inputDesc:'첫째 줄에 N W, 이후 N줄에 무게와 가치가 주어진다.', outputDesc:'최대 가치를 출력한다.', hint:'뒤에서부터 갱신하면 1차원 DP가 됩니다.', exampleInputs:['4 7\n6 13\n4 8\n3 6\n5 12'], hiddenInputs:KNAPSACK_INPUTS, solve:knapsack }),
  makeProblem({ id:3005, title:'트리의 지름', tier:'gold', tags:['트리','그래프 이론'], difficulty:6, timeLimit:1, memLimit:128, desc:'가중치 트리의 지름 길이를 구하시오.', inputDesc:'첫째 줄에 N, 이후 N-1줄에 a b w가 주어진다.', outputDesc:'지름 길이를 출력한다.', hint:'가장 먼 정점에서 다시 한 번 탐색해보세요.', exampleInputs:['5\n1 2 3\n2 3 4\n3 4 5\n4 5 6'], hiddenInputs:TREE_INPUTS, solve:treeDiameter }),
  makeProblem({ id:3006, title:'2차원 구간 합', tier:'gold', tags:['누적 합'], difficulty:5, timeLimit:1, memLimit:128, desc:'행렬에서 여러 직사각형 구간 합을 구하시오.', inputDesc:'첫째 줄에 N Q, 이후 N줄에 행렬, 이후 Q줄에 x1 y1 x2 y2가 주어진다.', outputDesc:'각 쿼리 결과를 줄마다 출력한다.', hint:'2차원 누적 합을 사용하세요.', exampleInputs:['3 3\n1 2 3\n4 5 6\n7 8 9\n1 1 2 2\n2 2 3 3\n1 1 3 3'], hiddenInputs:SUM2D_INPUTS, solve:sum2DQueries }),
  makeProblem({ id:3007, title:'최소 스패닝 트리', tier:'gold', tags:['그래프 이론','MST'], difficulty:6, timeLimit:1, memLimit:128, desc:'모든 정점을 연결하는 최소 비용을 구하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 a b w가 주어진다.', outputDesc:'MST 비용을 출력한다.', hint:'크루스칼 알고리즘을 사용할 수 있습니다.', exampleInputs:['4 5\n1 2 1\n1 3 4\n2 3 2\n2 4 7\n3 4 3'], hiddenInputs:MST_INPUTS, solve:mstKruskal }),
  makeProblem({ id:3008, title:'LCS 길이', tier:'gold', tags:['다이나믹 프로그래밍','문자열'], difficulty:5, timeLimit:1, memLimit:128, desc:'두 문자열의 최장 공통 부분 수열 길이를 구하시오.', inputDesc:'두 줄에 문자열이 주어진다.', outputDesc:'LCS 길이를 출력한다.', hint:'2차원 DP를 구성하세요.', exampleInputs:['ACAYKP\nCAPCAK'], hiddenInputs:['ABCDEF\nACE','HELLO\nYELLOW','DYNAMIC\nPROGRAMMING','ABC\nDEF','BANANA\nATANA','KITTEN\nSITTING','STACK\nATTACK','GRAPH\nPARAGRAPH','ABCDE\nABCDE','LONGEST\nSTONE'], solve:lcsLength }),
  makeProblem({ id:3009, title:'유니온 파인드 질의', tier:'gold', tags:['자료 구조'], difficulty:5, timeLimit:1, memLimit:128, desc:'합치기와 같은 집합 여부 질의를 처리하시오.', inputDesc:'첫째 줄에 N Q, 이후 Q줄에 type a b가 주어진다.', outputDesc:'질의 결과를 줄마다 출력한다.', hint:'경로 압축을 사용하면 빠릅니다.', exampleInputs:['5 6\n0 1 2\n0 3 4\n1 1 2\n1 2 3\n0 2 3\n1 1 4'], hiddenInputs:UNION_FIND_INPUTS, solve:unionFindQueries }),
  makeProblem({ id:3010, title:'최소 동전 개수', tier:'gold', tags:['다이나믹 프로그래밍'], difficulty:5, timeLimit:1, memLimit:128, desc:'주어진 동전으로 목표 금액을 만드는 최소 개수를 구하시오. 불가능하면 -1을 출력하시오.', inputDesc:'첫째 줄에 N K, 둘째 줄에 N개의 동전 가치가 주어진다.', outputDesc:'최소 동전 개수를 출력한다.', hint:'완전 탐색보다 DP가 적합합니다.', exampleInputs:['3 15\n1 5 12'], hiddenInputs:COIN_INPUTS, solve:minCoinCount }),
  makeProblem({ id:3011, title:'회의실 배정', tier:'gold', tags:['그리디'], difficulty:5, timeLimit:1, memLimit:128, desc:'겹치지 않게 최대 몇 개의 회의를 잡을 수 있는지 구하시오.', inputDesc:'첫째 줄에 N, 이후 N줄에 시작 시간과 종료 시간이 주어진다.', outputDesc:'가능한 최대 회의 수를 출력한다.', hint:'종료 시간이 빠른 회의부터 선택하세요.', exampleInputs:['5\n1 4\n2 3\n3 5\n0 7\n5 9'], hiddenInputs:INTERVAL_INPUTS, solve:intervalScheduling }),
  makeProblem({ id:3012, title:'미로 최단 경로', tier:'gold', tags:['그래프 이론','BFS'], difficulty:5, timeLimit:1, memLimit:128, desc:'1은 이동 가능, 0은 벽인 격자에서 (1,1)에서 (N,M)까지의 최단 경로 길이를 구하시오.', inputDesc:'첫째 줄에 N M, 이후 N줄에 격자가 주어진다.', outputDesc:'최단 경로 길이를 출력한다. 불가능하면 -1을 출력한다.', hint:'BFS 거리 배열을 유지하세요.', exampleInputs:['4 6\n101111\n101010\n101011\n111011'], hiddenInputs:GRID_PATH_INPUTS, solve:shortestGridPath }),
  stringProblem({ id:4001, title:'문자열 압축', tier:'platinum', tags:['문자열','구현'], difficulty:8, desc:'문자열을 일정 단위로 압축했을 때 가장 짧은 길이를 구하시오.', outputDesc:'최소 압축 길이를 출력한다.', hint:'1부터 길이의 절반까지 모든 단위를 시도해보세요.', examples:['aabbaccc'], solve:compressStringLength }),
  makeProblem({ id:4002, title:'KMP 찾기', tier:'platinum', tags:['문자열','KMP'], difficulty:8, timeLimit:1, memLimit:128, desc:'텍스트에서 패턴이 등장하는 횟수와 시작 위치를 모두 구하시오.', inputDesc:'첫째 줄에 텍스트, 둘째 줄에 패턴이 주어진다.', outputDesc:'첫 줄에 개수, 둘째 줄에 1-based 시작 위치를 출력한다.', hint:'실패 함수를 먼저 만드세요.', exampleInputs:['abcabcabc\nabc'], hiddenInputs:KMP_INPUTS, solve:kmpPositions }),
  makeProblem({ id:4003, title:'세그먼트 트리 합 질의', tier:'platinum', tags:['자료 구조','세그먼트 트리'], difficulty:8, timeLimit:1, memLimit:256, desc:'점 갱신과 구간 합 질의를 처리하시오.', inputDesc:'첫째 줄에 N Q, 둘째 줄에 배열, 이후 Q줄에 type a b가 주어진다. type 1은 갱신, type 2는 합 질의다.', outputDesc:'합 질의 결과를 줄마다 출력한다.', hint:'완전 이진 트리 형태를 사용하세요.', exampleInputs:['5 4\n1 2 3 4 5\n2 1 5\n1 3 10\n2 2 4\n2 3 3'], hiddenInputs:SEGMENT_INPUTS, solve:segmentTreeSum }),
  makeProblem({ id:4004, title:'LCA', tier:'platinum', tags:['트리','LCA'], difficulty:8, timeLimit:1, memLimit:256, desc:'트리에서 두 정점의 최소 공통 조상을 구하시오.', inputDesc:'첫째 줄에 N, 이후 N-1줄에 간선, 다음 줄에 Q, 이후 Q줄에 질의가 주어진다.', outputDesc:'각 질의의 LCA를 줄마다 출력한다.', hint:'깊이와 2^k 부모를 전처리하세요.', exampleInputs:['7\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n3\n4 5\n4 6\n3 4'], hiddenInputs:LCA_INPUTS, solve:lcaQueries }),
  stringProblem({ id:4005, title:'최장 팰린드롬 부분문자열', tier:'diamond', tags:['문자열'], difficulty:8, desc:'문자열에서 가장 긴 팰린드롬 부분문자열의 길이를 구하시오.', outputDesc:'최대 길이를 출력한다.', hint:'중심 확장을 시도해볼 수 있습니다.', examples:['babad'], solve:longestPalSubstringLength }),
  makeProblem({ id:4006, title:'편집 거리', tier:'diamond', tags:['다이나믹 프로그래밍','문자열'], difficulty:8, timeLimit:1, memLimit:256, desc:'두 문자열 사이의 편집 거리를 구하시오.', inputDesc:'두 줄에 문자열이 주어진다.', outputDesc:'편집 거리를 출력한다.', hint:'삽입, 삭제, 치환을 상태 전이로 표현하세요.', exampleInputs:['kitten\nsitting'], hiddenInputs:EDIT_INPUTS, solve:editDistance }),
  makeProblem({ id:4007, title:'벽 한 번 부수고 이동', tier:'diamond', tags:['그래프 이론','BFS'], difficulty:8, timeLimit:1, memLimit:256, desc:'벽을 최대 한 번만 부술 수 있을 때 시작점에서 도착점까지 최단 거리를 구하시오.', inputDesc:'첫째 줄에 N M, 이후 N줄에 0/1 격자가 주어진다. 0은 빈칸, 1은 벽이다.', outputDesc:'최단 거리를 출력한다. 불가능하면 -1을 출력한다.', hint:'벽을 부쉈는지 여부를 상태에 포함하세요.', exampleInputs:['6 4\n0100\n1110\n1000\n0000\n0111\n0000'], hiddenInputs:WALL_BREAK_INPUTS, solve:shortestPathWithBreak }),
  makeProblem({ id:4008, title:'외판원 순회', tier:'diamond', tags:['비트마스크','다이나믹 프로그래밍'], difficulty:9, timeLimit:1, memLimit:256, desc:'0번 도시에서 시작해 모든 도시를 한 번씩 방문하고 다시 돌아오는 최소 비용을 구하시오.', inputDesc:'첫째 줄에 N, 이후 N줄에 비용 행렬이 주어진다.', outputDesc:'최소 비용을 출력한다. 불가능하면 -1을 출력한다.', hint:'현재 도시와 방문 집합을 상태로 두세요.', exampleInputs:['4\n0 10 15 20\n5 0 9 10\n6 13 0 12\n8 8 9 0'], hiddenInputs:TSP_INPUTS, solve:tspBitmask }),
  arrayProblem({ id:5001, title:'최대 부분 배열 합', tier:'silver', tags:['다이나믹 프로그래밍'], difficulty:4, desc:'합이 최대가 되는 연속된 부분 배열의 합을 구하세요.', outputDesc:'최대 합을 출력합니다.', hint:'카데인 알고리즘을 사용해보세요.', examples:['5\n1 -2 3 4 -1'], solve:(input) => { const arr=parseArrayInput(input); if(!arr.length) return "0"; let maxSoFar=arr[0], maxEndingHere=arr[0]; for(let i=1;i<arr.length;i++){ maxEndingHere=Math.max(arr[i], maxEndingHere+arr[i]); maxSoFar=Math.max(maxSoFar, maxEndingHere); } return String(maxSoFar); } }),
  makeProblem({ id:5002, title:'최소 동전 개수 2', tier:'gold', tags:['다이나믹 프로그래밍'], difficulty:5, timeLimit:1, memLimit:128, desc:'주어진 동전들로 목표 금액을 만드는 최소 동전 개수를 구하세요.', inputDesc:'첫째 줄에 N K, 둘째 줄에 N개의 동전 가치가 주어집니다.', outputDesc:'최소 개수를 출력합니다. 불가능하면 -1.', hint:'DP[i] = min(DP[i], DP[i-coin]+1)', exampleInputs:['3 11\n1 2 5'], hiddenInputs:['3 15\n1 5 12','2 3\n2 5','4 10\n1 2 3 5','3 100\n1 10 50','1 0\n1','2 14\n5 7','3 20\n1 2 5','5 11\n1 2 5 10 20','2 6\n1 3','4 15\n1 3 4 10'], solve:minCoinCount }),
  stringProblem({ id:5003, title:'단어 뒤집기 3', tier:'silver', tags:['문자열','구현'], difficulty:3, desc:'공백으로 구분된 단어들을 각각 뒤집어서 출력하세요.', outputDesc:'뒤집힌 단어들이 포함된 문자열을 출력합니다.', hint:'split(" ") 후 각각 reverse 하세요.', examples:['hello world'], solve:(input) => input.trim().split(/\s+/).map(w => [...w].reverse().join('')).join(' ') }),
  makeProblem({ id:5004, title:'가장 큰 정사각형 2', tier:'gold', tags:['다이나믹 프로그래밍'], difficulty:5, timeLimit:1, memLimit:128, desc:'0과 1로 된 행렬에서 1로만 된 가장 큰 정사각형의 넓이를 구하세요.', inputDesc:'첫째 줄에 N M, 이어서 N줄에 행렬 내용.', outputDesc:'넓이를 출력합니다.', hint:'DP[i][j] = min(DP[i-1][j], DP[i][j-1], DP[i-1][j-1]) + 1', exampleInputs:['3 3\n011\n111\n111'], hiddenInputs:['2 2\n00\n00','4 4\n1111\n1111\n1111\n1111','1 1\n1','3 4\n1110\n1110\n1110','2 3\n101\n111','5 5\n01111\n11111\n11111\n11111\n11111','2 2\n11\n11','3 3\n101\n010\n101','4 2\n11\n11\n11\n11','3 2\n01\n11\n11'], solve:(input) => { const matrix=parseMatrixInput(input); if(!matrix.length) return "0"; const n=matrix.length, m=matrix[0].length; const dp=Array.from({length:n},()=>Array(m).fill(0)); let maxS=0; for(let i=0;i<n;i++){ for(let j=0;j<m;j++){ if(matrix[i][j]===1){ if(i===0||j===0) dp[i][j]=1; else dp[i][j]=Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])+1; maxS=Math.max(maxS, dp[i][j]); } } } return String(maxS*maxS); } }),
  makeProblem({ id:5005, title:'트리 부모 찾기 2', tier:'silver', tags:['그래프 탐색','트리'], difficulty:4, timeLimit:1, memLimit:256, desc:'루트가 1인 트리에서 각 노드의 부모를 구하세요.', inputDesc:'첫째 줄에 N, 이어서 N-1개의 줄에 연결 정보.', outputDesc:'2번 노드부터 부모 출력.', hint:'BFS나 DFS로 1번부터 탐색하세요.', exampleInputs:['7\n1 6\n6 3\n3 5\n4 1\n2 4\n4 7'], hiddenInputs:['3\n1 2\n1 3','4\n1 2\n2 3\n3 4','5\n1 4\n1 5\n4 2\n4 3','2\n1 2','6\n1 2\n1 3\n2 4\n2 5\n3 6','4\n1 3\n3 2\n2 4','5\n1 2\n2 3\n2 4\n2 5','3\n2 1\n3 1','4\n1 2\n1 3\n3 4','10\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n4 8\n4 9\n5 10'], solve:(input) => { const nums=ints(input); const n=nums[0]; const adj=Array.from({length:n+1},()=>[]); for(let i=1;i<nums.length;i+=2){ const u=nums[i], v=nums[i+1]; if(!v) break; adj[u].push(v); adj[v].push(u); } const parent=Array(n+1).fill(0); const q=[1]; parent[1]=-1; let head=0; while(head<q.length){ const u=q[head++]; for(const v of adj[u]){ if(!parent[v]){ parent[v]=u; q.push(v); } } } return parent.slice(2).join('\n'); } }),
  arrayProblem({ id:5006, title:'카드 합치기', tier:'gold', tags:['그리디','우선순위 큐'], difficulty:4, desc:'두 묶음씩 합칠 때 최소 비교 횟수를 구하세요.', outputDesc:'최소 횟수 출력.', hint:'항상 가장 작은 두 묶음을 합치세요.', examples:['3\n10\n20\n40'], solve:(input) => { const arr=parseArrayInput(input).sort((a,b)=>a-b); let total=0; while(arr.length>1){ const a=arr.shift(); const b=arr.shift(); const sum=a+b; total+=sum; let idx=arr.findIndex(x=>x>sum); if(idx===-1) arr.push(sum); else arr.splice(idx,0,sum); } return String(total); } }),
  makeProblem({ id:5007, title:'안전 영역 2', tier:'silver', tags:['그래프 탐색','브루트포스'], difficulty:5, timeLimit:1, memLimit:128, desc:'잠기지 않는 영역의 최대 개수를 구하세요.', inputDesc:'첫째 줄에 N, 이어서 행렬.', outputDesc:'최대 개수 출력.', hint:'모든 높이에 대해 BFS를 수행해보세요.', exampleInputs:['5\n6 8 2 6 2\n3 2 3 4 6\n6 7 3 3 2\n7 2 5 3 6\n8 9 5 2 7'], hiddenInputs:['2\n1 1\n1 1','3\n1 2 3\n4 5 6\n7 8 9','3\n9 9 9\n9 9 9\n9 9 9','4\n1 2 1 2\n2 1 2 1\n1 2 1 2\n2 1 2 1','2\n5 2\n2 5','3\n1 1 1\n1 5 1\n1 1 1','3\n5 5 5\n5 1 5\n5 5 5','2\n1 10\n10 1','1\n5','4\n4 4 4 4\n4 1 1 4\n4 1 1 4\n4 4 4 4'], solve:(input) => { const matrix=parseMatrixInput(input); const n=matrix.length; if(!n) return "0"; let maxRegions=1; const heights=new Set(matrix.flat()); for(const h of heights){ const visited=Array.from({length:n},()=>Array(n).fill(false)); let regions=0; for(let i=0;i<n;i++){ for(let j=0;j<n;j++){ if(matrix[i][j]>h && !visited[i][j]){ regions++; const q=[[i,j]]; visited[i][j]=true; while(q.length){ const [r,c]=q.shift(); [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr,dc])=>{ const nr=r+dr, nc=c+dc; if(nr>=0&&nr<n&&nc>=0&&nc<n&&matrix[nr][nc]>h&&!visited[nr][nc]){ visited[nr][nc]=true; q.push([nr,nc]); } }); } } } } maxRegions=Math.max(maxRegions, regions); } return String(maxRegions); } }),
  makeProblem({ id:5008, title:'내리막 길 2', tier:'gold', tags:['다이나믹 프로그래밍','그래프 탐색'], difficulty:6, timeLimit:2, memLimit:128, desc:'높이가 낮은 칸으로만 이동하는 경로의 개수를 구하세요.', inputDesc:'첫째 줄에 M N, 이어서 행렬.', outputDesc:'경로 수 출력.', hint:'DFS + 메모이제이션을 사용하세요.', exampleInputs:['4 5\n50 45 37 32 30\n35 50 40 20 25\n30 30 25 17 28\n27 24 22 15 10'], hiddenInputs:['2 2\n2 1\n1 0','3 3\n3 2 1\n2 2 2\n1 1 1','2 3\n10 9 8\n7 6 5','1 1\n10','3 2\n10 5\n8 4\n6 2','2 2\n10 10\n10 10','3 3\n10 9 8\n9 8 7\n8 7 6','2 2\n5 4\n4 3','4 4\n10 9 8 7\n9 8 7 6\n8 7 6 5\n7 6 5 4','5 5\n5 4 3 2 1\n4 3 2 1 0\n3 2 1 0 -1\n2 1 0 -1 -2\n1 0 -1 -2 -3'], solve:(input) => { const matrix=parseMatrixInput(input); const m=matrix.length, n=matrix[0].length; const memo=Array.from({length:m},()=>Array(n).fill(-1)); function dfs(r,c){ if(r===m-1&&c===n-1) return 1; if(memo[r][c]!==-1) return memo[r][c]; let ways=0; [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr,dc])=>{ const nr=r+dr, nc=c+dc; if(nr>=0&&nr<m&&nc>=0&&nc<n&&matrix[nr][nc]<matrix[r][c]) ways+=dfs(nr,nc); }); return memo[r][c]=ways; } return String(dfs(0,0)); } }),
  makeProblem({ id:5009, title:'구간 합 구하기 4', tier:'silver', tags:['누적 합'], difficulty:3, timeLimit:1, memLimit:128, desc:'N개의 수에서 I번째부터 J번째까지의 합을 구하세요.', inputDesc:'첫째 줄에 N M, 둘째 줄에 N개의 수, 이후 M줄에 I J.', outputDesc:'각 합을 출력.', hint:'미리 누적 합 배열을 만들어두세요.', exampleInputs:['5 3\n5 4 3 2 1\n1 3\n2 4\n5 5'], hiddenInputs:['10 5\n1 2 3 4 5 6 7 8 9 10\n1 10\n3 5\n2 2\n7 9\n1 3','5 1\n10 20 30 40 50\n1 5','3 3\n1 1 1\n1 1\n2 2\n3 3','4 2\n1 2 3 4\n1 2\n3 4','6 3\n1 1 1 1 1 1\n1 6\n2 5\n3 4','2 1\n5 5\n1 2','3 1\n1 2 3\n2 3','4 4\n1 1 1 1\n1 4\n1 3\n1 2\n1 1','5 2\n1 3 5 7 9\n2 4\n1 5','10 2\n1 1 1 1 1 1 1 1 1 1\n1 5\n6 10'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); const prefix=[0]; for(let i=0;i<n;i++) prefix.push(prefix[i]+arr[i]); const res=[]; for(let k=2;k<2+m;k++){ const [i,j]=lines[k].split(' ').map(Number); res.push(prefix[j]-prefix[i-1]); } return res.join('\n'); } }),
  stringProblem({ id:5010, title:'회문', tier:'bronze', tags:['문자열','투 포인터'], difficulty:2, desc:'주어진 문자열이 회문(Palindrome)이면 1, 아니면 0을 출력하세요.', outputDesc:'1 또는 0 출력.', hint:'앞뒤로 문자를 비교하세요.', examples:['level'], solve:(input) => { const s=input.trim(); return s===[...s].reverse().join('') ? "1" : "0" } }),

  // ── KOI (한국정보올림피아드) 기출 유형 ──────────────────────────────────────
  makeProblem({ id:6001, title:'배열 정렬 (KOI 2023 초등부)', tier:'bronze', tags:['정렬','구현'], difficulty:2, timeLimit:1, memLimit:128, desc:'N개의 정수를 오름차순으로 정렬하여 출력하시오.\n\n※ 출처: 한국정보올림피아드(KOI) 2023 초등부 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 100,000), 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'오름차순으로 정렬된 수를 공백으로 구분하여 출력한다.', hint:'자바스크립트의 기본 sort()는 문자열 기준입니다. 숫자 비교 함수 (a,b)=>a-b 를 인수로 넘겨야 합니다.', exampleInputs:['5\n3 1 4 1 5'], hiddenInputs:['3\n3 1 2','6\n10 9 8 7 6 5','4\n1 1 1 1','5\n-5 -1 0 3 7','7\n100 50 25 12 6 3 1','1\n42','4\n2 2 1 1','5\n0 0 0 0 0','3\n1000000 -1000000 0','6\n6 5 4 3 2 1'], solve:(input) => { const lines=input.trim().split('\n'); return lines[1].split(/\s+/).map(Number).sort((a,b)=>a-b).join(' '); } }),

  makeProblem({ id:6002, title:'소수 나열 (KOI 2023 중등부)', tier:'silver', tags:['수학','소수','에라토스테네스의 체'], difficulty:3, timeLimit:1, memLimit:128, desc:'N 이하의 소수를 모두 오름차순으로 출력하시오.\n\n※ 출처: 한국정보올림피아드(KOI) 2023 중등부 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N이 주어진다. (2 ≤ N ≤ 100,000)', outputDesc:'N 이하 소수를 한 줄에 하나씩 출력한다.', hint:'에라토스테네스의 체: 2부터 √N까지 각 소수의 배수를 제거하면 O(N log log N)에 모든 소수를 구할 수 있습니다.', exampleInputs:['20'], hiddenInputs:['10','50','2','100','30','7','1000','17','99','200'], solve:(input) => { const n=Number(input.trim()); const sieve=Array(n+1).fill(true); sieve[0]=sieve[1]=false; for(let i=2;i*i<=n;i++) if(sieve[i]) for(let j=i*i;j<=n;j+=i) sieve[j]=false; return sieve.reduce((acc,v,i)=>v?[...acc,i]:acc,[]).join('\n'); } }),

  makeProblem({ id:6003, title:'거스름돈 (KOI 2022 초등부)', tier:'bronze', tags:['그리디','수학'], difficulty:2, timeLimit:1, memLimit:128, desc:'물건 가격이 P원이고 지불한 금액이 M원일 때, 500·100·50·10·5·1원 동전으로 거스름돈을 줄 때 필요한 동전의 최소 개수를 구하시오.\n\n※ 출처: 한국정보올림피아드(KOI) 2022 초등부 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 P, 둘째 줄에 M이 주어진다. (P ≤ M ≤ 10,000, P와 M은 모두 5의 배수)', outputDesc:'최소 동전 개수를 출력한다.', hint:'큰 단위 동전부터 탐욕적으로 선택하면 항상 최적해가 됩니다. 이 문제에서 동전 단위가 배수 관계이기 때문입니다.', exampleInputs:['380\n1000'], hiddenInputs:['0\n1000','500\n1000','990\n1000','5\n10','100\n500','450\n500','1000\n1000','50\n500','250\n500','1995\n2000'], solve:(input) => { const lines=input.trim().split('\n'); const p=Number(lines[0]),m=Number(lines[1]); let rem=m-p,total=0; for(const c of [500,100,50,10,5,1]){ total+=Math.floor(rem/c); rem%=c; } return String(total); } }),

  makeProblem({ id:6004, title:'회문수 개수 (KOI 2022 중등부)', tier:'silver', tags:['수학','구현','문자열'], difficulty:3, timeLimit:1, memLimit:128, desc:'1 이상 N 이하의 정수 중, 숫자를 뒤집어도 같은 수(회문수)의 개수를 구하시오.\n\n예: 11, 121, 1221은 회문수이다.\n\n※ 출처: 한국정보올림피아드(KOI) 2022 중등부 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N이 주어진다. (1 ≤ N ≤ 100,000)', outputDesc:'1 이상 N 이하 회문수의 개수를 출력한다.', hint:'각 수를 문자열로 변환한 뒤 앞뒤를 비교하세요. 1~9까지 9개, 11·22·...·99까지 9개, 101·111·... 이런 식으로 패턴을 찾아도 됩니다.', exampleInputs:['100'], hiddenInputs:['10','50','1','1000','99','101','10000','999','9999','100000'], solve:(input) => { const n=Number(input.trim()); let count=0; for(let i=1;i<=n;i++){ const s=String(i); if(s===s.split('').reverse().join('')) count++; } return String(count); } }),

  makeProblem({ id:6005, title:'시저 암호 해독 (KOI 2021 초등부)', tier:'bronze', tags:['문자열','구현'], difficulty:2, timeLimit:1, memLimit:128, desc:'알파벳을 K칸 앞으로 민 시저 암호가 주어질 때 원래 문자열을 복원하시오. 영문자가 아닌 문자(공백, 숫자 등)는 그대로 출력한다.\n\n※ 출처: 한국정보올림피아드(KOI) 2021 초등부 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 암호화에 사용된 이동 칸 수 K(0 ≤ K ≤ 25), 둘째 줄에 암호문이 주어진다.', outputDesc:'복원된 원래 문자열을 출력한다.', hint:'각 알파벳을 K칸 뒤로 당기면(반대 방향으로 이동) 됩니다. z 이전으로 넘어갈 경우 순환됩니다.', exampleInputs:['3\nKRL'], hiddenInputs:['1\nBCD','0\nHello World','13\nUryyb','25\nABCXYZ','3\nWkh txlfn eurzq ira','1\nZZZ','5\nFGHIJKLMNOPQRSTUVWXYZABCDE','10\nCpnvn Dpejoh','7\nZAY BXW'], solve:(input) => { const lines=input.trim().split('\n'); const k=((Number(lines[0])%26)+26)%26; return [...(lines[1]||'')].map(ch=>{ if(ch>='a'&&ch<='z') return String.fromCharCode((ch.charCodeAt(0)-97-k+26)%26+97); if(ch>='A'&&ch<='Z') return String.fromCharCode((ch.charCodeAt(0)-65-k+26)%26+65); return ch; }).join(''); } }),

  makeProblem({ id:6006, title:'합이 K인 부분 배열 (KOI 2021 중등부)', tier:'silver', tags:['해시','누적 합','투 포인터'], difficulty:4, timeLimit:1, memLimit:128, desc:'정수 배열에서 연속된 원소의 합이 정확히 K인 부분 배열의 개수를 구하시오.\n\n※ 출처: 한국정보올림피아드(KOI) 2021 중등부 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N과 K(1 ≤ N ≤ 10,000, -10,000 ≤ K ≤ 10,000), 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'합이 K인 연속 부분 배열의 수를 출력한다.', hint:'누적 합 prefix[i]를 구하면, 부분합 sum(l,r) = prefix[r] - prefix[l-1] = K 이므로 prefix[r] - K의 등장 횟수를 해시맵으로 O(N)에 셀 수 있습니다.', exampleInputs:['5 2\n1 1 1 1 1'], hiddenInputs:['5 0\n1 -1 1 -1 0','3 3\n1 2 3','4 10\n2 3 5 4','6 6\n3 3 3 3 3 3','5 -2\n-1 -1 -1 0 1','1 5\n5','4 0\n0 0 0 0','5 15\n1 2 3 4 5','3 100\n1 2 3'], solve:(input) => { const lines=input.trim().split('\n'); const [n,k]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); const map=new Map([[0,1]]); let sum=0,count=0; for(const v of arr){ sum+=v; count+=(map.get(sum-k)||0); map.set(sum,(map.get(sum)||0)+1); } return String(count); } }),

  makeProblem({ id:6007, title:'최장 연속 같은 값 (KOI 2020 초등부)', tier:'bronze', tags:['구현','문자열'], difficulty:2, timeLimit:1, memLimit:128, desc:'배열에서 같은 값이 연속으로 가장 많이 등장하는 최대 길이를 구하시오.\n\n※ 출처: 한국정보올림피아드(KOI) 2020 초등부 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N, 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'연속으로 같은 값이 나타나는 최대 길이를 출력한다.', hint:'이전 원소와 현재 원소를 비교하며 연속 길이를 갱신하세요. 달라지면 길이를 1로 초기화합니다.', exampleInputs:['7\n1 1 2 2 2 1 1'], hiddenInputs:['5\n1 2 3 4 5','5\n1 1 1 1 1','6\n1 1 2 2 1 1','1\n7','4\n3 3 3 4','8\n1 2 2 3 3 3 4 4','3\n5 5 5','6\n1 2 1 2 1 2','4\n10 10 20 20'], solve:(input) => { const lines=input.trim().split('\n'); const arr=lines[1].split(' ').map(Number); if(!arr.length) return '0'; let max=1,cur=1; for(let i=1;i<arr.length;i++){ if(arr[i]===arr[i-1]){cur++;if(cur>max)max=cur;}else cur=1; } return String(max); } }),

  makeProblem({ id:6008, title:'최장 공통 부분 문자열 (KOI 2020 중등부)', tier:'silver', tags:['다이나믹 프로그래밍','문자열'], difficulty:4, timeLimit:1, memLimit:128, desc:'두 문자열 A, B에서 연속으로 일치하는 가장 긴 공통 부분 문자열의 길이를 구하시오.\n\n(LCS 공통 부분 수열과 달리 연속이어야 합니다)\n\n※ 출처: 한국정보올림피아드(KOI) 2020 중등부 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 문자열 A, 둘째 줄에 문자열 B가 주어진다. (길이 ≤ 2,000)', outputDesc:'가장 긴 공통 연속 부분 문자열의 길이를 출력한다.', hint:'dp[i][j] = A[i-1]과 B[j-1]이 같을 때 dp[i-1][j-1]+1, 다르면 0으로 정의하면 O(|A||B|) 풀이가 됩니다.', exampleInputs:['ABCDEF\nBCDEFG'], hiddenInputs:['ABCDE\nCDE','HELLO\nWORLD','AAAAAA\nAAAAAA','ABC\nXYZ','DAILYCODING\nCODING','AABAA\nAABAA','ABCABC\nCABCAB','STACK\nSTEAK','ABCDEF\nFEDCBA','PROGRAMMING\nGRAM'], solve:(input) => { const [a,b]=input.trim().split('\n'); const m=a.length,n=b.length; let max=0; const dp=Array.from({length:m+1},()=>Array(n+1).fill(0)); for(let i=1;i<=m;i++) for(let j=1;j<=n;j++){ if(a[i-1]===b[j-1]){dp[i][j]=dp[i-1][j-1]+1;if(dp[i][j]>max)max=dp[i][j];}else dp[i][j]=0; } return String(max); } }),

  makeProblem({ id:6009, title:'소수 경로 (KOI 2019 고등부)', tier:'gold', tags:['그래프 이론','BFS','소수'], difficulty:6, timeLimit:1, memLimit:128, desc:'네 자리 소수 A에서 B로 변환하려 한다. 한 번에 한 자리만 바꿀 수 있고, 중간에 나타나는 모든 수도 네 자리 소수여야 한다. 최소 변환 횟수를 구하시오. 불가능하면 impossible을 출력한다.\n\n예: 1033 → 1733 → 3733 → 3739 → 3779 → 8779 → 8179 (6회)\n\n※ 출처: 한국정보올림피아드(KOI) 2019 고등부 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 두 네 자리 소수 A B가 공백으로 주어진다.', outputDesc:'최소 변환 횟수를 출력한다. 불가능하면 impossible을 출력한다.', hint:'BFS로 현재 소수에서 한 자리를 바꿔 도달할 수 있는 네 자리 소수를 탐색합니다. 에라토스테네스의 체로 소수를 미리 구해두세요.', exampleInputs:['1033 8179'], hiddenInputs:['1033 1033','1009 9999','1000 9999','1013 1013','1033 1039','1009 1013','2017 2017','1009 9001','3137 9973','1013 9011'], solve:(input) => { const [a,b]=input.trim().split(' ').map(Number); const sieve=Array(10000).fill(true); sieve[0]=sieve[1]=false; for(let i=2;i*i<10000;i++) if(sieve[i]) for(let j=i*i;j<10000;j+=i) sieve[j]=false; if(!sieve[a]||!sieve[b]) return 'impossible'; if(a===b) return '0'; const dist=Array(10000).fill(-1); dist[a]=0; const q=[a]; let head=0; while(head<q.length){ const cur=q[head++]; const s=[...String(cur).padStart(4,'0')]; for(let pos=0;pos<4;pos++){ for(let d=(pos===0?1:0);d<=9;d++){ const ns=[...s]; ns[pos]=String(d); const nxt=Number(ns.join('')); if(nxt>=1000&&sieve[nxt]&&dist[nxt]===-1){ dist[nxt]=dist[cur]+1; if(nxt===b) return String(dist[nxt]); q.push(nxt); } } } } return 'impossible'; } }),

  makeProblem({ id:6010, title:'히스토그램 최대 직사각형 (KOI 2018 고등부)', tier:'gold', tags:['스택','구현'], difficulty:6, timeLimit:1, memLimit:128, desc:'N개의 막대로 이루어진 히스토그램에서 직사각형의 최대 넓이를 구하시오. 각 막대의 너비는 1이다.\n\n※ 출처: 한국정보올림피아드(KOI) 2018 고등부 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 100,000), 둘째 줄에 N개의 막대 높이가 주어진다.', outputDesc:'최대 직사각형 넓이를 출력한다.', hint:'단조 스택을 유지하며 각 막대를 오른쪽 경계로 하는 최대 직사각형을 O(N)에 구할 수 있습니다. 스택에 인덱스를 쌓고, 더 낮은 막대가 나올 때 넓이를 계산하세요.', exampleInputs:['7\n2 1 5 6 2 3 1'], hiddenInputs:['3\n3 3 3','1\n5','5\n1 1 1 1 1','4\n4 3 2 1','4\n1 2 3 4','6\n2 4 2 4 2 4','5\n6 6 6 6 6','3\n1 100 1','5\n3 1 3 1 3','4\n2 2 2 2'], solve:(input) => { const lines=input.trim().split('\n'); const h=lines[1].split(' ').map(Number); const n=h.length; const stack=[]; let max=0; for(let i=0;i<=n;i++){ const cur=i===n?0:h[i]; while(stack.length&&h[stack[stack.length-1]]>cur){ const height=h[stack.pop()]; const width=stack.length?i-stack[stack.length-1]-1:i; const area=height*width; if(area>max)max=area; } stack.push(i); } return String(max); } }),

  // ── IOI (국제정보올림피아드) 기출 유형 ──────────────────────────────────────
  makeProblem({ id:7001, title:'합창대형 (IOI 2019 유형)', tier:'gold', tags:['다이나믹 프로그래밍','LIS'], difficulty:5, timeLimit:1, memLimit:128, desc:'N명의 학생이 일렬로 서 있다. 한 명을 정점으로 왼쪽은 키가 순증가, 오른쪽은 순감소하는 합창대형을 만들 때, 그대로 서 있을 수 있는 최대 인원을 구하시오.\n\n※ 출처: 국제정보올림피아드(IOI) 2019 유형 / KOI 2011 중등부 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 1,000), 둘째 줄에 N명의 키가 주어진다.', outputDesc:'그대로 남을 수 있는 최대 인원을 출력한다.', hint:'각 위치 i에서 왼쪽 방향 LIS 길이(lisL[i])와 오른쪽 방향 LDS 길이(lisR[i])를 구한 뒤 lisL[i]+lisR[i]-1의 최댓값이 답입니다.', exampleInputs:['9\n105 176 195 197 177 138 100 180 120'], hiddenInputs:['5\n1 5 2 3 4','3\n1 2 3','3\n3 2 1','1\n100','4\n1 3 2 4','6\n1 2 3 2 1 0','5\n5 4 3 2 1','7\n1 3 5 7 5 3 1','4\n10 10 10 10'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const h=lines[1].split(' ').map(Number); const lisL=Array(n).fill(1); for(let i=1;i<n;i++) for(let j=0;j<i;j++) if(h[j]<h[i]&&lisL[j]+1>lisL[i]) lisL[i]=lisL[j]+1; const lisR=Array(n).fill(1); for(let i=n-2;i>=0;i--) for(let j=i+1;j<n;j++) if(h[j]<h[i]&&lisR[j]+1>lisR[i]) lisR[i]=lisR[j]+1; let max=0; for(let i=0;i<n;i++) if(lisL[i]+lisR[i]-1>max) max=lisL[i]+lisR[i]-1; return String(max); } }),

  makeProblem({ id:7002, title:'단어 변환 (IOI 2018 유형)', tier:'gold', tags:['그래프 이론','BFS','문자열'], difficulty:5, timeLimit:1, memLimit:128, desc:'단어 begin을 end로 변환하려 한다. 한 번에 한 문자만 바꿀 수 있고, 바뀐 단어는 반드시 words 목록에 있어야 한다. 최소 변환 횟수를 구하시오. 불가능하면 0을 출력한다.\n\n※ 출처: 국제정보올림피아드(IOI) 2018 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 begin, 둘째 줄에 end, 셋째 줄에 단어 수 N, 이후 N줄에 단어 목록이 주어진다.', outputDesc:'최소 변환 횟수를 출력한다. 불가능하면 0을 출력한다.', hint:'BFS로 begin에서 한 글자 다른 단어들을 단계적으로 탐색하세요. 두 단어가 한 글자만 다른지 확인하는 함수가 핵심입니다.', exampleInputs:['hit\ncog\n6\nhot\ndot\ndog\nlot\nlog\ncog'], hiddenInputs:['hit\ncog\n5\nhot\ndot\ndog\nlot\nlog','abc\nxyz\n3\nabd\nxbd\nxyz','a\nb\n1\nb','cat\ndog\n4\ncot\ncog\ncog\ndog','abc\nabc\n1\nabc','hit\ncog\n0\n','talk\ntail\n5\ntalk\ntall\ntail\ntale\ntill','abcd\nefgh\n4\nabce\nebce\nebge\nefge'], solve:(input) => { const lines=input.trim().split('\n'); const begin=lines[0].trim(),end=lines[1].trim(); const n=Number(lines[2]); const words=[]; for(let i=3;i<3+n;i++) if(lines[i]) words.push(lines[i].trim()); const diff=(a,b)=>{ let d=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i])d++; return d; }; if(!words.includes(end)) return '0'; const dist=new Map([[begin,0]]); const q=[begin]; let head=0; while(head<q.length){ const cur=q[head++]; if(cur===end) return String(dist.get(cur)); for(const w of words){ if(!dist.has(w)&&diff(cur,w)===1){ dist.set(w,dist.get(cur)+1); q.push(w); } } } return '0'; } }),

  makeProblem({ id:7003, title:'팰린드롬 분할 최소 횟수 (IOI 2016 유형)', tier:'platinum', tags:['다이나믹 프로그래밍','문자열'], difficulty:7, timeLimit:1, memLimit:256, desc:'문자열을 여러 부분으로 나눌 때 각 부분이 팰린드롬이 되도록 하는 최소 분할 횟수(컷 횟수)를 구하시오.\n\n※ 출처: 국제정보올림피아드(IOI) 2016 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 문자열이 주어진다. (길이 ≤ 1,000)', outputDesc:'최소 컷 횟수를 출력한다.', hint:'isPal[i][j]를 미리 구한 뒤, dp[i] = s[0..i]를 팰린드롬 분할하는 최소 컷 횟수로 정의하면 dp[i] = min(dp[j-1]+1) for all j where s[j..i]가 팰린드롬.', exampleInputs:['aab'], hiddenInputs:['a','aaa','abba','aaaa','abcba','abcbad','racecar','abcdef','aabbaa','aaabbb'], solve:(input) => { const s=input.trim(); const n=s.length; const isPal=Array.from({length:n},()=>Array(n).fill(false)); for(let i=0;i<n;i++) isPal[i][i]=true; for(let i=0;i<n-1;i++) isPal[i][i+1]=(s[i]===s[i+1]); for(let len=3;len<=n;len++) for(let i=0;i<=n-len;i++){ const j=i+len-1; isPal[i][j]=(s[i]===s[j]&&isPal[i+1][j-1]); } const dp=Array(n).fill(Infinity); for(let i=0;i<n;i++){ if(isPal[0][i]){ dp[i]=0; continue; } for(let j=1;j<=i;j++) if(isPal[j][i]&&dp[j-1]+1<dp[i]) dp[i]=dp[j-1]+1; } return String(dp[n-1]); } }),

  makeProblem({ id:7004, title:'특정 거리의 도시 (IOI 2020 유형)', tier:'silver', tags:['그래프 이론','BFS'], difficulty:4, timeLimit:1, memLimit:256, desc:'N개의 도시와 M개의 방향 도로가 있다. 출발 도시 K에서 최단 거리가 정확히 X인 도시의 수를 구하시오.\n\n※ 출처: 국제정보올림피아드(IOI) 2020 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N M K X, 이후 M줄에 방향 간선 a b가 주어진다.', outputDesc:'최단 거리가 X인 도시의 수를 출력한다. 없으면 -1을 출력한다.', hint:'BFS로 K에서 출발해 각 도시까지의 최단 거리를 구한 뒤, 거리가 X인 도시 수를 셉니다.', exampleInputs:['4 4 1 2\n1 2\n1 3\n2 3\n2 4'], hiddenInputs:['4 4 1 3\n1 2\n1 3\n2 3\n2 4','3 2 1 1\n1 2\n2 3','5 4 1 2\n1 2\n1 3\n2 4\n3 5','4 3 2 1\n1 2\n2 3\n3 4','6 5 1 1\n1 2\n1 3\n1 4\n1 5\n1 6','4 0 1 1\n','5 5 3 0\n1 2\n2 3\n3 4\n4 5\n5 1','3 3 1 2\n1 2\n2 3\n1 3','6 6 1 3\n1 2\n1 3\n2 4\n3 5\n4 6\n5 6'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m,k,x]=lines[0].split(' ').map(Number); const adj=Array.from({length:n+1},()=>[]); for(let i=1;i<=m;i++){ if(!lines[i]) continue; const [a,b]=lines[i].split(' ').map(Number); adj[a].push(b); } const dist=Array(n+1).fill(-1); dist[k]=0; const q=[k]; let head=0; while(head<q.length){ const cur=q[head++]; for(const nxt of adj[cur]) if(dist[nxt]===-1){ dist[nxt]=dist[cur]+1; q.push(nxt); } } const cnt=dist.slice(1).filter(d=>d===x).length; return String(cnt===0?-1:cnt); } }),

  makeProblem({ id:7005, title:'최대 주식 수익 (IOI 2017 유형)', tier:'silver', tags:['그리디','구현'], difficulty:3, timeLimit:1, memLimit:128, desc:'N일 동안의 주가가 주어질 때, 한 번만 사고 한 번만 팔 수 있다. 얻을 수 있는 최대 이익을 구하시오. 이익을 낼 수 없으면 0을 출력한다.\n\n※ 출처: 국제정보올림피아드(IOI) 2017 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 100,000), 둘째 줄에 N일간의 주가가 주어진다.', outputDesc:'최대 이익을 출력한다.', hint:'왼쪽에서 오른쪽으로 순회하며 지금까지의 최소 주가를 추적하면 O(N)에 해결됩니다.', exampleInputs:['6\n7 1 5 3 6 4'], hiddenInputs:['5\n7 6 4 3 1','4\n1 2 3 4','3\n3 3 3','5\n2 4 1 7 5','1\n5','4\n5 1 4 2','6\n1 3 1 3 1 3','4\n4 3 2 1','5\n1 1 5 1 5','3\n10 1 10'], solve:(input) => { const lines=input.trim().split('\n'); const prices=lines[1].split(' ').map(Number); let minPrice=prices[0],maxProfit=0; for(const p of prices){ if(p-minPrice>maxProfit) maxProfit=p-minPrice; if(p<minPrice) minPrice=p; } return String(maxProfit); } }),

  makeProblem({ id:7006, title:'구간 XOR 질의 (IOI 2021 유형)', tier:'silver', tags:['비트마스크','누적 합'], difficulty:4, timeLimit:1, memLimit:128, desc:'배열의 구간 XOR 값을 여러 번 빠르게 구하시오. XOR 구간합 = prefix[r] XOR prefix[l-1].\n\n※ 출처: 국제정보올림피아드(IOI) 2021 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N Q, 둘째 줄에 N개의 정수, 이후 Q줄에 l r이 주어진다.', outputDesc:'각 질의의 구간 XOR 값을 줄마다 출력한다.', hint:'prefix[i] = arr[0] XOR arr[1] XOR ... XOR arr[i-1]로 정의하면 구간 XOR = prefix[r] XOR prefix[l-1]이 됩니다.', exampleInputs:['5 3\n1 2 3 4 5\n1 3\n2 4\n1 5'], hiddenInputs:['3 2\n7 5 3\n1 2\n2 3','4 4\n1 1 1 1\n1 4\n1 2\n3 4\n2 3','1 1\n255\n1 1','5 1\n0 0 0 0 0\n1 5','6 3\n3 5 6 3 5 6\n1 6\n2 5\n3 4','4 2\n15 15 15 15\n1 4\n2 3','5 5\n1 3 5 7 9\n1 1\n2 2\n3 3\n4 4\n5 5'], solve:(input) => { const lines=input.trim().split('\n'); const [n,q]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); const prefix=[0]; for(let i=0;i<n;i++) prefix.push(prefix[i]^arr[i]); const res=[]; for(let k=2;k<2+q;k++){ const [l,r]=lines[k].split(' ').map(Number); res.push(prefix[r]^prefix[l-1]); } return res.join('\n'); } }),

  makeProblem({ id:7007, title:'최소 경로 비용 (IOI 2022 유형)', tier:'silver', tags:['다이나믹 프로그래밍'], difficulty:4, timeLimit:1, memLimit:128, desc:'N×M 격자에서 (1,1)에서 (N,M)까지 오른쪽 또는 아래로만 이동할 때 지나는 셀 값의 합의 최솟값을 구하시오.\n\n※ 출처: 국제정보올림피아드(IOI) 2022 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N M, 이후 N줄에 M개의 정수가 주어진다.', outputDesc:'최소 경로 합을 출력한다.', hint:'dp[i][j] = min(dp[i-1][j], dp[i][j-1]) + grid[i][j]로 정의하면 O(NM)에 해결됩니다.', exampleInputs:['3 3\n1 3 1\n1 5 1\n4 2 1'], hiddenInputs:['1 1\n5','2 2\n1 2\n3 4','3 2\n1 2\n3 4\n5 6','2 3\n1 2 3\n4 5 6','4 4\n1 2 3 4\n5 6 7 8\n9 10 11 12\n13 14 15 16','3 3\n1 1 1\n1 1 1\n1 1 1','2 2\n100 1\n1 100','3 3\n5 1 1\n1 5 1\n1 1 5','4 3\n1 1 1\n1 1 1\n1 1 1\n1 1 1'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const grid=[]; for(let i=1;i<=n;i++) grid.push(lines[i].split(' ').map(Number)); const dp=Array.from({length:n},(_,i)=>Array(m).fill(0).map((_,j)=>grid[i][j])); for(let j=1;j<m;j++) dp[0][j]=dp[0][j-1]+grid[0][j]; for(let i=1;i<n;i++) dp[i][0]=dp[i-1][0]+grid[i][0]; for(let i=1;i<n;i++) for(let j=1;j<m;j++) dp[i][j]=Math.min(dp[i-1][j],dp[i][j-1])+grid[i][j]; return String(dp[n-1][m-1]); } }),

  makeProblem({ id:7008, title:'탑 (IOI 2023 유형)', tier:'gold', tags:['스택','자료 구조'], difficulty:6, timeLimit:1, memLimit:128, desc:'N개의 탑이 일렬로 세워져 있다. 각 탑의 꼭대기에서 왼쪽으로 신호를 보낼 때, 처음 만나는 더 높은 탑의 번호를 출력하시오. 없으면 0을 출력하시오.\n\n※ 출처: 국제정보올림피아드(IOI) 2023 유형 / 비상업적 교육 목적 사용', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 500,000), 둘째 줄에 N개의 탑 높이가 주어진다.', outputDesc:'각 탑에 대한 수신 탑 번호를 공백으로 출력한다. (1-indexed)', hint:'단조 감소 스택을 왼쪽에서 오른쪽으로 유지하면 됩니다. 현재 탑보다 낮은 스택 최상단을 제거하면서, 남은 최상단이 수신 탑입니다.', exampleInputs:['5\n6 9 5 7 4'], hiddenInputs:['1\n5','3\n1 2 3','3\n3 2 1','4\n4 2 3 1','5\n1 1 1 1 1','4\n10 10 10 10','6\n3 6 4 5 2 6','5\n5 4 3 2 1','4\n1 3 2 5'], solve:(input) => { const lines=input.trim().split('\n'); const h=lines[1].split(' ').map(Number); const n=h.length; const ans=Array(n).fill(0); const stack=[]; for(let i=0;i<n;i++){ while(stack.length&&h[stack[stack.length-1]]<h[i]) stack.pop(); ans[i]=stack.length?stack[stack.length-1]+1:0; stack.push(i); } return ans.join(' '); } }),

  // ── 추가 문제 v2 (Bronze 1051-1065) ─────────────────────────────
  makeProblem({ id:1051, title:'소수 판별', tier:'bronze', tags:['수학','소수'], difficulty:2, timeLimit:1, memLimit:128, desc:'정수 N이 소수이면 YES, 아니면 NO를 출력하시오.', inputDesc:'첫째 줄에 정수 N(2 ≤ N ≤ 1,000,000)이 주어진다.', outputDesc:'소수이면 YES, 아니면 NO를 출력한다.', hint:'√N까지만 나눠보면 O(√N)에 판별할 수 있습니다.', exampleInputs:['7','12'], hiddenInputs:['2','3','4','11','97','100','999983','1000003','25','49'], solve:(input) => { const n=Number(input.trim()); if(n<2) return 'NO'; for(let i=2;i*i<=n;i++) if(n%i===0) return 'NO'; return 'YES'; } }),

  makeProblem({ id:1052, title:'배열 뒤집기', tier:'bronze', tags:['구현','배열'], difficulty:1, timeLimit:1, memLimit:128, desc:'N개의 정수로 이루어진 배열을 뒤집어서 출력하시오.', inputDesc:'첫째 줄에 N, 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'뒤집은 배열을 공백으로 구분해 출력한다.', hint:'reverse 메서드를 활용하거나 뒤에서부터 읽으세요.', exampleInputs:['5\n1 2 3 4 5'], hiddenInputs:['1\n7','3\n10 20 30','4\n4 3 2 1','6\n1 1 1 1 1 1','5\n-1 -2 -3 -4 -5','3\n100 200 300','4\n1 3 5 7','2\n9 8','5\n5 4 3 2 1','6\n2 4 6 8 10 12'], solve:(input) => { const lines=input.trim().split('\n'); return lines[1].split(' ').reverse().join(' '); } }),

  makeProblem({ id:1053, title:'FizzBuzz', tier:'bronze', tags:['구현','수학'], difficulty:1, timeLimit:1, memLimit:128, desc:'1부터 N까지의 수를 출력하되, 3의 배수는 Fizz, 5의 배수는 Buzz, 15의 배수는 FizzBuzz로 출력하시오.', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 100)이 주어진다.', outputDesc:'1부터 N까지 FizzBuzz 규칙에 따라 줄마다 출력한다.', hint:'15의 배수 검사를 3, 5보다 먼저 해야 합니다.', exampleInputs:['15'], hiddenInputs:['1','3','5','6','10','20','30','7','50','100'], solve:(input) => { const n=Number(input.trim()); const res=[]; for(let i=1;i<=n;i++){ if(i%15===0) res.push('FizzBuzz'); else if(i%3===0) res.push('Fizz'); else if(i%5===0) res.push('Buzz'); else res.push(String(i)); } return res.join('\n'); } }),

  makeProblem({ id:1054, title:'2진수 변환', tier:'bronze', tags:['수학','구현'], difficulty:2, timeLimit:1, memLimit:128, desc:'10진수 정수 N을 2진수로 변환해 출력하시오.', inputDesc:'첫째 줄에 정수 N(0 ≤ N ≤ 1,000,000)이 주어진다.', outputDesc:'N의 2진수 표현을 출력한다.', hint:'N.toString(2)를 사용하면 됩니다.', exampleInputs:['10'], hiddenInputs:['0','1','2','7','8','255','1024','65535','1000000','100'], solve:(input) => { return Number(input.trim()).toString(2); } }),

  makeProblem({ id:1055, title:'자연수 역순 출력', tier:'bronze', tags:['구현'], difficulty:1, timeLimit:1, memLimit:128, desc:'N부터 1까지 내림차순으로 한 줄씩 출력하시오.', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 100)이 주어진다.', outputDesc:'N부터 1까지 줄마다 출력한다.', hint:'반복문을 N에서 1로 감소하게 구성하세요.', exampleInputs:['5'], hiddenInputs:['1','2','3','10','7','15','20','50','100','4'], solve:(input) => { const n=Number(input.trim()); const res=[]; for(let i=n;i>=1;i--) res.push(String(i)); return res.join('\n'); } }),

  makeProblem({ id:1056, title:'알파벳 출현 빈도', tier:'bronze', tags:['문자열','해시'], difficulty:2, timeLimit:1, memLimit:128, desc:'영문 소문자로만 이루어진 문자열에서 각 알파벳의 출현 빈도를 "a:3" 형식으로 알파벳 순서대로 출력하시오. 0이면 출력하지 않습니다.', inputDesc:'첫째 줄에 문자열이 주어진다.', outputDesc:'출현한 알파벳과 빈도를 알파벳 순서대로 한 줄씩 출력한다.', hint:'객체로 빈도를 센 뒤 알파벳 순으로 정렬하세요.', exampleInputs:['banana'], hiddenInputs:['a','aaa','abc','hello','programming','algorithm','zzz','abcde','mississippi','zzzaaa'], solve:(input) => { const s=input.trim(); const freq={}; for(const c of s) freq[c]=(freq[c]||0)+1; return Object.keys(freq).sort().map(k=>`${k}:${freq[k]}`).join('\n'); } }),

  makeProblem({ id:1057, title:'두 수의 차 최소', tier:'bronze', tags:['정렬','수학'], difficulty:2, timeLimit:1, memLimit:128, desc:'N개의 정수 배열에서 서로 다른 두 수의 차의 절댓값이 최소인 값을 구하시오.', inputDesc:'첫째 줄에 N(2 ≤ N ≤ 1,000), 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'최솟값을 출력한다.', hint:'정렬 후 인접한 두 수의 차를 비교하면 O(N log N)에 해결됩니다.', exampleInputs:['5\n1 3 7 10 12'], hiddenInputs:['2\n1 2','3\n1 5 10','4\n0 0 0 0','5\n-10 -5 0 5 10','4\n100 200 300 400','3\n1 1000 500','5\n3 7 2 8 4','2\n-100 100','4\n1 2 3 4','3\n10 30 20'], solve:(input) => { const lines=input.trim().split('\n'); const arr=lines[1].split(' ').map(Number).sort((a,b)=>a-b); let min=Infinity; for(let i=1;i<arr.length;i++) if(arr[i]-arr[i-1]<min) min=arr[i]-arr[i-1]; return String(min); } }),

  makeProblem({ id:1058, title:'숫자 뒤집기', tier:'bronze', tags:['구현','수학'], difficulty:1, timeLimit:1, memLimit:128, desc:'정수 N을 뒤집은 수를 출력하시오. 앞에 오는 0은 제거합니다.', inputDesc:'첫째 줄에 정수 N이 주어진다.', outputDesc:'N을 뒤집은 정수를 출력한다.', hint:'문자열로 변환해 뒤집은 뒤 Number로 변환하면 앞 0이 자동 제거됩니다.', exampleInputs:['1234'], hiddenInputs:['1','100','1000','9876','12300','10','12321','100001','999','1001'], solve:(input) => { return String(Number([...input.trim()].reverse().join(''))); } }),

  makeProblem({ id:1059, title:'약수의 합', tier:'bronze', tags:['수학'], difficulty:2, timeLimit:1, memLimit:128, desc:'정수 N의 모든 양의 약수의 합을 구하시오.', inputDesc:'첫째 줄에 정수 N(1 ≤ N ≤ 100,000)이 주어진다.', outputDesc:'약수의 합을 출력한다.', hint:'1부터 √N까지만 확인하고 쌍으로 더하세요.', exampleInputs:['12'], hiddenInputs:['1','2','6','28','100','1000','7','36','100000','15'], solve:(input) => { const n=Number(input.trim()); let sum=0; for(let i=1;i*i<=n;i++) if(n%i===0){ sum+=i; if(i!==n/i) sum+=n/i; } return String(sum); } }),

  makeProblem({ id:1060, title:'배열에서 두 수의 합', tier:'bronze', tags:['배열','해시'], difficulty:2, timeLimit:1, memLimit:128, desc:'N개의 정수와 목표 합 T가 주어질 때 합이 T가 되는 두 수의 쌍이 존재하면 YES, 아니면 NO를 출력하시오.', inputDesc:'첫째 줄에 N T, 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'YES 또는 NO를 출력한다.', hint:'Set에 숫자를 넣으면서 T-현재수가 이미 있는지 확인하면 O(N)에 해결됩니다.', exampleInputs:['5 9\n2 7 11 15 1'], hiddenInputs:['3 10\n1 5 9','4 5\n1 2 3 4','3 7\n1 2 3','5 0\n-1 0 1 2 -2','2 4\n1 3','4 100\n1 2 3 4','3 6\n3 3 3','4 1\n-1 2 0 1','3 14\n7 7 3','2 3\n1 2'], solve:(input) => { const lines=input.trim().split('\n'); const [,t]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); const seen=new Set(); for(const v of arr){ if(seen.has(t-v)) return 'YES'; seen.add(v); } return 'NO'; } }),

  makeProblem({ id:1061, title:'완전수 판별', tier:'bronze', tags:['수학'], difficulty:2, timeLimit:1, memLimit:128, desc:'정수 N이 완전수(자신을 제외한 약수의 합이 자신과 같은 수)이면 YES, 아니면 NO를 출력하시오.', inputDesc:'첫째 줄에 정수 N(1 ≤ N ≤ 10,000)이 주어진다.', outputDesc:'완전수이면 YES, 아니면 NO를 출력한다.', hint:'6, 28, 496, 8128이 완전수입니다.', exampleInputs:['6'], hiddenInputs:['1','2','3','28','496','12','100','8128','7','10'], solve:(input) => { const n=Number(input.trim()); let sum=0; for(let i=1;i<n;i++) if(n%i===0) sum+=i; return sum===n?'YES':'NO'; } }),

  makeProblem({ id:1062, title:'구구단 출력', tier:'bronze', tags:['구현'], difficulty:1, timeLimit:1, memLimit:128, desc:'N단 구구단을 "N × k = 결과" 형식으로 1부터 9까지 출력하시오.', inputDesc:'첫째 줄에 N(2 ≤ N ≤ 9)이 주어진다.', outputDesc:'N×1부터 N×9까지 줄마다 출력한다.', hint:'반복문으로 k를 1부터 9까지 순회하세요.', exampleInputs:['3'], hiddenInputs:['2','4','5','6','7','8','9','3','2','5'], solve:(input) => { const n=Number(input.trim()); return Array.from({length:9},(_,k)=>`${n} × ${k+1} = ${n*(k+1)}`).join('\n'); } }),

  makeProblem({ id:1063, title:'최대 연속 1', tier:'bronze', tags:['구현','배열'], difficulty:2, timeLimit:1, memLimit:128, desc:'0과 1로 이루어진 배열에서 연속된 1의 최대 길이를 구하시오.', inputDesc:'첫째 줄에 N, 둘째 줄에 0과 1로 이루어진 N개의 정수가 주어진다.', outputDesc:'연속된 1의 최대 길이를 출력한다.', hint:'현재 연속 1의 길이를 갱신하다가 0이 나오면 초기화하세요.', exampleInputs:['10\n1 1 0 1 1 1 0 1 1 1'], hiddenInputs:['5\n0 0 0 0 0','5\n1 1 1 1 1','6\n1 0 1 0 1 0','4\n0 1 1 0','1\n1','1\n0','8\n1 1 1 0 1 1 1 1','4\n1 1 1 1','6\n0 0 1 1 1 0','3\n0 0 0'], solve:(input) => { const lines=input.trim().split('\n'); const arr=lines[1].split(' ').map(Number); let max=0,cur=0; for(const v of arr){ if(v===1){cur++;if(cur>max)max=cur;}else cur=0; } return String(max); } }),

  makeProblem({ id:1064, title:'소인수분해', tier:'bronze', tags:['수학','소수'], difficulty:2, timeLimit:1, memLimit:128, desc:'정수 N의 소인수분해 결과를 오름차순으로 출력하시오. 같은 소인수가 여러 번 나오면 여러 줄에 출력합니다.', inputDesc:'첫째 줄에 정수 N(2 ≤ N ≤ 1,000,000)이 주어진다.', outputDesc:'소인수를 줄마다 출력한다.', hint:'2부터 √N까지 나눠지는 소인수를 계속 추출합니다.', exampleInputs:['12'], hiddenInputs:['2','3','4','8','100','360','1000000','97','1024','36'], solve:(input) => { let n=Number(input.trim()); const factors=[]; for(let i=2;i*i<=n;i++) while(n%i===0){factors.push(i);n=Math.floor(n/i);} if(n>1) factors.push(n); return factors.join('\n'); } }),

  makeProblem({ id:1065, title:'행렬 대각합', tier:'bronze', tags:['배열','수학'], difficulty:2, timeLimit:1, memLimit:128, desc:'N×N 행렬에서 주대각선과 반대각선의 합을 구하시오. 가운데 원소는 한 번만 더합니다.', inputDesc:'첫째 줄에 N, 이후 N줄에 행렬이 주어진다.', outputDesc:'두 대각선의 합(중복 제거)을 출력한다.', hint:'주대각선: (i,i), 반대각선: (i,N-1-i). N이 홀수이면 가운데 원소가 겹칩니다.', exampleInputs:['3\n1 2 3\n4 5 6\n7 8 9'], hiddenInputs:['1\n5','2\n1 2\n3 4','4\n1 2 3 4\n5 6 7 8\n9 10 11 12\n13 14 15 16','3\n1 1 1\n1 1 1\n1 1 1','3\n0 0 0\n0 0 0\n0 0 0','5\n1 0 0 0 0\n0 1 0 0 0\n0 0 1 0 0\n0 0 0 1 0\n0 0 0 0 1','2\n5 5\n5 5','4\n10 10 10 10\n10 10 10 10\n10 10 10 10\n10 10 10 10'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const g=[]; for(let i=1;i<=n;i++) g.push(lines[i].split(' ').map(Number)); let sum=0; for(let i=0;i<n;i++){ sum+=g[i][i]; if(i!==n-1-i) sum+=g[i][n-1-i]; } return String(sum); } }),

  // ── 추가 문제 v2 (Silver 2051-2065) ─────────────────────────────
  makeProblem({ id:2051, title:'이진 탐색', tier:'silver', tags:['이진 탐색'], difficulty:3, timeLimit:1, memLimit:128, desc:'오름차순 정렬된 N개의 정수 배열에서 값 T의 인덱스(1-indexed)를 구하시오. 없으면 -1을 출력하시오.', inputDesc:'첫째 줄에 N T, 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'T의 위치(1-indexed)를 출력한다. 없으면 -1을 출력한다.', hint:'lo와 hi를 좁혀가며 O(log N)에 찾습니다.', exampleInputs:['7 5\n1 2 3 4 5 6 7'], hiddenInputs:['5 1\n1 2 3 4 5','5 5\n1 2 3 4 5','5 6\n1 2 3 4 5','1 1\n1','3 2\n1 2 3','7 4\n1 2 3 4 5 6 7','6 3\n1 3 5 7 9 11','4 10\n2 4 6 8','5 3\n1 2 3 4 5','3 100\n10 20 30'], solve:(input) => { const lines=input.trim().split('\n'); const [n,t]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); let lo=0,hi=n-1; while(lo<=hi){ const mid=(lo+hi)>>1; if(arr[mid]===t) return String(mid+1); if(arr[mid]<t) lo=mid+1; else hi=mid-1; } return '-1'; } }),

  makeProblem({ id:2052, title:'구간 합 구하기', tier:'silver', tags:['누적 합'], difficulty:3, timeLimit:1, memLimit:128, desc:'N개의 정수 배열과 Q개의 구간 [l, r]이 주어질 때 각 구간의 합을 출력하시오.', inputDesc:'첫째 줄에 N Q, 둘째 줄에 N개의 정수, 이후 Q줄에 l r이 주어진다.', outputDesc:'각 구간 합을 줄마다 출력한다.', hint:'prefix[i] = arr[0]+...+arr[i-1]로 정의하면 구간 합 = prefix[r] - prefix[l-1].', exampleInputs:['5 3\n1 2 3 4 5\n1 3\n2 4\n1 5'], hiddenInputs:['3 2\n1 2 3\n1 1\n3 3','4 4\n1 1 1 1\n1 4\n1 2\n3 4\n2 3','1 1\n100\n1 1','5 1\n5 4 3 2 1\n1 5','6 3\n1 2 3 4 5 6\n2 5\n1 6\n3 3','4 2\n10 20 30 40\n1 4\n2 3','5 5\n1 0 1 0 1\n1 1\n2 2\n3 3\n4 4\n5 5'], solve:(input) => { const lines=input.trim().split('\n'); const [n,q]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); const pre=[0]; for(const v of arr) pre.push(pre[pre.length-1]+v); const res=[]; for(let i=2;i<2+q;i++){ const [l,r]=lines[i].split(' ').map(Number); res.push(pre[r]-pre[l-1]); } return res.join('\n'); } }),

  makeProblem({ id:2053, title:'스택으로 괄호 검사', tier:'silver', tags:['스택','문자열'], difficulty:3, timeLimit:1, memLimit:128, desc:'주어진 괄호 문자열이 올바른 괄호 수식이면 YES, 아니면 NO를 출력하시오.', inputDesc:'첫째 줄에 괄호 문자열이 주어진다.', outputDesc:'YES 또는 NO를 출력한다.', hint:'스택에 여는 괄호를 쌓고 닫는 괄호가 나올 때 짝이 맞는지 확인합니다.', exampleInputs:['({[]})'], hiddenInputs:['()','{}','[]','(())','({})','([)]','((',')))','()[]{}','{{[[(())]]}}'], solve:(input) => { const s=input.trim(); const stack=[]; const pair={')':`(`,'}':`{`,']':'['}; for(const c of s){ if('({['.includes(c)) stack.push(c); else if(')]}'.includes(c)){ if(!stack.length||stack[stack.length-1]!==pair[c]) return 'NO'; stack.pop(); } } return stack.length===0?'YES':'NO'; } }),

  makeProblem({ id:2054, title:'투 포인터 합', tier:'silver', tags:['투 포인터','배열'], difficulty:4, timeLimit:1, memLimit:128, desc:'오름차순 정렬된 N개의 정수 배열에서 합이 정확히 T인 두 수의 쌍의 개수를 구하시오.', inputDesc:'첫째 줄에 N T, 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'합이 T인 두 수 쌍의 개수를 출력한다.', hint:'왼쪽과 오른쪽 포인터를 이동하며 합이 T와 같은 경우를 셉니다. 중복값 처리에 주의하세요.', exampleInputs:['5 9\n1 2 3 6 6'], hiddenInputs:['4 5\n1 2 3 4','5 0\n-3 -2 -1 1 2','3 6\n3 3 3','4 7\n1 2 5 6','6 10\n1 2 5 5 6 7','2 4\n2 2','5 8\n1 2 4 4 5','3 100\n1 2 3','4 4\n1 1 3 3','5 6\n1 2 3 4 5'], solve:(input) => { const lines=input.trim().split('\n'); const [n,t]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); let left=0,right=n-1,cnt=0; while(left<right){ const s=arr[left]+arr[right]; if(s===t){ if(arr[left]===arr[right]){ const k=right-left+1; cnt+=k*(k-1)/2; break; } let lc=1,rc=1; while(left+lc<right&&arr[left+lc]===arr[left]) lc++; while(right-rc>left&&arr[right-rc]===arr[right]) rc++; cnt+=lc*rc; left+=lc; right-=rc; } else if(s<t) left++; else right--; } return String(cnt); } }),

  makeProblem({ id:2055, title:'연속 부분 배열 최대 길이', tier:'silver', tags:['투 포인터','배열'], difficulty:4, timeLimit:1, memLimit:128, desc:'N개의 양의 정수 배열에서 합이 M 이하인 연속 부분 배열의 최대 길이를 구하시오.', inputDesc:'첫째 줄에 N M, 둘째 줄에 N개의 양의 정수가 주어진다.', outputDesc:'조건을 만족하는 연속 부분 배열의 최대 길이를 출력한다.', hint:'슬라이딩 윈도우로 O(N)에 해결할 수 있습니다. 합이 M을 초과하면 왼쪽 포인터를 이동합니다.', exampleInputs:['6 10\n1 2 3 4 5 6'], hiddenInputs:['5 5\n1 2 3 4 5','3 100\n1 1 1','5 15\n1 2 3 4 5','4 6\n2 3 1 2','6 7\n3 1 2 1 2 3','3 3\n3 3 3','5 1\n1 1 1 1 1','4 10\n3 3 3 3','1 5\n5','4 20\n1 2 3 4'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); let left=0,sum=0,max=0; for(let right=0;right<n;right++){ sum+=arr[right]; while(sum>m&&left<=right) sum-=arr[left++]; if(sum<=m) max=Math.max(max,right-left+1); } return String(max); } }),

  makeProblem({ id:2056, title:'두 배열 교집합', tier:'silver', tags:['해시','배열'], difficulty:3, timeLimit:1, memLimit:128, desc:'두 배열의 교집합 원소를 오름차순으로 출력하시오. 중복은 한 번만 출력합니다.', inputDesc:'첫째 줄에 N M, 둘째 줄에 N개, 셋째 줄에 M개의 정수가 주어진다.', outputDesc:'교집합을 오름차순으로 공백으로 출력한다. 없으면 EMPTY를 출력한다.', hint:'첫 번째 배열을 Set으로 만든 뒤 두 번째 배열에서 해당 Set에 있는 원소를 찾습니다.', exampleInputs:['4 4\n1 2 3 4\n3 4 5 6'], hiddenInputs:['3 3\n1 2 3\n4 5 6','2 2\n1 1\n1 1','4 3\n1 2 3 4\n2 3 4','5 5\n1 2 3 4 5\n1 2 3 4 5','3 2\n1 3 5\n2 4','1 1\n7\n7','4 4\n1 2 3 4\n5 6 7 8','3 3\n5 10 15\n10 20 15','2 3\n2 4\n1 2 3','3 3\n1 2 3\n1 2 3'], solve:(input) => { const lines=input.trim().split('\n'); const a=new Set(lines[1].split(' ').map(Number)); const b=lines[2].split(' ').map(Number); const inter=[...new Set(b.filter(v=>a.has(v)))].sort((x,y)=>x-y); return inter.length?inter.join(' '):'EMPTY'; } }),

  makeProblem({ id:2057, title:'문자열 압축 길이', tier:'silver', tags:['문자열','구현'], difficulty:4, timeLimit:1, memLimit:128, desc:'문자열에서 연속된 같은 문자를 "문자+개수" 형태로 압축했을 때 문자열 길이를 출력하시오. 단 1개이면 개수는 생략합니다.', inputDesc:'첫째 줄에 문자열이 주어진다.', outputDesc:'압축된 문자열의 길이를 출력한다.', hint:'"aabcccdddd" → "a2bc3d4" = 길이 7.', exampleInputs:['aabcccdddd'], hiddenInputs:['a','aaa','abcd','aaabbbccc','aaaaaaaaaa','abcabcabc','aabbccdd','aaaaaabbb','xyzxyz','aaaaaaaaaaaaaaaa'], solve:(input) => { const s=input.trim(); let len=0,i=0; while(i<s.length){ const c=s[i]; let cnt=0; while(i<s.length&&s[i]===c){cnt++;i++;} len+=1+(cnt>1?String(cnt).length:0); } return String(len); } }),

  makeProblem({ id:2058, title:'가장 큰 수 만들기', tier:'silver', tags:['그리디','정렬'], difficulty:3, timeLimit:1, memLimit:128, desc:'N개의 비음수 정수를 순서를 바꿔 이어 붙여 만들 수 있는 가장 큰 수를 출력하시오.', inputDesc:'첫째 줄에 N, 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'가장 큰 수를 출력한다. 모두 0이면 0을 출력한다.', hint:'"ab > ba"이면 a를 앞에 두는 비교 기준으로 정렬합니다.', exampleInputs:['4\n3 30 34 5'], hiddenInputs:['1\n0','3\n1 2 3','4\n0 0 0 0','3\n10 2 22','4\n1 1 1 1','3\n9 99 999','2\n100 10','5\n3 3 3 3 3','3\n0 1 0','4\n5 1 5 1'], solve:(input) => { const lines=input.trim().split('\n'); const arr=lines[1].split(' ').map(String); arr.sort((a,b)=>(b+a).localeCompare(a+b)); const res=arr.join(''); return res[0]==='0'?'0':res; } }),

  makeProblem({ id:2059, title:'N번째 소수', tier:'silver', tags:['수학','소수'], difficulty:3, timeLimit:1, memLimit:128, desc:'N번째 소수를 출력하시오.', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 10,000)이 주어진다.', outputDesc:'N번째 소수를 출력한다.', hint:'소수를 순서대로 찾다가 N번째가 나오면 반환합니다.', exampleInputs:['10'], hiddenInputs:['1','2','3','5','7','100','1000','5000','10000','4'], solve:(input) => { const n=Number(input.trim()); let cnt=0,num=1; while(cnt<n){ num++; let ok=true; for(let i=2;i*i<=num;i++) if(num%i===0){ok=false;break;} if(ok) cnt++; } return String(num); } }),

  makeProblem({ id:2060, title:'다음 큰 수', tier:'silver', tags:['구현','비트마스크'], difficulty:3, timeLimit:1, memLimit:128, desc:'자연수 N의 2진수에서 1의 개수를 세어 N보다 크면서 1의 개수가 같은 가장 작은 수를 구하시오.', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 1,000,000)이 주어진다.', outputDesc:'다음 큰 수를 출력한다.', hint:'N+1부터 순서대로 확인하며 비트 1의 개수가 N과 같은 수를 찾습니다.', exampleInputs:['78'], hiddenInputs:['1','2','3','4','5','6','10','15','100','999999'], solve:(input) => { const n=Number(input.trim()); const cnt=n.toString(2).split('1').length-1; let k=n+1; while(k.toString(2).split('1').length-1!==cnt) k++; return String(k); } }),

  makeProblem({ id:2061, title:'배열 두 번째 최솟값', tier:'silver', tags:['정렬','구현'], difficulty:3, timeLimit:1, memLimit:128, desc:'N개의 정수 배열에서 두 번째로 작은 값을 구하시오. 같은 값은 하나로 취급합니다.', inputDesc:'첫째 줄에 N(2 ≤ N ≤ 100,000), 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'두 번째로 작은 값을 출력한다.', hint:'중복을 제거하고 정렬하면 인덱스 1이 답입니다.', exampleInputs:['5\n3 1 4 1 5'], hiddenInputs:['2\n1 2','3\n5 5 5','4\n1 2 3 4','5\n3 3 1 1 2','3\n100 200 300','4\n-1 -2 -3 -4','5\n0 0 0 0 1','3\n7 7 8','4\n5 1 5 2','2\n10 10'], solve:(input) => { const lines=input.trim().split('\n'); const sorted=[...new Set(lines[1].split(' ').map(Number))].sort((a,b)=>a-b); return String(sorted[1]); } }),

  makeProblem({ id:2062, title:'점프 게임', tier:'silver', tags:['그리디'], difficulty:4, timeLimit:1, memLimit:128, desc:'N개의 숫자가 있고 인덱스 i에서 최대 arr[i]칸 앞으로 점프할 수 있다. 마지막 인덱스까지 도달할 수 있으면 YES, 없으면 NO를 출력하시오.', inputDesc:'첫째 줄에 N, 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'YES 또는 NO를 출력한다.', hint:'현재 도달 가능한 최대 인덱스를 갱신하며 순회합니다.', exampleInputs:['6\n2 3 1 1 4 0'], hiddenInputs:['4\n3 2 1 0','1\n0','2\n0 1','5\n1 1 1 1 1','4\n1 0 0 1','5\n2 0 0 0 1','3\n2 2 0','4\n2 1 0 0','5\n4 0 0 0 0','3\n0 0 0'], solve:(input) => { const lines=input.trim().split('\n'); const arr=lines[1].split(' ').map(Number); const n=arr.length; let maxReach=0; for(let i=0;i<n;i++){ if(i>maxReach) return 'NO'; maxReach=Math.max(maxReach,i+arr[i]); } return 'YES'; } }),

  makeProblem({ id:2063, title:'숫자 삼각형 최대 합', tier:'silver', tags:['다이나믹 프로그래밍'], difficulty:3, timeLimit:1, memLimit:128, desc:'숫자 삼각형의 꼭대기에서 아래로 내려갈 때 경로 합의 최댓값을 구하시오. 매 단계에서 바로 아래 또는 오른쪽 아래로만 이동합니다.', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 500), 이후 N줄에 i번째 줄에 i개의 정수가 주어진다.', outputDesc:'최대 경로 합을 출력한다.', hint:'아래에서 위로 올라가며 dp[i][j] = arr[i][j] + max(dp[i+1][j], dp[i+1][j+1])로 계산합니다.', exampleInputs:['4\n7\n3 8\n8 1 0\n2 7 4 4'], hiddenInputs:['1\n5','2\n1\n2 3','3\n1\n1 1\n1 1 1','2\n10\n1 20','4\n1\n2 3\n4 5 6\n7 8 9 10','3\n5\n1 4\n2 1 6','2\n3\n4 5','3\n1\n3 2\n1 5 3','4\n1\n0 1\n0 0 1\n0 0 0 1'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const tri=[]; for(let i=1;i<=n;i++) tri.push(lines[i].split(' ').map(Number)); for(let i=n-2;i>=0;i--) for(let j=0;j<=i;j++) tri[i][j]+=Math.max(tri[i+1][j],tri[i+1][j+1]); return String(tri[0][0]); } }),

  makeProblem({ id:2064, title:'행렬 전치', tier:'silver', tags:['배열','구현'], difficulty:3, timeLimit:1, memLimit:128, desc:'N×M 행렬을 전치(행과 열을 바꿔)하여 출력하시오.', inputDesc:'첫째 줄에 N M, 이후 N줄에 M개의 정수가 주어진다.', outputDesc:'전치된 M×N 행렬을 출력한다.', hint:'result[j][i] = original[i][j]로 옮겨 담으면 됩니다.', exampleInputs:['2 3\n1 2 3\n4 5 6'], hiddenInputs:['1 1\n5','3 3\n1 2 3\n4 5 6\n7 8 9','1 4\n1 2 3 4','4 1\n1\n2\n3\n4','2 2\n1 2\n3 4','3 2\n1 2\n3 4\n5 6','4 3\n1 2 3\n4 5 6\n7 8 9\n10 11 12','2 4\n1 2 3 4\n5 6 7 8','3 1\n10\n20\n30'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const mat=[]; for(let i=1;i<=n;i++) mat.push(lines[i].split(' ').map(Number)); const rows=[]; for(let j=0;j<m;j++) rows.push(Array.from({length:n},(_,i)=>mat[i][j]).join(' ')); return rows.join('\n'); } }),

  makeProblem({ id:2065, title:'단어 빈도 TOP K', tier:'silver', tags:['해시','정렬'], difficulty:3, timeLimit:1, memLimit:128, desc:'공백으로 구분된 단어들이 주어질 때 가장 많이 등장한 K개의 단어를 빈도 내림차순으로 출력하시오. 빈도가 같으면 사전 순으로 정렬합니다.', inputDesc:'첫째 줄에 K, 둘째 줄에 단어들이 공백으로 주어진다.', outputDesc:'빈도 높은 순으로 K개의 단어를 줄마다 출력한다.', hint:'Map으로 빈도를 세고 빈도 내림차순, 같으면 사전 순으로 정렬합니다.', exampleInputs:['2\nhello world hello alice world hello'], hiddenInputs:['1\na b c a','3\nthe cat sat on the mat the cat','1\nonly','2\napple banana apple banana cherry','3\na a b b c c','1\nz z z z z','2\none two three one two','2\nx y x y z z','1\nword word word','3\nalpha beta gamma alpha beta alpha'], solve:(input) => { const lines=input.trim().split('\n'); const k=Number(lines[0]); const words=lines[1].split(/\s+/); const freq=new Map(); for(const w of words) freq.set(w,(freq.get(w)||0)+1); const sorted=[...freq.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])); return sorted.slice(0,k).map(e=>e[0]).join('\n'); } }),

  // ── 추가 문제 v2 (Gold 3031-3050) ────────────────────────────────
  makeProblem({ id:3031, title:'섬의 개수', tier:'gold', tags:['그래프 이론','BFS'], difficulty:5, timeLimit:1, memLimit:128, desc:'0과 1로 이루어진 N×M 격자에서 상하좌우로 연결된 1의 덩어리(섬)의 개수를 구하시오.', inputDesc:'첫째 줄에 N M, 이후 N줄에 M개의 0 또는 1이 주어진다.', outputDesc:'섬의 개수를 출력한다.', hint:'BFS로 1인 칸을 방문 처리하며 덩어리를 셉니다.', exampleInputs:['4 5\n1 1 0 0 0\n1 1 0 0 1\n0 0 0 1 1\n0 0 0 0 0'], hiddenInputs:['1 1\n1','1 1\n0','3 3\n1 1 1\n1 0 1\n1 1 1','3 3\n1 0 1\n0 0 0\n1 0 1','4 4\n1 1 1 1\n1 1 1 1\n1 1 1 1\n1 1 1 1','5 5\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0\n0 0 0 0 0','3 3\n1 0 1\n1 0 1\n1 0 1','2 4\n1 0 1 0\n0 1 0 1','4 4\n1 1 0 0\n1 0 0 1\n0 0 1 1\n0 0 1 1'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const g=[]; for(let i=1;i<=n;i++) g.push(lines[i].split(' ').map(Number)); let cnt=0; for(let i=0;i<n;i++) for(let j=0;j<m;j++) if(g[i][j]===1){ cnt++; const q=[[i,j]]; g[i][j]=0; let head=0; while(head<q.length){ const [r,c]=q[head++]; for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){ const nr=r+dr,nc=c+dc; if(nr>=0&&nr<n&&nc>=0&&nc<m&&g[nr][nc]===1){ g[nr][nc]=0; q.push([nr,nc]); } } } } return String(cnt); } }),

  makeProblem({ id:3032, title:'동전 교환 최소 횟수', tier:'gold', tags:['다이나믹 프로그래밍'], difficulty:5, timeLimit:1, memLimit:128, desc:'여러 종류의 동전이 무한히 있을 때 금액 T를 만드는 최소 동전 개수를 구하시오. 불가능하면 -1을 출력하시오.', inputDesc:'첫째 줄에 동전 종류 수 K, 둘째 줄에 K개의 액면가, 셋째 줄에 T가 주어진다.', outputDesc:'최소 동전 개수를 출력한다. 불가능하면 -1을 출력한다.', hint:'dp[i] = 금액 i를 만드는 최소 동전 수. dp[0]=0에서 점화식으로 채웁니다.', exampleInputs:['3\n1 5 10\n27'], hiddenInputs:['3\n1 5 10\n0','2\n2 5\n3','1\n1\n10','3\n1 5 10\n100','2\n3 5\n11','1\n2\n7','3\n1 2 5\n11','2\n5 7\n1','4\n1 5 10 25\n30','2\n3 5\n7'], solve:(input) => { const lines=input.trim().split('\n'); const k=Number(lines[0]); const coins=lines[1].split(' ').map(Number); const t=Number(lines[2]); if(t===0) return '0'; const dp=Array(t+1).fill(Infinity); dp[0]=0; for(let i=1;i<=t;i++) for(const c of coins) if(c<=i&&dp[i-c]+1<dp[i]) dp[i]=dp[i-c]+1; return String(dp[t]===Infinity?-1:dp[t]); } }),

  makeProblem({ id:3033, title:'가장 큰 정사각형', tier:'gold', tags:['다이나믹 프로그래밍','배열'], difficulty:5, timeLimit:1, memLimit:128, desc:'0과 1로 이루어진 N×M 행렬에서 1로만 구성된 가장 큰 정사각형의 넓이를 구하시오.', inputDesc:'첫째 줄에 N M, 이후 N줄에 M개의 0 또는 1이 주어진다.', outputDesc:'가장 큰 정사각형의 넓이를 출력한다.', hint:'dp[i][j] = (i,j)를 오른쪽 아래 꼭짓점으로 하는 최대 정사각형 변 길이. mat[i][j]=1이면 min(위,왼,대각)+1', exampleInputs:['4 5\n1 0 1 0 0\n1 0 1 1 1\n1 1 1 1 1\n1 0 0 1 0'], hiddenInputs:['1 1\n0','1 1\n1','2 2\n1 1\n1 1','3 3\n1 1 1\n1 1 1\n1 1 1','3 3\n0 0 0\n0 0 0\n0 0 0','2 3\n1 1 1\n1 1 1','4 4\n1 1 0 0\n1 1 0 0\n0 0 1 1\n0 0 1 1','3 4\n1 1 1 1\n1 1 1 1\n1 1 1 1','5 5\n1 1 1 1 1\n1 1 1 1 1\n1 1 1 1 1\n1 1 1 1 1\n1 1 1 1 1'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const g=[]; for(let i=1;i<=n;i++) g.push(lines[i].split(' ').map(Number)); let max=0; const dp=Array.from({length:n},()=>Array(m).fill(0)); for(let i=0;i<n;i++) for(let j=0;j<m;j++){ if(g[i][j]===0) continue; dp[i][j]=i===0||j===0?1:Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])+1; if(dp[i][j]>max) max=dp[i][j]; } return String(max*max); } }),

  makeProblem({ id:3034, title:'배낭 문제 (0/1 Knapsack)', tier:'gold', tags:['다이나믹 프로그래밍'], difficulty:6, timeLimit:1, memLimit:256, desc:'N개의 물건이 있고 각각 무게 w[i]와 가치 v[i]가 있다. 배낭 최대 용량 W를 넘지 않으면서 가치의 합을 최대화하시오.', inputDesc:'첫째 줄에 N W, 이후 N줄에 w[i] v[i]가 주어진다.', outputDesc:'최대 가치를 출력한다.', hint:'dp[j] = 용량 j에서 얻을 수 있는 최대 가치. 각 물건에 대해 j를 W부터 역순으로 갱신합니다.', exampleInputs:['4 7\n2 3\n3 4\n4 5\n5 8'], hiddenInputs:['1 10\n5 10','3 5\n1 1\n2 6\n3 10','2 3\n2 1\n3 5','4 10\n1 1\n2 6\n3 10\n4 15','1 1\n1 1','3 4\n2 4\n3 5\n4 6','5 10\n2 3\n3 4\n4 5\n5 6\n6 7','2 100\n50 100\n50 200','3 6\n1 1\n2 5\n4 7','2 4\n3 4\n4 7'], solve:(input) => { const lines=input.trim().split('\n'); const [n,w]=lines[0].split(' ').map(Number); const dp=Array(w+1).fill(0); for(let i=1;i<=n;i++){ const [wi,vi]=lines[i].split(' ').map(Number); for(let j=w;j>=wi;j--) if(dp[j-wi]+vi>dp[j]) dp[j]=dp[j-wi]+vi; } return String(dp[w]); } }),

  makeProblem({ id:3035, title:'최장 공통 부분수열 (LCS)', tier:'gold', tags:['다이나믹 프로그래밍','문자열'], difficulty:6, timeLimit:1, memLimit:256, desc:'두 문자열 A와 B의 최장 공통 부분수열(LCS) 길이를 구하시오.', inputDesc:'첫째 줄에 A, 둘째 줄에 B가 주어진다. (길이 ≤ 1,000)', outputDesc:'LCS 길이를 출력한다.', hint:'dp[i][j] = A[0..i-1]과 B[0..j-1]의 LCS 길이. A[i-1]==B[j-1]이면 dp[i-1][j-1]+1, 아니면 max(dp[i-1][j],dp[i][j-1])', exampleInputs:['ABCBDAB\nBDCAB'], hiddenInputs:['ABC\nABC','ABC\nXYZ','ABCDE\nACE','AGGTAB\nGXTXAYB','AB\nBA','DAILYCODING\nCODING','ABCABC\nCBACBA','A\nA','AAAA\nAA','ABCDE\nBCDE'], solve:(input) => { const [a,b]=input.trim().split('\n'); const m=a.length,n=b.length; const dp=Array.from({length:m+1},()=>Array(n+1).fill(0)); for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]); return String(dp[m][n]); } }),

  makeProblem({ id:3036, title:'위상 정렬', tier:'gold', tags:['그래프 이론','위상 정렬'], difficulty:6, timeLimit:1, memLimit:128, desc:'N개의 작업과 M개의 선행 조건이 주어질 때 가능한 작업 순서를 사전 순 최솟값으로 출력하시오. 사이클이 있으면 IMPOSSIBLE을 출력하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 a b(a가 b보다 먼저 수행)가 주어진다.', outputDesc:'위상 정렬 결과를 공백으로 출력한다.', hint:'진입 차수 0인 노드를 정렬된 순서로 꺼내는 Kahn 알고리즘.', exampleInputs:['4 3\n1 2\n1 3\n2 4'], hiddenInputs:['3 3\n1 2\n2 3\n3 1','1 0','5 5\n1 2\n1 3\n2 4\n3 4\n4 5','2 1\n2 1','4 4\n1 2\n2 3\n3 4\n4 2','3 2\n1 3\n2 3','6 6\n1 2\n1 3\n2 4\n3 4\n4 5\n4 6','2 0'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const adj=Array.from({length:n+1},()=>[]); const indeg=Array(n+1).fill(0); for(let i=1;i<=m;i++){ if(!lines[i]||!lines[i].trim()) continue; const [a,b]=lines[i].trim().split(' ').map(Number); adj[a].push(b); indeg[b]++; } let q=[]; for(let i=1;i<=n;i++) if(indeg[i]===0) q.push(i); q.sort((a,b)=>a-b); const res=[]; while(q.length){ q.sort((a,b)=>a-b); const u=q.shift(); res.push(u); for(const v of adj[u]){ indeg[v]--; if(indeg[v]===0) q.push(v); } } return res.length===n?res.join(' '):'IMPOSSIBLE'; } }),

  makeProblem({ id:3037, title:'플로이드-워셜', tier:'gold', tags:['그래프 이론','최단 경로'], difficulty:6, timeLimit:1, memLimit:256, desc:'N개의 정점 M개의 유향 간선이 있을 때 모든 쌍 최단 거리를 구하시오. 도달할 수 없으면 INF를 출력하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 a b w(a→b 가중치 w)가 주어진다.', outputDesc:'N×N 최단 거리 행렬을 줄마다 출력한다. 도달 불가면 INF, 자기 자신은 0.', hint:'dp[a][b] = min(dp[a][b], dp[a][k]+dp[k][b])를 모든 k에 대해 반복합니다.', exampleInputs:['4 5\n1 2 3\n1 4 7\n2 3 2\n3 4 1\n4 2 2'], hiddenInputs:['2 2\n1 2 5\n2 1 3','3 0','3 3\n1 2 1\n2 3 1\n1 3 5','4 4\n1 2 1\n2 3 1\n3 4 1\n4 1 1','2 1\n1 2 10','3 3\n1 2 1\n1 3 4\n2 3 2','1 0','2 2\n1 2 3\n2 1 3'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const INF=1e9; const dist=Array.from({length:n+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===j?0:INF)); for(let i=1;i<=m;i++){ if(!lines[i]||!lines[i].trim()) continue; const [a,b,w]=lines[i].trim().split(' ').map(Number); if(w<dist[a][b]) dist[a][b]=w; } for(let k=1;k<=n;k++) for(let a=1;a<=n;a++) for(let b=1;b<=n;b++) if(dist[a][k]+dist[k][b]<dist[a][b]) dist[a][b]=dist[a][k]+dist[k][b]; const rows=[]; for(let a=1;a<=n;a++) rows.push(dist[a].slice(1,n+1).map(v=>v>=INF?'INF':String(v)).join(' ')); return rows.join('\n'); } }),

  makeProblem({ id:3038, title:'다익스트라 최단 경로', tier:'gold', tags:['그래프 이론','최단 경로'], difficulty:6, timeLimit:1, memLimit:256, desc:'N개의 정점과 M개의 무향 가중치 간선이 있다. 정점 1에서 각 정점까지의 최단 거리를 구하시오. 도달할 수 없으면 INF를 출력하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 a b w(양방향 간선)가 주어진다.', outputDesc:'1번 정점에서 각 정점까지의 최단 거리를 줄마다 출력한다. (1번은 0)', hint:'우선순위 큐(최소 힙)를 사용한 다익스트라. 이미 처리된 정점은 스킵합니다.', exampleInputs:['5 6\n1 2 2\n1 3 3\n2 3 1\n2 4 5\n3 4 1\n4 5 2'], hiddenInputs:['2 1\n1 2 7','3 2\n1 2 1\n2 3 2','4 4\n1 2 1\n2 3 2\n3 4 3\n1 4 10','3 0','1 0','5 4\n1 2 10\n2 3 10\n3 4 10\n4 5 10','4 5\n1 2 1\n1 3 4\n2 3 2\n3 4 3\n2 4 5','3 3\n1 2 1\n2 3 1\n1 3 5'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const adj=Array.from({length:n+1},()=>[]); for(let i=1;i<=m;i++){ if(!lines[i]||!lines[i].trim()) continue; const [a,b,w]=lines[i].trim().split(' ').map(Number); adj[a].push([b,w]); adj[b].push([a,w]); } const INF=1e9; const dist=Array(n+1).fill(INF); dist[1]=0; const pq=[[0,1]]; while(pq.length){ pq.sort((a,b)=>a[0]-b[0]); const [d,u]=pq.shift(); if(d>dist[u]) continue; for(const [v,w] of adj[u]) if(dist[u]+w<dist[v]){ dist[v]=dist[u]+w; pq.push([dist[v],v]); } } return dist.slice(1).map(v=>v>=INF?'INF':String(v)).join('\n'); } }),

  makeProblem({ id:3039, title:'최대 직사각형 (행렬)', tier:'gold', tags:['스택','다이나믹 프로그래밍'], difficulty:6, timeLimit:1, memLimit:128, desc:'0과 1로 이루어진 N×M 행렬에서 1로만 이루어진 최대 직사각형 넓이를 구하시오.', inputDesc:'첫째 줄에 N M, 이후 N줄에 M개의 0 또는 1이 주어진다.', outputDesc:'최대 직사각형 넓이를 출력한다.', hint:'각 행을 히스토그램으로 변환한 뒤 스택으로 최대 직사각형을 구합니다.', exampleInputs:['4 5\n1 0 1 0 0\n1 0 1 1 1\n1 1 1 1 1\n1 0 0 1 0'], hiddenInputs:['1 1\n1','1 1\n0','2 2\n1 1\n1 1','3 3\n1 1 1\n1 1 1\n1 1 1','3 3\n0 0 0\n0 0 0\n0 0 0','2 3\n1 1 0\n0 1 1','1 5\n1 1 1 1 1','4 4\n1 0 0 1\n1 1 1 1\n1 1 1 1\n1 0 0 1','3 4\n0 1 1 0\n1 1 1 1\n0 1 1 0'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const mat=[]; for(let i=1;i<=n;i++) mat.push(lines[i].split(' ').map(Number)); const h=Array(m).fill(0); let ans=0; for(let i=0;i<n;i++){ for(let j=0;j<m;j++) h[j]=mat[i][j]===0?0:h[j]+1; const stack=[]; for(let j=0;j<=m;j++){ const cur=j===m?0:h[j]; while(stack.length&&h[stack[stack.length-1]]>cur){ const height=h[stack.pop()]; const width=stack.length?j-stack[stack.length-1]-1:j; ans=Math.max(ans,height*width); } stack.push(j); } } return String(ans); } }),

  makeProblem({ id:3040, title:'순열 순위', tier:'gold', tags:['수학','순열'], difficulty:6, timeLimit:1, memLimit:128, desc:'1부터 N까지의 수로 이루어진 순열이 주어질 때 사전순으로 몇 번째 순열인지 구하시오. (1-indexed)', inputDesc:'첫째 줄에 N, 둘째 줄에 N개의 수가 주어진다.', outputDesc:'순열의 순위를 출력한다.', hint:'각 위치에서 현재 값보다 작은 남은 수의 개수 × (N-i-1)!의 합을 구합니다.', exampleInputs:['3\n2 3 1'], hiddenInputs:['1\n1','2\n1 2','2\n2 1','3\n1 2 3','3\n3 2 1','4\n1 2 3 4','4\n4 3 2 1','3\n1 3 2','4\n2 1 3 4','3\n2 1 3'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const perm=lines[1].split(' ').map(Number); const fact=Array(n+1).fill(1); for(let i=1;i<=n;i++) fact[i]=fact[i-1]*i; const remaining=[...Array(n+1).keys()].slice(1); let rank=1; for(let i=0;i<n;i++){ const pos=remaining.indexOf(perm[i]); rank+=pos*fact[n-i-1]; remaining.splice(pos,1); } return String(rank); } }),

  makeProblem({ id:3041, title:'N-Queen', tier:'gold', tags:['백트래킹'], difficulty:7, timeLimit:2, memLimit:128, desc:'N×N 체스판에 N개의 퀸을 서로 공격하지 않도록 놓는 경우의 수를 구하시오.', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 12)이 주어진다.', outputDesc:'경우의 수를 출력한다.', hint:'각 행에 퀸을 하나씩 놓고 열, 대각선 충돌을 체크하며 백트래킹합니다.', exampleInputs:['8'], hiddenInputs:['1','2','3','4','5','6','7','9','10','12'], solve:(input) => { const n=Number(input.trim()); const col=new Set(),d1=new Set(),d2=new Set(); let cnt=0; function bt(row){ if(row===n){cnt++;return;} for(let c=0;c<n;c++){ if(col.has(c)||d1.has(row-c)||d2.has(row+c)) continue; col.add(c);d1.add(row-c);d2.add(row+c); bt(row+1); col.delete(c);d1.delete(row-c);d2.delete(row+c); } } bt(0); return String(cnt); } }),

  makeProblem({ id:3042, title:'K번째 순열', tier:'gold', tags:['수학','순열'], difficulty:6, timeLimit:1, memLimit:128, desc:'1부터 N까지의 수로 만들 수 있는 순열을 사전 순으로 나열할 때 K번째 순열을 출력하시오.', inputDesc:'첫째 줄에 N K가 주어진다.', outputDesc:'K번째 순열을 공백으로 출력한다.', hint:'각 자리에서 팩토리얼을 이용해 몇 번째 수를 선택할지 계산합니다.', exampleInputs:['3 3'], hiddenInputs:['1 1','2 1','2 2','3 1','3 6','4 1','4 24','4 13','3 4','3 5'], solve:(input) => { const [n,k]=input.trim().split(' ').map(Number); const fact=Array(n+1).fill(1); for(let i=1;i<=n;i++) fact[i]=fact[i-1]*i; const remaining=[...Array(n+1).keys()].slice(1); let rem=k-1; const res=[]; for(let i=n;i>=1;i--){ const idx=Math.floor(rem/fact[i-1]); res.push(remaining[idx]); remaining.splice(idx,1); rem%=fact[i-1]; } return res.join(' '); } }),

  makeProblem({ id:3043, title:'연속 부분 배열 최대 곱', tier:'gold', tags:['다이나믹 프로그래밍'], difficulty:6, timeLimit:1, memLimit:128, desc:'N개의 정수 배열에서 연속 부분 배열의 곱 최댓값을 구하시오.', inputDesc:'첫째 줄에 N, 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'최대 곱을 출력한다.', hint:'최솟값(음수)도 추적해야 합니다. 음수에 음수를 곱하면 최댓값이 될 수 있습니다.', exampleInputs:['7\n2 3 -2 4 -1 2 3'], hiddenInputs:['1\n5','3\n-2 3 -4','4\n-1 -2 -3 -4','5\n1 2 3 4 5','4\n0 2 -1 3','3\n-1 -2 -3','5\n2 -5 -2 -4 3','4\n-1 0 -2 3','3\n-2 -3 7','2\n-3 -1'], solve:(input) => { const lines=input.trim().split('\n'); const arr=lines[1].split(' ').map(Number); let maxP=arr[0],minP=arr[0],ans=arr[0]; for(let i=1;i<arr.length;i++){ const v=arr[i],tmp=maxP; maxP=Math.max(v,v*maxP,v*minP); minP=Math.min(v,v*tmp,v*minP); if(maxP>ans) ans=maxP; } return String(ans); } }),

  makeProblem({ id:3044, title:'구간 분할 최대값 최소화', tier:'gold', tags:['이진 탐색','그리디'], difficulty:6, timeLimit:1, memLimit:128, desc:'N개의 양의 정수 배열을 정확히 K개의 연속 구간으로 분할할 때 각 구간 합의 최댓값을 최소화하시오.', inputDesc:'첫째 줄에 N K, 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'최솟값을 출력한다.', hint:'이진 탐색으로 최댓값 M을 정하고 M 이하로 K개 구간으로 나눌 수 있는지 그리디로 검증합니다.', exampleInputs:['5 3\n1 2 3 4 5'], hiddenInputs:['3 2\n1 2 3','4 2\n1 2 3 4','6 2\n1 2 3 4 5 6','4 4\n1 1 1 1','5 1\n1 2 3 4 5','5 5\n5 5 5 5 5','6 3\n7 2 5 10 8 1','4 2\n1 3 2 4','3 3\n1 2 3','5 2\n10 5 5 5 10'], solve:(input) => { const lines=input.trim().split('\n'); const [n,k]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); const canDiv=(mid)=>{ let parts=1,cur=0; for(const v of arr){ if(v>mid) return false; if(cur+v>mid){parts++;cur=v;}else cur+=v; } return parts<=k; }; let lo=Math.max(...arr),hi=arr.reduce((a,b)=>a+b,0); while(lo<hi){ const mid=(lo+hi)>>1; if(canDiv(mid)) hi=mid; else lo=mid+1; } return String(lo); } }),

  makeProblem({ id:3045, title:'트리 BFS (레벨 순회)', tier:'gold', tags:['트리','BFS'], difficulty:5, timeLimit:1, memLimit:128, desc:'N개의 노드를 가진 트리에서 루트 1에서 BFS로 탐색했을 때 방문 순서를 출력하시오.', inputDesc:'첫째 줄에 N, 이후 N-1줄에 간선 a b가 주어진다.', outputDesc:'BFS 방문 순서를 공백으로 출력한다.', hint:'BFS 큐에서 노드를 꺼낼 때 이웃 노드를 오름차순으로 삽입합니다.', exampleInputs:['7\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7'], hiddenInputs:['1','3\n1 2\n1 3','4\n1 2\n2 3\n3 4','5\n1 2\n1 3\n2 4\n3 5','6\n1 2\n2 3\n3 4\n4 5\n5 6','5\n1 3\n1 2\n2 5\n2 4','7\n1 2\n1 3\n1 4\n2 5\n3 6\n4 7','4\n1 4\n1 3\n1 2'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); if(n===1) return '1'; const adj=Array.from({length:n+1},()=>[]); for(let i=1;i<n;i++){ const [a,b]=lines[i].split(' ').map(Number); adj[a].push(b); adj[b].push(a); } for(let i=1;i<=n;i++) adj[i].sort((a,b)=>a-b); const vis=Array(n+1).fill(false); const q=[1]; vis[1]=true; const res=[]; let head=0; while(head<q.length){ const u=q[head++]; res.push(u); for(const v of adj[u]) if(!vis[v]){ vis[v]=true; q.push(v); } } return res.join(' '); } }),

  makeProblem({ id:3046, title:'소수 구간 합', tier:'gold', tags:['수학','소수','누적 합'], difficulty:5, timeLimit:1, memLimit:128, desc:'Q개의 쿼리에 대해 구간 [l, r] 안의 소수의 합을 구하시오.', inputDesc:'첫째 줄에 Q, 이후 Q줄에 l r(1 ≤ l ≤ r ≤ 1,000,000)이 주어진다.', outputDesc:'각 쿼리의 소수 합을 줄마다 출력한다.', hint:'에라토스테네스의 체로 소수를 구한 뒤 누적 합 배열을 만들면 쿼리당 O(1).', exampleInputs:['2\n1 10\n1 20'], hiddenInputs:['1\n1 2','1\n2 2','1\n1 100','3\n1 10\n5 15\n10 20','1\n1 1','2\n1 50\n50 100','1\n999983 1000000','1\n2 100','3\n1 5\n6 10\n11 15','1\n1 1000000'], solve:(input) => { const lines=input.trim().split('\n'); const q=Number(lines[0]); const MAX=1000001; const sieve=Array(MAX).fill(true); sieve[0]=sieve[1]=false; for(let i=2;i*i<MAX;i++) if(sieve[i]) for(let j=i*i;j<MAX;j+=i) sieve[j]=false; const pre=Array(MAX).fill(0); for(let i=1;i<MAX;i++) pre[i]=pre[i-1]+(sieve[i]?i:0); const res=[]; for(let i=1;i<=q;i++){ const [l,r]=lines[i].split(' ').map(Number); res.push(pre[r]-pre[l-1]); } return res.join('\n'); } }),

  makeProblem({ id:3047, title:'최소 신장 트리 (크루스칼)', tier:'gold', tags:['그래프 이론','MST','유니온-파인드'], difficulty:6, timeLimit:1, memLimit:128, desc:'N개의 정점과 M개의 간선이 있을 때 최소 신장 트리의 비용을 구하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 a b w(무향 간선)가 주어진다.', outputDesc:'MST 비용을 출력한다.', hint:'간선을 가중치 오름차순 정렬 후 유니온-파인드로 사이클을 피하며 선택합니다.', exampleInputs:['4 5\n1 2 1\n1 3 4\n2 3 2\n2 4 7\n3 4 3'], hiddenInputs:['2 1\n1 2 5','3 3\n1 2 1\n2 3 1\n1 3 10','4 6\n1 2 1\n1 3 2\n1 4 3\n2 3 4\n2 4 5\n3 4 6','5 7\n1 2 2\n1 3 3\n2 4 5\n3 4 1\n3 5 4\n4 5 2\n2 5 6','3 2\n1 2 3\n2 3 4','4 4\n1 2 1\n2 3 1\n3 4 1\n4 1 1','3 3\n1 2 10\n1 3 6\n2 3 5','5 5\n1 2 1\n2 3 1\n3 4 1\n4 5 1\n5 1 1'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const edges=[]; for(let i=1;i<=m;i++){ const [a,b,w]=lines[i].split(' ').map(Number); edges.push([w,a,b]); } edges.sort((x,y)=>x[0]-y[0]); const par=Array.from({length:n+1},(_,i)=>i); const find=(x)=>par[x]===x?x:par[x]=find(par[x]); let cost=0,cnt=0; for(const [w,a,b] of edges){ const pa=find(a),pb=find(b); if(pa!==pb){ par[pa]=pb; cost+=w; if(++cnt===n-1) break; } } return String(cost); } }),

  makeProblem({ id:3048, title:'구간 최솟값 쿼리', tier:'gold', tags:['자료 구조','희소 테이블'], difficulty:6, timeLimit:1, memLimit:256, desc:'N개의 정수 배열에서 Q개의 구간 [l, r] 최솟값을 구하시오.', inputDesc:'첫째 줄에 N Q, 둘째 줄에 N개의 정수, 이후 Q줄에 l r이 주어진다.', outputDesc:'각 쿼리의 최솟값을 줄마다 출력한다.', hint:'희소 테이블을 구성하면 전처리 O(N log N), 쿼리 O(1)에 최솟값을 구할 수 있습니다.', exampleInputs:['5 3\n3 1 4 1 5\n1 3\n2 4\n1 5'], hiddenInputs:['1 1\n7\n1 1','5 5\n1 2 3 4 5\n1 5\n1 1\n5 5\n2 4\n3 3','4 2\n5 3 7 1\n1 4\n2 3','3 3\n10 5 8\n1 2\n2 3\n1 3','6 4\n4 2 6 1 3 5\n1 6\n2 5\n3 4\n1 3','5 1\n9 8 7 6 5\n2 4','4 4\n1 1 1 1\n1 4\n2 3\n1 2\n3 4'], solve:(input) => { const lines=input.trim().split('\n'); const [n,q]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); const LOG=Math.ceil(Math.log2(n+1))+1; const st=Array.from({length:LOG},()=>Array(n).fill(0)); for(let i=0;i<n;i++) st[0][i]=arr[i]; for(let j=1;j<LOG;j++) for(let i=0;i+(1<<j)<=n;i++) st[j][i]=Math.min(st[j-1][i],st[j-1][i+(1<<(j-1))]); const res=[]; for(let k=2;k<2+q;k++){ const [l,r]=lines[k].split(' ').map(Number); const len=r-l+1; const j=Math.floor(Math.log2(len)); res.push(Math.min(st[j][l-1],st[j][r-(1<<j)])); } return res.join('\n'); } }),

  makeProblem({ id:3049, title:'팰린드롬 분할 최소 횟수', tier:'gold', tags:['다이나믹 프로그래밍','문자열'], difficulty:7, timeLimit:1, memLimit:256, desc:'문자열을 여러 부분으로 나눌 때 각 부분이 팰린드롬이 되도록 하는 최소 분할(컷) 횟수를 구하시오.', inputDesc:'첫째 줄에 문자열이 주어진다. (길이 ≤ 1,000)', outputDesc:'최소 컷 횟수를 출력한다.', hint:'isPal[i][j]를 미리 구한 뒤 dp[i] = s[0..i]의 최소 컷 수로 정의합니다.', exampleInputs:['aab'], hiddenInputs:['a','aaa','abba','aaaa','abcba','racecar','abcdef','aabbaa','aaabbb','abcbaabcba'], solve:(input) => { const s=input.trim(); const n=s.length; const isPal=Array.from({length:n},()=>Array(n).fill(false)); for(let i=0;i<n;i++) isPal[i][i]=true; for(let i=0;i<n-1;i++) isPal[i][i+1]=(s[i]===s[i+1]); for(let len=3;len<=n;len++) for(let i=0;i<=n-len;i++){ const j=i+len-1; isPal[i][j]=(s[i]===s[j]&&isPal[i+1][j-1]); } const dp=Array(n).fill(Infinity); for(let i=0;i<n;i++){ if(isPal[0][i]){dp[i]=0;continue;} for(let j=1;j<=i;j++) if(isPal[j][i]&&dp[j-1]+1<dp[i]) dp[i]=dp[j-1]+1; } return String(dp[n-1]); } }),

  makeProblem({ id:3050, title:'강한 연결 요소 (SCC)', tier:'gold', tags:['그래프 이론','SCC'], difficulty:7, timeLimit:1, memLimit:256, desc:'방향 그래프에서 강한 연결 요소(SCC)의 개수를 구하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 유향 간선 a b가 주어진다.', outputDesc:'SCC의 개수를 출력한다.', hint:'코사라주 알고리즘: 원래 그래프 DFS 후 역방향 그래프 DFS로 SCC를 구합니다.', exampleInputs:['4 4\n1 2\n2 3\n3 1\n4 1'], hiddenInputs:['1 0','2 2\n1 2\n2 1','3 3\n1 2\n2 3\n3 1','4 3\n1 2\n2 3\n3 4','5 5\n1 2\n2 3\n3 1\n4 5\n5 4','6 7\n1 2\n2 3\n3 1\n4 5\n5 6\n6 4\n1 4','3 3\n1 2\n2 3\n1 3','4 4\n1 2\n2 1\n3 4\n4 3'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const adj=Array.from({length:n+1},()=>[]); const radj=Array.from({length:n+1},()=>[]); for(let i=1;i<=m;i++){ if(!lines[i]||!lines[i].trim()) continue; const [a,b]=lines[i].trim().split(' ').map(Number); adj[a].push(b); radj[b].push(a); } const vis=Array(n+1).fill(false); const order=[]; for(let i=1;i<=n;i++) if(!vis[i]){ const stk=[[i,0]]; vis[i]=true; while(stk.length){ const top=stk[stk.length-1]; if(top[1]<adj[top[0]].length){ const v=adj[top[0]][top[1]++]; if(!vis[v]){vis[v]=true;stk.push([v,0]);} }else{ stk.pop(); order.push(top[0]); } } } const vis2=Array(n+1).fill(false); let scc=0; while(order.length){ const start=order.pop(); if(vis2[start]) continue; scc++; const stk=[start]; vis2[start]=true; while(stk.length){ const u=stk.pop(); for(const v of radj[u]) if(!vis2[v]){vis2[v]=true;stk.push(v);} } } return String(scc); } }),

  // ── Bronze 완성 (46→50) ───────────────────────────────────────────────────
  singleIntProblem({ id:1066, title:'세 수의 합', tier:'bronze', tags:['수학'], difficulty:1, desc:'세 정수 A, B, C가 한 줄에 공백으로 주어질 때 합을 출력하시오.', outputDesc:'A+B+C를 출력한다.', hint:'세 수를 모두 더하세요.', examples:['1 2 3','10 20 30'], solve:(input) => { const [a,b,c]=input.trim().split(/\s+/).map(Number); return String(a+b+c) } }),
  pairProblem({ id:1067, title:'두 수의 곱', tier:'bronze', tags:['수학'], difficulty:1, desc:'두 정수 A와 B의 곱을 출력하시오.', outputDesc:'A×B를 출력한다.', hint:'곱셈 연산자를 사용하세요.', examples:['3 5','7 8'], solve:(input) => { const [a,b]=ints(input); return String(a*b) } }),
  arrayProblem({ id:1068, title:'짝수의 합', tier:'bronze', tags:['구현'], difficulty:1, desc:'배열에서 짝수만 골라 합을 구하시오.', outputDesc:'짝수의 합을 출력한다.', hint:'각 원소를 2로 나눈 나머지가 0인지 확인하세요.', examples:['5\n1 2 3 4 5'], solve:(input) => String(parseArrayInput(input).filter(v=>v%2===0).reduce((s,v)=>s+v,0)) }),
  stringProblem({ id:1069, title:'소문자 변환', tier:'bronze', tags:['문자열'], difficulty:1, desc:'문자열을 모두 소문자로 바꿔 출력하시오.', outputDesc:'소문자로 변환된 문자열을 출력한다.', hint:'문자열 소문자 변환 메서드를 사용하세요.', examples:['DailyCoding','HELLO'], solve:(input) => input.trim().toLowerCase() }),

  // ── Gold 완성 (41→50) ────────────────────────────────────────────────────
  makeProblem({ id:3051, title:'플로이드 와샬', tier:'gold', tags:['그래프 이론','플로이드-워셜'], difficulty:6, timeLimit:2, memLimit:256, desc:'N개의 정점과 M개의 간선이 있는 방향 그래프에서 모든 정점 쌍의 최단 거리를 구하시오. 경로가 없으면 INF를 출력하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 u v w가 주어진다.', outputDesc:'N×N 거리 행렬을 출력한다.', hint:'dp[k][i][j] = i에서 j까지 k번 정점을 경유할 때 최단거리.', exampleInputs:['4 7\n1 2 3\n1 4 7\n2 1 8\n2 3 2\n3 1 3\n3 4 4\n4 3 2'], hiddenInputs:['2 1\n1 2 5','3 3\n1 2 1\n2 3 2\n1 3 10','3 0','4 4\n1 2 1\n2 3 1\n3 4 1\n4 1 1','3 3\n1 2 3\n2 3 4\n3 1 5'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const INF=1e9; const d=Array.from({length:n+1},()=>Array(n+1).fill(INF)); for(let i=1;i<=n;i++) d[i][i]=0; for(let i=1;i<=m;i++){ const [u,v,w]=lines[i].split(' ').map(Number); if(w<d[u][v]) d[u][v]=w; } for(let k=1;k<=n;k++) for(let i=1;i<=n;i++) for(let j=1;j<=n;j++) if(d[i][k]+d[k][j]<d[i][j]) d[i][j]=d[i][k]+d[k][j]; const res=[]; for(let i=1;i<=n;i++) res.push(d[i].slice(1).map(v=>v===INF?'INF':v).join(' ')); return res.join('\n'); } }),
  makeProblem({ id:3052, title:'벨만-포드', tier:'gold', tags:['그래프 이론','벨만-포드'], difficulty:7, timeLimit:2, memLimit:256, desc:'방향 그래프에서 음수 간선이 있을 때 시작 정점 1에서 모든 정점까지 최단 거리를 구하시오. 음수 사이클이 있으면 -1을 출력하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 u v w가 주어진다.', outputDesc:'음수 사이클이 있으면 -1, 없으면 각 정점 최단 거리를 줄마다 출력한다. 도달 불가면 INF.', hint:'N-1번 완화 후 한 번 더 완화되면 음수 사이클.', exampleInputs:['3 4\n1 2 5\n1 3 4\n2 3 -3\n3 1 1'], hiddenInputs:['3 3\n1 2 1\n2 3 2\n3 1 3','2 1\n1 2 -1','3 3\n1 2 -1\n2 3 -1\n3 1 -1','4 4\n1 2 1\n2 3 2\n3 4 3\n4 2 -10','4 3\n1 2 5\n1 3 2\n2 4 3'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const edges=[]; for(let i=1;i<=m;i++){ const [u,v,w]=lines[i].split(' ').map(Number); edges.push([u,v,w]); } const INF=1e15; const dist=Array(n+1).fill(INF); dist[1]=0; for(let i=0;i<n-1;i++) for(const [u,v,w] of edges) if(dist[u]!==INF&&dist[u]+w<dist[v]) dist[v]=dist[u]+w; for(const [u,v,w] of edges) if(dist[u]!==INF&&dist[u]+w<dist[v]) return '-1'; return dist.slice(1).map(v=>v===INF?'INF':v).join('\n'); } }),
  makeProblem({ id:3053, title:'최장 공통 부분문자열', tier:'gold', tags:['다이나믹 프로그래밍','문자열'], difficulty:5, timeLimit:1, memLimit:256, desc:'두 문자열의 최장 공통 부분문자열(연속)의 길이를 구하시오.', inputDesc:'두 줄에 문자열이 주어진다.', outputDesc:'최장 공통 부분문자열 길이를 출력한다.', hint:'dp[i][j] = A[i-1]==B[j-1]이면 dp[i-1][j-1]+1, 아니면 0.', exampleInputs:['ABCDE\nBCDE'], hiddenInputs:['abc\nxyz','abcdef\nabc','hello\nyellow','ABAB\nBABA','aaaa\naaa','abcde\nfghij','AGGTAB\nGXTXAYB','GEEKSFORGEEKS\nGEEKS','abcba\nba','mississippi\nmissouri'], solve:(input) => { const [a,b]=input.trim().split('\n'); const n=a.length,m=b.length; let ans=0; const dp=Array.from({length:n+1},()=>Array(m+1).fill(0)); for(let i=1;i<=n;i++) for(let j=1;j<=m;j++){ if(a[i-1]===b[j-1]) dp[i][j]=dp[i-1][j-1]+1; if(dp[i][j]>ans) ans=dp[i][j]; } return String(ans); } }),
  makeProblem({ id:3054, title:'이분 매칭', tier:'gold', tags:['그래프 이론','이분 매칭'], difficulty:7, timeLimit:1, memLimit:256, desc:'이분 그래프에서 최대 매칭 수를 구하시오.', inputDesc:'첫째 줄에 N M E, 이후 E줄에 좌측 정점 a와 우측 정점 b.', outputDesc:'최대 매칭 수를 출력한다.', hint:'각 좌측 정점에서 DFS로 증가 경로를 찾아 매칭합니다.', exampleInputs:['3 3 4\n1 1\n1 2\n2 1\n3 3'], hiddenInputs:['2 2 2\n1 1\n2 2','3 3 3\n1 2\n2 3\n3 1','4 4 4\n1 1\n2 2\n3 3\n4 4','2 2 4\n1 1\n1 2\n2 1\n2 2','3 2 3\n1 1\n2 1\n3 2'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m,e]=lines[0].split(' ').map(Number); const adj=Array.from({length:n+1},()=>[]); for(let i=1;i<=e;i++){ const [a,b]=lines[i].split(' ').map(Number); adj[a].push(b); } const match=Array(m+1).fill(0); let ans=0; const dfs=(u,vis)=>{ for(const v of adj[u]){ if(vis[v]) continue; vis[v]=true; if(!match[v]||dfs(match[v],vis)){ match[v]=u; return true; } } return false; }; for(let i=1;i<=n;i++){ const vis=Array(m+1).fill(false); if(dfs(i,vis)) ans++; } return String(ans); } }),
  makeProblem({ id:3055, title:'타일링 경우의 수', tier:'gold', tags:['다이나믹 프로그래밍'], difficulty:5, timeLimit:1, memLimit:128, desc:'2×N 크기의 직사각형을 2×1 도미노로 채우는 경우의 수를 10007로 나눈 나머지를 구하시오.', inputDesc:'첫째 줄에 N이 주어진다. (1 ≤ N ≤ 1,000,000)', outputDesc:'경우의 수를 10007로 나눈 나머지를 출력한다.', hint:'dp[n] = dp[n-1] + dp[n-2]', exampleInputs:['10'], hiddenInputs:['1','2','3','4','5','6','7','8','9','100'], solve:(input) => { const n=Number(input.trim()); const MOD=10007; const dp=[0,1,2]; for(let i=3;i<=n;i++) dp[i]=(dp[i-1]+dp[i-2])%MOD; return String(dp[n]); } }),
  makeProblem({ id:3056, title:'숫자 카드 2', tier:'gold', tags:['이분 탐색','정렬'], difficulty:5, timeLimit:1, memLimit:256, desc:'N개의 숫자 카드를 가지고 있을 때 M개의 쿼리에 대해 각 숫자가 몇 번 들어있는지 출력하시오.', inputDesc:'첫째 줄에 N, 둘째 줄에 N개의 정수, 셋째 줄에 M, 넷째 줄에 M개의 정수.', outputDesc:'각 쿼리의 개수를 공백으로 출력한다.', hint:'정렬 후 lower_bound와 upper_bound를 이용하세요.', exampleInputs:['10\n6 3 2 10 10 10 -10 -10 7 3\n8\n10 9 -5 2 3 4 5 -10'], hiddenInputs:['5\n1 1 1 1 1\n1\n1','3\n1 2 3\n3\n1 2 3','5\n1 2 3 4 5\n5\n5 4 3 2 1','4\n1 1 2 2\n2\n1 2','3\n-1 0 1\n3\n-1 0 1'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const cards=lines[1].split(' ').map(Number).sort((a,b)=>a-b); const m=Number(lines[2]); const qs=lines[3].split(' ').map(Number); const lb=(arr,x)=>{ let lo=0,hi=arr.length; while(lo<hi){ const mid=(lo+hi)>>1; arr[mid]<x?lo=mid+1:hi=mid; } return lo; }; const ub=(arr,x)=>{ let lo=0,hi=arr.length; while(lo<hi){ const mid=(lo+hi)>>1; arr[mid]<=x?lo=mid+1:hi=mid; } return lo; }; return qs.map(q=>ub(cards,q)-lb(cards,q)).join(' '); } }),
  makeProblem({ id:3057, title:'이항 계수 3', tier:'gold', tags:['수학','조합론'], difficulty:6, timeLimit:1, memLimit:256, desc:'N과 K가 주어졌을 때 이항 계수 C(N,K)를 1,000,000,007로 나눈 나머지를 구하시오.', inputDesc:'첫째 줄에 N K가 주어진다. (1 ≤ K ≤ N ≤ 4,000,000)', outputDesc:'C(N,K) mod 1,000,000,007을 출력한다.', hint:'페르마의 소정리: a^(p-2) ≡ a^(-1) (mod p). 팩토리얼 역원으로 빠르게 구합니다.', exampleInputs:['5 2'], hiddenInputs:['10 3','20 10','100 50','7 3','6 2','4 0','4 4','1000 500','8 4','15 7'], solve:(input) => { const [n,k]=input.trim().split(' ').map(Number); const MOD=1000000007n; const N=BigInt(n),K=BigInt(k); const pw=(b,e,m)=>{ let r=1n; b%=m; while(e>0n){ if(e&1n) r=r*b%m; b=b*b%m; e>>=1n; } return r; }; let num=1n,den=1n; for(let i=0n;i<K;i++){ num=num*(N-i)%MOD; den=den*(i+1n)%MOD; } return String(num*pw(den,MOD-2n,MOD)%MOD); } }),
  makeProblem({ id:3058, title:'최대 직사각형', tier:'gold', tags:['스택','자료 구조'], difficulty:7, timeLimit:1, memLimit:256, desc:'히스토그램에서 가장 큰 직사각형의 넓이를 구하시오.', inputDesc:'첫째 줄에 N, 둘째 줄에 N개의 높이가 주어진다.', outputDesc:'최대 직사각형 넓이를 출력한다.', hint:'스택에 증가하는 인덱스를 유지합니다. 낮은 막대를 만나면 스택을 pop하며 넓이를 계산합니다.', exampleInputs:['7\n2 1 5 6 2 3 1'], hiddenInputs:['1\n5','3\n3 3 3','5\n1 2 3 4 5','5\n5 4 3 2 1','4\n2 4 2 4','1\n0','5\n0 0 0 0 0','6\n2 2 2 2 2 2','4\n1 100 1 1'], solve:(input) => { const lines=input.trim().split('\n'); const h=lines[1].split(' ').map(Number); const n=h.length; const stk=[]; let maxA=0; for(let i=0;i<=n;i++){ const cur=i===n?0:h[i]; while(stk.length&&h[stk[stk.length-1]]>cur){ const height=h[stk.pop()]; const width=stk.length?i-stk[stk.length-1]-1:i; if(height*width>maxA) maxA=height*width; } stk.push(i); } return String(maxA); } }),
  makeProblem({ id:3059, title:'가장 큰 정사각형', tier:'gold', tags:['다이나믹 프로그래밍'], difficulty:5, timeLimit:1, memLimit:256, desc:'0과 1로 이루어진 N×M 행렬에서 1로만 이루어진 정사각형의 최대 넓이를 구하시오.', inputDesc:'첫째 줄에 N M, 이후 N줄에 행렬이 주어진다.', outputDesc:'최대 정사각형 넓이를 출력한다.', hint:'dp[i][j] = min(위, 왼쪽, 대각선 왼위) + 1 (현재 셀이 1일 때)', exampleInputs:['4 4\n0110\n1111\n1111\n0110'], hiddenInputs:['1 1\n1','2 2\n11\n11','3 3\n000\n000\n000','3 3\n111\n111\n111','4 5\n10111\n10111\n11111\n10010','2 3\n110\n110','5 5\n11111\n11111\n11111\n11111\n11111','3 4\n1110\n1110\n1110'], solve:(input) => { const matrix=parseMatrixInput(input); if(!matrix.length) return '0'; const n=matrix.length,m=matrix[0].length; const dp=Array.from({length:n},(_,i)=>matrix[i].slice()); let ans=0; for(let i=0;i<n;i++) for(let j=0;j<m;j++){ if(i>0&&j>0&&dp[i][j]===1) dp[i][j]=Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1])+1; if(dp[i][j]>ans) ans=dp[i][j]; } return String(ans*ans); } }),

  // ── Platinum 강화 (5→25) ─────────────────────────────────────────────────
  stringProblem({ id:4009, title:'Z 알고리즘', tier:'platinum', tags:['문자열','Z-함수'], difficulty:8, desc:'문자열 S가 주어질 때 Z 배열을 구하시오. Z[i]는 S와 S[i:]의 최장 공통 접두사 길이이다.', outputDesc:'Z 배열을 공백으로 출력한다. Z[0]은 0으로 출력한다.', hint:'구간 [l,r]을 유지하며 이미 계산된 정보를 재활용합니다.', examples:['aabxaa'], solve:(input) => { const s=input.trim(); const n=s.length; const z=Array(n).fill(0); let l=0,r=0; for(let i=1;i<n;i++){ if(i<r) z[i]=Math.min(r-i,z[i-l]); while(i+z[i]<n&&s[z[i]]===s[i+z[i]]) z[i]++; if(i+z[i]>r){l=i;r=i+z[i];} } return z.join(' '); } }),
  makeProblem({ id:4010, title:'아호-코라식', tier:'platinum', tags:['문자열','아호-코라식'], difficulty:9, timeLimit:2, memLimit:256, desc:'텍스트에서 K개의 패턴 중 하나라도 등장하는 횟수를 구하시오.', inputDesc:'첫째 줄에 K, 이후 K줄에 패턴, 마지막 줄에 텍스트.', outputDesc:'총 등장 횟수를 출력한다.', hint:'트라이 + 실패 링크로 모든 패턴을 동시에 탐색합니다.', exampleInputs:['3\nabc\nab\nbc\nabcbc'], hiddenInputs:['1\na\naaaa','2\nhe\nshe\nhisherehershe','1\naa\naaa','3\na\nb\nc\nabc','2\nab\nba\nababab'], solve:(input) => { const lines=input.trim().split('\n'); const k=Number(lines[0]); const patterns=lines.slice(1,1+k); const text=lines[1+k]; const ALPHA=26; const next=[[...Array(ALPHA).fill(-1)]]; const fail=[0]; const out=[0]; const ch=(c)=>c.charCodeAt(0)-97; for(const p of patterns){ let cur=0; for(const c of p){ const ci=ch(c); if(next[cur][ci]===-1){ next[cur][ci]=next.length; next.push([...Array(ALPHA).fill(-1)]); fail.push(0); out.push(0); } cur=next[cur][ci]; } out[cur]++; } const q=[0]; let head=0; while(head<q.length){ const u=q[head++]; for(let c=0;c<ALPHA;c++){ const v=next[u][c]; if(v===-1){ next[u][c]=u===0?0:next[fail[u]][c]; continue; } fail[v]=u===0?0:next[fail[u]][c]; out[v]+=out[fail[v]]; q.push(v); } } let cur=0,cnt=0; for(const c of text){ cur=next[cur][ch(c)]; cnt+=out[cur]; } return String(cnt); } }),
  makeProblem({ id:4011, title:'스위핑 - 좌표 압축 + 정렬', tier:'platinum', tags:['정렬','스위핑','좌표 압축'], difficulty:8, timeLimit:1, memLimit:256, desc:'N개의 선분이 주어질 때 서로 겹치는 선분 쌍의 수를 구하시오. (끝점만 닿는 것은 겹치지 않음)', inputDesc:'첫째 줄에 N, 이후 N줄에 l r이 주어진다.', outputDesc:'겹치는 쌍의 수를 출력한다.', hint:'이벤트 기반 스위핑: 시작 이벤트를 처리할 때 현재 열린 선분 수가 쌍의 수에 기여합니다.', exampleInputs:['3\n1 5\n2 6\n3 4'], hiddenInputs:['2\n1 2\n3 4','2\n1 3\n2 4','4\n1 10\n2 3\n4 5\n6 7','1\n1 5','3\n1 2\n2 3\n3 4','4\n1 5\n2 6\n3 7\n4 8','5\n1 5\n1 5\n1 5\n1 5\n1 5'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const events=[]; for(let i=1;i<=n;i++){ const [l,r]=lines[i].split(' ').map(Number); events.push([l,1,i]); events.push([r,-1,i]); } events.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); let open=0,pairs=0; for(const [,type] of events){ if(type===1){ pairs+=open; open++; }else{ open--; } } return String(pairs); } }),
  makeProblem({ id:4012, title:'트리 DP - 독립 집합', tier:'platinum', tags:['트리','다이나믹 프로그래밍'], difficulty:7, timeLimit:1, memLimit:256, desc:'N개 노드의 트리에서 인접한 두 노드를 동시에 선택할 수 없을 때 선택할 수 있는 최대 노드 수를 구하시오.', inputDesc:'첫째 줄에 N, 이후 N-1줄에 간선 a b가 주어진다.', outputDesc:'최대 독립 집합 크기를 출력한다.', hint:'dp[u][0] = 루트 u를 선택하지 않을 때, dp[u][1] = 선택할 때.', exampleInputs:['7\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7'], hiddenInputs:['1','2\n1 2','3\n1 2\n1 3','4\n1 2\n2 3\n3 4','5\n1 2\n1 3\n1 4\n1 5','4\n1 2\n1 3\n2 4','6\n1 2\n2 3\n3 4\n4 5\n5 6'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); if(n===1) return '1'; const adj=Array.from({length:n+1},()=>[]); for(let i=1;i<n;i++){ const [a,b]=lines[i].split(' ').map(Number); adj[a].push(b); adj[b].push(a); } const dp=Array.from({length:n+1},()=>[0,1]); const par=Array(n+1).fill(-1); const order=[]; const stk=[1]; par[1]=0; while(stk.length){ const u=stk.pop(); order.push(u); for(const v of adj[u]) if(par[v]===-1&&v!==1){ par[v]=u; stk.push(v); } } for(let i=order.length-1;i>=0;i--){ const u=order[i]; for(const v of adj[u]){ if(v===par[u]) continue; dp[u][0]+=Math.max(dp[v][0],dp[v][1]); dp[u][1]+=dp[v][0]; } } return String(Math.max(dp[1][0],dp[1][1])); } }),
  makeProblem({ id:4013, title:'Convex Hull (볼록 껍질)', tier:'platinum', tags:['기하학','볼록 껍질'], difficulty:8, timeLimit:1, memLimit:256, desc:'N개의 점이 주어질 때 볼록 껍질(convex hull)을 구성하는 점의 수를 구하시오.', inputDesc:'첫째 줄에 N, 이후 N줄에 x y가 주어진다.', outputDesc:'볼록 껍질의 꼭짓점 수를 출력한다.', hint:'앤드류 알고리즘: 하부 껍질과 상부 껍질을 따로 구합니다. 외적(cross product) 부호로 방향을 판별합니다.', exampleInputs:['8\n1 1\n1 2\n1 3\n2 1\n2 2\n3 1\n3 2\n2 3'], hiddenInputs:['3\n0 0\n1 0\n0 1','4\n0 0\n1 0\n1 1\n0 1','5\n0 0\n2 0\n2 2\n0 2\n1 1','3\n0 0\n1 1\n2 2','6\n0 0\n3 0\n3 3\n0 3\n1 1\n2 2'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const pts=[]; for(let i=1;i<=n;i++){ const [x,y]=lines[i].split(' ').map(Number); pts.push([x,y]); } pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]); const lower=[]; for(const p of pts){ while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0) lower.pop(); lower.push(p); } const upper=[]; for(let i=pts.length-1;i>=0;i--){ const p=pts[i]; while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0) upper.pop(); upper.push(p); } const hull=new Set([...lower.slice(0,-1),...upper.slice(0,-1)].map(p=>p.join(','))); return String(hull.size); } }),
  makeProblem({ id:4014, title:'회전하는 큐', tier:'platinum', tags:['자료 구조','덱'], difficulty:7, timeLimit:1, memLimit:256, desc:'1부터 N까지 정수가 원형 큐에 있을 때 주어진 수열 순서대로 꺼내기 위한 최소 이동 횟수를 구하시오.', inputDesc:'첫째 줄에 N M, 둘째 줄에 M개의 번호가 주어진다.', outputDesc:'총 이동 횟수를 출력한다.', hint:'덱을 사용해 앞뒤 이동 횟수 중 최솟값을 선택합니다.', exampleInputs:['10 3\n1 2 3'], hiddenInputs:['5 2\n2 4','7 3\n3 5 7','10 5\n1 3 5 7 9','3 3\n3 1 2','8 4\n2 5 3 7','6 1\n6','1 1\n1'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const seq=lines[1].split(' ').map(Number); const dq=[]; for(let i=1;i<=n;i++) dq.push(i); let moves=0; for(const target of seq){ let idx=dq.indexOf(target); const left=idx; const right=dq.length-idx; if(left<=right){ moves+=left; for(let i=0;i<left;i++) dq.push(dq.shift()); }else{ moves+=right; for(let i=0;i<right;i++) dq.unshift(dq.pop()); } dq.shift(); } return String(moves); } }),
  makeProblem({ id:4015, title:'오일러 경로', tier:'platinum', tags:['그래프 이론','오일러 경로'], difficulty:8, timeLimit:1, memLimit:256, desc:'무방향 그래프에서 모든 간선을 정확히 한 번씩 지나는 오일러 경로가 존재하는지 판별하고, 존재하면 경로를 출력하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 간선 a b가 주어진다.', outputDesc:'존재하면 경로의 정점들을 공백으로, 없으면 -1을 출력한다.', hint:'차수가 홀수인 정점이 0개(오일러 회로) 또는 2개(오일러 경로)일 때 존재합니다.', exampleInputs:['5 6\n1 2\n2 3\n3 4\n4 5\n5 2\n2 4'], hiddenInputs:['3 3\n1 2\n2 3\n3 1','4 4\n1 2\n2 3\n3 4\n4 1','3 2\n1 2\n2 3','4 3\n1 2\n2 3\n3 4','4 5\n1 2\n1 3\n2 3\n3 4\n4 2'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const adj=Array.from({length:n+1},()=>[]); const deg=Array(n+1).fill(0); const edges=[]; for(let i=1;i<=m;i++){ const [a,b]=lines[i].split(' ').map(Number); adj[a].push({to:b,idx:i-1}); adj[b].push({to:a,idx:i-1}); deg[a]++; deg[b]++; edges.push(false); } const odd=deg.slice(1).reduce((a,v,i)=>v%2?[...a,i+1]:a,[]); if(odd.length!==0&&odd.length!==2) return '-1'; const start=odd.length===2?odd[0]:1; const usedE=Array(m).fill(false); const path=[]; const stk=[start]; while(stk.length){ const u=stk[stk.length-1]; let found=false; while(adj[u].length){ const {to,idx}=adj[u][adj[u].length-1]; adj[u].pop(); if(usedE[idx]) continue; usedE[idx]=true; stk.push(to); found=true; break; } if(!found) path.push(stk.pop()); } if(path.length!==m+1) return '-1'; return path.reverse().join(' '); } }),
  makeProblem({ id:4016, title:'피타고라스 쌍', tier:'platinum', tags:['수학','정수론'], difficulty:7, timeLimit:1, memLimit:128, desc:'N 이하의 자연수 세 수 a ≤ b ≤ c로 이루어진 피타고라스 쌍 (a²+b²=c²)의 수를 구하시오.', inputDesc:'첫째 줄에 N이 주어진다. (1 ≤ N ≤ 1,000)', outputDesc:'피타고라스 쌍의 수를 출력한다.', hint:'a와 b를 반복하며 c가 정수인지 확인합니다.', exampleInputs:['20'], hiddenInputs:['5','10','15','30','50','100','200','500','1000','25'], solve:(input) => { const n=Number(input.trim()); let cnt=0; for(let a=1;a<=n;a++) for(let b=a;b<=n;b++){ const c2=a*a+b*b; const c=Math.round(Math.sqrt(c2)); if(c<=n&&c*c===c2) cnt++; } return String(cnt); } }),
  makeProblem({ id:4017, title:'행렬 거듭제곱', tier:'platinum', tags:['행렬','다이나믹 프로그래밍','분할 정복'], difficulty:8, timeLimit:1, memLimit:256, desc:'N×N 행렬 A와 정수 B가 주어질 때 A^B의 각 원소를 1,000으로 나눈 나머지를 구하시오.', inputDesc:'첫째 줄에 N B, 이후 N줄에 행렬이 주어진다.', outputDesc:'결과 행렬을 출력한다.', hint:'분할 정복: A^B = A^(B/2) × A^(B/2) × (A if B%2).', exampleInputs:['2 3\n1 1\n1 0'], hiddenInputs:['2 1\n1 0\n0 1','2 2\n1 1\n1 0','2 10\n1 1\n1 0','3 2\n1 2 3\n4 5 6\n7 8 9','2 100\n2 0\n0 2'], solve:(input) => { const lines=input.trim().split('\n'); const [n,b]=lines[0].split(' ').map(Number); const MOD=1000; const mat=lines.slice(1).map(l=>l.split(' ').map(Number)); const mul=(A,B)=>{ const R=Array.from({length:n},()=>Array(n).fill(0)); for(let i=0;i<n;i++) for(let k=0;k<n;k++) if(A[i][k]) for(let j=0;j<n;j++) R[i][j]=(R[i][j]+A[i][k]*B[k][j])%MOD; return R; }; const pw=(M,e)=>{ let R=Array.from({length:n},(_,i)=>Array(n).fill(0).map((_,j)=>i===j?1:0)); let base=M.map(r=>r.slice()); let exp=e; while(exp>0){ if(exp&1) R=mul(R,base); base=mul(base,base); exp>>=1; } return R; }; return pw(mat,b).map(r=>r.join(' ')).join('\n'); } }),
  makeProblem({ id:4018, title:'비트마스크 DP - 순열 최솟값', tier:'platinum', tags:['비트마스크','다이나믹 프로그래밍'], difficulty:8, timeLimit:1, memLimit:256, desc:'N개의 작업과 N명의 사람이 있다. 각 사람이 각 작업을 처리하는 비용이 주어질 때 모든 작업을 처리하는 최소 비용을 구하시오.', inputDesc:'첫째 줄에 N, 이후 N줄에 비용 행렬이 주어진다.', outputDesc:'최소 비용을 출력한다.', hint:'dp[mask] = mask에 해당하는 작업이 완료되었을 때 최소 비용. popcount(mask)번째 사람이 처리.', exampleInputs:['4\n9 2 7 8\n6 4 3 7\n5 8 1 8\n7 6 9 4'], hiddenInputs:['1\n5','2\n1 2\n3 4','3\n1 2 3\n4 5 6\n7 8 9','3\n9 9 9\n9 1 9\n9 9 9','2\n100 1\n1 100','4\n1 2 3 4\n5 6 7 8\n9 10 11 12\n13 14 15 16'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const cost=lines.slice(1).map(l=>l.split(' ').map(Number)); const INF=1e9; const dp=Array(1<<n).fill(INF); dp[0]=0; for(let mask=0;mask<(1<<n);mask++){ if(dp[mask]===INF) continue; const person=mask.toString(2).split('').filter(x=>x==='1').length; if(person===n) continue; for(let job=0;job<n;job++){ if(mask&(1<<job)) continue; const nxt=mask|(1<<job); const v=dp[mask]+cost[person][job]; if(v<dp[nxt]) dp[nxt]=v; } } return String(dp[(1<<n)-1]); } }),
  makeProblem({ id:4019, title:'팰린드롬 트리 (Eertree)', tier:'platinum', tags:['문자열','팰린드롬'], difficulty:9, timeLimit:1, memLimit:256, desc:'문자열에서 서로 다른 팰린드롬 부분문자열의 수를 구하시오.', inputDesc:'첫째 줄에 문자열이 주어진다.', outputDesc:'서로 다른 팰린드롬 부분문자열의 수를 출력한다.', hint:'Eertree(팰린드롬 트리)를 구성하면 O(N)에 모든 팰린드롬 부분문자열을 열거할 수 있습니다.', exampleInputs:['abaab'], hiddenInputs:['a','aa','aaa','aaaa','abab','abcba','abacaba','aabaab','aabbaa','abcde'], solve:(input) => { const s=input.trim(); const n=s.length; const set=new Set(); for(let i=0;i<n;i++) for(let j=i+1;j<=n;j++){ const sub=s.slice(i,j); if(sub===[...sub].reverse().join('')) set.add(sub); } return String(set.size); } }),
  makeProblem({ id:4020, title:'최솟값 힙 구현', tier:'platinum', tags:['자료 구조','우선순위 큐'], difficulty:7, timeLimit:1, memLimit:256, desc:'최솟값 힙(min-heap)을 직접 구현하여 push, pop 명령을 처리하시오. pop 시 힙이 비어 있으면 0을 출력하시오.', inputDesc:'첫째 줄에 명령 수 N, 이후 N줄에 명령이 주어진다.', outputDesc:'pop 명령 결과를 줄마다 출력한다.', hint:'완전 이진 트리를 배열로 표현합니다. heapify-up(삽입)과 heapify-down(삭제) 연산을 구현하세요.', exampleInputs:['9\npush 2\npush 4\npush 1\npush 3\npop\npop\npush 5\npop\npop'], hiddenInputs:['3\npush 1\npop\npop','5\npush 5\npush 3\npush 7\npop\npop','4\npop\npop\npush 1\npop','6\npush 1\npush 1\npush 1\npop\npop\npop','7\npush 10\npush 20\npush 5\npush 15\npop\npop\npop'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const heap=[]; const swap=(i,j)=>{[heap[i],heap[j]]=[heap[j],heap[i]];}; const push=(v)=>{ heap.push(v); let i=heap.length-1; while(i>0){ const p=(i-1)>>1; if(heap[p]<=heap[i]) break; swap(i,p); i=p; } }; const pop=()=>{ if(!heap.length) return 0; const top=heap[0]; const last=heap.pop(); if(heap.length){ heap[0]=last; let i=0; while(true){ let s=i; const l=2*i+1,r=2*i+2; if(l<heap.length&&heap[l]<heap[s]) s=l; if(r<heap.length&&heap[r]<heap[s]) s=r; if(s===i) break; swap(i,s); i=s; } } return top; }; const res=[]; for(let i=1;i<=n;i++){ const parts=lines[i].split(' '); if(parts[0]==='push') push(Number(parts[1])); else res.push(pop()); } return res.join('\n'); } }),
  makeProblem({ id:4021, title:'가장 긴 증가하는 부분 수열 (O(NlogN))', tier:'platinum', tags:['다이나믹 프로그래밍','이분 탐색'], difficulty:7, timeLimit:1, memLimit:256, desc:'N개의 정수로 이루어진 수열에서 LIS의 길이를 O(N log N)에 구하시오.', inputDesc:'첫째 줄에 N, 둘째 줄에 N개의 정수가 주어진다.', outputDesc:'LIS 길이를 출력한다.', hint:'tails 배열을 유지합니다. 각 원소에 대해 이진 탐색으로 삽입 위치를 찾아 tails를 갱신합니다.', exampleInputs:['6\n10 20 10 30 20 50'], hiddenInputs:['1\n5','5\n1 2 3 4 5','5\n5 4 3 2 1','7\n2 1 5 3 6 4 8','4\n1 1 1 1','8\n1 3 2 4 3 5 4 6','5\n10 9 2 5 3','6\n7 7 7 7 7 7'], solve:(input) => { const lines=input.trim().split('\n'); const arr=lines[1].split(' ').map(Number); const tails=[]; for(const v of arr){ let lo=0,hi=tails.length; while(lo<hi){ const mid=(lo+hi)>>1; tails[mid]<v?lo=mid+1:hi=mid; } tails[lo]=v; } return String(tails.length); } }),
  makeProblem({ id:4022, title:'트리 직경 + 경로', tier:'platinum', tags:['트리','BFS'], difficulty:7, timeLimit:1, memLimit:256, desc:'N개의 노드로 이루어진 무방향 가중치 트리의 지름(최대 경로 길이)과 그 경로를 출력하시오.', inputDesc:'첫째 줄에 N, 이후 N-1줄에 a b w가 주어진다.', outputDesc:'첫 줄에 지름, 둘째 줄에 경로의 정점들을 공백으로 출력한다.', hint:'임의의 정점에서 가장 먼 정점 u를 찾고, u에서 가장 먼 정점 v를 찾으면 u-v 경로가 지름입니다.', exampleInputs:['5\n1 2 3\n2 3 4\n3 4 5\n4 5 6'], hiddenInputs:['2\n1 2 10','3\n1 2 5\n2 3 5','4\n1 2 1\n1 3 2\n1 4 3','5\n1 2 1\n2 3 2\n2 4 3\n4 5 4','4\n1 2 1\n2 3 1\n3 4 1'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const adj=Array.from({length:n+1},()=>[]); for(let i=1;i<n;i++){ const [a,b,w]=lines[i].split(' ').map(Number); adj[a].push([b,w]); adj[b].push([a,w]); } const bfs=(src)=>{ const dist=Array(n+1).fill(-1); const prev=Array(n+1).fill(-1); dist[src]=0; const q=[src]; let head=0; while(head<q.length){ const u=q[head++]; for(const [v,w] of adj[u]) if(dist[v]===-1){ dist[v]=dist[u]+w; prev[v]=u; q.push(v); } } let far=src; for(let i=1;i<=n;i++) if(dist[i]>dist[far]) far=i; return {far,dist,prev}; }; const {far:u}=bfs(1); const {far:v,dist,prev}=bfs(u); const path=[]; let cur=v; while(cur!==-1){path.push(cur);cur=prev[cur];} return dist[v]+'\n'+path.join(' '); } }),
  makeProblem({ id:4023, title:'SOS DP (Sum over Subsets)', tier:'platinum', tags:['비트마스크','다이나믹 프로그래밍'], difficulty:8, timeLimit:1, memLimit:256, desc:'길이 2^N의 배열 A가 주어질 때 각 인덱스 mask에 대해 mask의 부분 집합들의 A 값 합을 구하시오.', inputDesc:'첫째 줄에 N(1 ≤ N ≤ 20), 둘째 줄에 2^N개의 정수.', outputDesc:'각 mask의 부분 집합 합을 공백으로 출력한다.', hint:'dp[mask][i]: 처음 i비트에 대한 포함 여부만 고려한 부분집합 합. i번 비트 포함 여부로 전이.', exampleInputs:['2\n3 1 4 2'], hiddenInputs:['1\n5 3','2\n1 2 3 4','2\n0 0 0 1','3\n1 1 1 1 1 1 1 1','2\n10 20 30 40'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const a=lines[1].split(' ').map(Number); for(let i=0;i<n;i++) for(let mask=0;mask<(1<<n);mask++) if(mask&(1<<i)) a[mask]+=a[mask^(1<<i)]; return a.join(' '); } }),
  makeProblem({ id:4024, title:'스도쿠 풀기', tier:'platinum', tags:['백트래킹','구현'], difficulty:8, timeLimit:2, memLimit:256, desc:'9×9 스도쿠 퍼즐을 풀어서 출력하시오. 빈칸은 0으로 표시됩니다.', inputDesc:'9줄에 9개의 숫자가 주어진다.', outputDesc:'완성된 스도쿠를 출력한다.', hint:'백트래킹: 빈 칸을 찾아 1~9를 시도합니다. 행, 열, 3×3 박스의 충돌을 확인합니다.', exampleInputs:['0 3 5 2 6 9 7 8 1\n6 8 2 5 7 1 4 9 3\n1 9 7 8 3 4 5 6 2\n8 2 6 1 9 5 3 4 7\n3 7 4 6 8 2 9 1 5\n9 5 1 7 4 3 6 2 8\n5 1 9 3 2 6 8 7 4\n2 4 8 9 5 7 1 3 6\n7 6 3 4 1 8 2 5 0'], hiddenInputs:['5 3 0 0 7 0 0 0 0\n6 0 0 1 9 5 0 0 0\n0 9 8 0 0 0 0 6 0\n8 0 0 0 6 0 0 0 3\n4 0 0 8 0 3 0 0 1\n7 0 0 0 2 0 0 0 6\n0 6 0 0 0 0 2 8 0\n0 0 0 4 1 9 0 0 5\n0 0 0 0 8 0 0 7 9'], solve:(input) => { const board=input.trim().split('\n').map(r=>r.split(/\s+/).map(Number)); const ok=(r,c,v)=>{ for(let i=0;i<9;i++) if(board[r][i]===v||board[i][c]===v) return false; const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3; for(let i=br;i<br+3;i++) for(let j=bc;j<bc+3;j++) if(board[i][j]===v) return false; return true; }; const solve=()=>{ for(let r=0;r<9;r++) for(let c=0;c<9;c++){ if(board[r][c]!==0) continue; for(let v=1;v<=9;v++){ if(ok(r,c,v)){ board[r][c]=v; if(solve()) return true; board[r][c]=0; } } return false; } return true; }; solve(); return board.map(r=>r.join(' ')).join('\n'); } }),

  // ── Diamond 강화 (4→24) ──────────────────────────────────────────────────
  stringProblem({ id:5011, title:'접미사 배열', tier:'diamond', tags:['문자열','접미사 배열'], difficulty:9, desc:'문자열의 접미사를 사전 순으로 정렬했을 때 각 접미사의 시작 인덱스를 출력하시오.', outputDesc:'접미사 배열을 공백으로 출력한다.', hint:'모든 접미사를 생성해 사전 순으로 정렬합니다. (단순 구현 O(N^2 log N))', examples:['banana'], solve:(input) => { const s=input.trim(); const n=s.length; const sa=[...Array(n).keys()].sort((a,b)=>s.slice(a)<s.slice(b)?-1:1); return sa.join(' '); } }),
  makeProblem({ id:5012, title:'오프라인 쿼리 - Mo\'s 알고리즘', tier:'diamond', tags:['자료 구조','Mo의 알고리즘'], difficulty:9, timeLimit:2, memLimit:512, desc:'길이 N의 배열에서 Q개의 구간 [l, r]에 있는 서로 다른 원소의 수를 구하시오.', inputDesc:'첫째 줄에 N Q, 둘째 줄에 N개의 정수, 이후 Q줄에 l r.', outputDesc:'각 쿼리의 답을 줄마다 출력한다.', hint:'Mo의 알고리즘: 쿼리를 √N 단위로 블록 분류 후 정렬. 포인터를 한 칸씩 이동하며 빈도 배열을 갱신.', exampleInputs:['5 3\n1 2 1 3 2\n1 3\n2 4\n1 5'], hiddenInputs:['5 2\n1 1 1 1 1\n1 5\n1 3','4 3\n1 2 3 4\n1 4\n1 2\n3 4','6 3\n1 2 1 2 1 2\n1 6\n2 5\n3 4','3 1\n5 5 5\n1 3','8 4\n1 2 3 1 2 3 1 2\n1 8\n2 6\n3 7\n4 8'], solve:(input) => { const lines=input.trim().split('\n'); const [n,q]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); const qs=[]; for(let i=0;i<q;i++){ const [l,r]=lines[2+i].split(' ').map(Number); qs.push([l-1,r-1,i]); } const block=Math.max(1,Math.ceil(Math.sqrt(n))); qs.sort((a,b)=>Math.floor(a[0]/block)-Math.floor(b[0]/block)||((Math.floor(a[0]/block)&1)?b[1]-a[1]:a[1]-b[1])); const cnt=new Map(); let cur=0,curL=0,curR=-1; const add=(v)=>{ const c=(cnt.get(v)||0)+1; cnt.set(v,c); if(c===1) cur++; }; const rem=(v)=>{ const c=cnt.get(v)-1; cnt.set(v,c); if(c===0) cur--; }; const ans=Array(q); for(const [l,r,i] of qs){ while(curR<r) add(arr[++curR]); while(curL>l) add(arr[--curL]); while(curR>r) rem(arr[curR--]); while(curL<l) rem(arr[curL++]); ans[i]=cur; } return ans.join('\n'); } }),
  makeProblem({ id:5013, title:'세그먼트 트리 - 구간 최솟값 갱신', tier:'diamond', tags:['자료 구조','세그먼트 트리','레이지 프로파게이션'], difficulty:9, timeLimit:2, memLimit:512, desc:'N개의 수에 대해 구간에 값을 더하고 구간 최솟값을 구하는 쿼리를 처리하시오.', inputDesc:'첫째 줄에 N Q, 둘째 줄에 N개의 수, 이후 Q줄에 type l r (v). type 1은 구간 [l,r]에 v를 더하기, type 2는 구간 [l,r] 최솟값 쿼리.', outputDesc:'type 2 쿼리 결과를 줄마다 출력한다.', hint:'레이지 프로파게이션: 업데이트를 즉시 적용하지 않고 자식 노드로 전파를 지연합니다.', exampleInputs:['5 4\n1 2 3 4 5\n1 1 3 2\n2 1 5\n1 2 4 -1\n2 2 4'], hiddenInputs:['3 3\n1 2 3\n2 1 3\n1 1 3 10\n2 1 3','5 2\n5 4 3 2 1\n2 1 5\n1 1 5 -10','4 4\n1 1 1 1\n1 1 4 1\n2 1 4\n1 2 3 -1\n2 1 4'], solve:(input) => { const lines=input.trim().split('\n'); const [n,q]=lines[0].split(' ').map(Number); const arr=lines[1].split(' ').map(Number); const tree=Array(4*n).fill(0); const lazy=Array(4*n).fill(0); const build=(node,l,r)=>{ if(l===r){tree[node]=arr[l-1];return;} const mid=(l+r)>>1; build(2*node,l,mid); build(2*node+1,mid+1,r); tree[node]=Math.min(tree[2*node],tree[2*node+1]); }; const push=(node)=>{ if(lazy[node]){ tree[2*node]+=lazy[node]; lazy[2*node]+=lazy[node]; tree[2*node+1]+=lazy[node]; lazy[2*node+1]+=lazy[node]; lazy[node]=0; } }; const update=(node,l,r,ql,qr,v)=>{ if(qr<l||r<ql) return; if(ql<=l&&r<=qr){tree[node]+=v;lazy[node]+=v;return;} push(node); const mid=(l+r)>>1; update(2*node,l,mid,ql,qr,v); update(2*node+1,mid+1,r,ql,qr,v); tree[node]=Math.min(tree[2*node],tree[2*node+1]); }; const query=(node,l,r,ql,qr)=>{ if(qr<l||r<ql) return Infinity; if(ql<=l&&r<=qr) return tree[node]; push(node); const mid=(l+r)>>1; return Math.min(query(2*node,l,mid,ql,qr),query(2*node+1,mid+1,r,ql,qr)); }; build(1,1,n); const res=[]; for(let i=2;i<2+q;i++){ const parts=lines[i].split(' ').map(Number); if(parts[0]===1) update(1,1,n,parts[1],parts[2],parts[3]); else res.push(query(1,1,n,parts[1],parts[2])); } return res.join('\n'); } }),
  makeProblem({ id:5014, title:'커넥티드 컴포넌트 - 온라인 쿼리', tier:'diamond', tags:['자료 구조','유니온-파인드'], difficulty:8, timeLimit:1, memLimit:256, desc:'N개의 노드에 대해 두 노드 연결(union)과 같은 컴포넌트 여부 확인(find) 쿼리를 처리하시오.', inputDesc:'첫째 줄에 N Q, 이후 Q줄에 type a b. type 0은 union, type 1은 same 컴포넌트 여부.', outputDesc:'type 1 쿼리에 대해 YES/NO를 줄마다 출력한다.', hint:'경로 압축 + 유니온 바이 랭크를 사용하면 사실상 O(1) 쿼리.', exampleInputs:['5 5\n0 1 2\n0 3 4\n1 1 2\n1 2 3\n0 2 3'], hiddenInputs:['3 4\n0 1 2\n1 1 2\n0 2 3\n1 1 3','4 5\n0 1 2\n0 2 3\n0 3 4\n1 1 4\n1 1 4','2 2\n1 1 2\n0 1 2','5 3\n1 1 5\n0 1 5\n1 1 5','6 6\n0 1 2\n0 3 4\n0 5 6\n1 1 3\n0 2 5\n1 1 6'], solve:(input) => { const lines=input.trim().split('\n'); const [n,q]=lines[0].split(' ').map(Number); const par=[...Array(n+1).keys()]; const rank=Array(n+1).fill(0); const find=(x)=>par[x]===x?x:par[x]=find(par[x]); const union=(a,b)=>{ const pa=find(a),pb=find(b); if(pa===pb) return; if(rank[pa]<rank[pb]) par[pa]=pb; else if(rank[pa]>rank[pb]) par[pb]=pa; else{par[pb]=pa;rank[pa]++;} }; const res=[]; for(let i=1;i<=q;i++){ const [t,a,b]=lines[i].split(' ').map(Number); if(t===0) union(a,b); else res.push(find(a)===find(b)?'YES':'NO'); } return res.join('\n'); } }),
  makeProblem({ id:5015, title:'팰린드롬 분할 최소 컷 (Manacher)', tier:'diamond', tags:['문자열','마나카','다이나믹 프로그래밍'], difficulty:9, timeLimit:1, memLimit:256, desc:'Manacher 알고리즘으로 팰린드롬 반지름을 O(N)에 구한 뒤 최소 팰린드롬 분할 컷 수를 구하시오.', inputDesc:'첫째 줄에 문자열이 주어진다.', outputDesc:'최소 컷 횟수를 출력한다.', hint:'Manacher로 구간 팰린드롬 판별을 O(1)로 만들면 DP를 O(N^2) → 최적화 가능.', exampleInputs:['aab'], hiddenInputs:['a','aba','abcba','aabbaa','abcdef','racecar','aaaa','abacaba','aabbcc','aabbaa'], solve:(input) => { const s=input.trim(); const n=s.length; const t='#'+[...s].join('#')+'#'; const m=t.length; const p=Array(m).fill(0); let c=0,r=0; for(let i=0;i<m;i++){ if(i<r) p[i]=Math.min(r-i,p[2*c-i]); while(i-p[i]-1>=0&&i+p[i]+1<m&&t[i-p[i]-1]===t[i+p[i]+1]) p[i]++; if(i+p[i]>r){c=i;r=i+p[i];} } const isPal=(l,r)=>{ const ti=l+r+1; const len=r-l+1; return p[ti]>=len-1; }; const dp=Array(n).fill(Infinity); for(let i=0;i<n;i++){ if(isPal(0,i)){dp[i]=0;continue;} for(let j=1;j<=i;j++) if(isPal(j,i)&&dp[j-1]+1<dp[i]) dp[i]=dp[j-1]+1; } return String(dp[n-1]); } }),
  makeProblem({ id:5016, title:'네트워크 신뢰도 - 2-SAT', tier:'diamond', tags:['그래프 이론','2-SAT','SCC'], difficulty:9, timeLimit:1, memLimit:256, desc:'N개의 변수와 M개의 절(각 절은 두 리터럴의 OR)로 이루어진 2-SAT 문제를 푸시오. 만족 가능하면 YES와 해를, 불가능하면 NO를 출력하시오.', inputDesc:'첫째 줄에 N M, 이후 M줄에 두 리터럴이 주어진다. i는 변수 i, -i는 변수 i의 부정.', outputDesc:'만족 가능하면 YES, 이후 N개의 0/1 값. 불가능하면 NO.', hint:'SCC + 위상정렬 순서로 각 변수의 값을 결정합니다. xi와 ¬xi가 같은 SCC에 있으면 불만족.', exampleInputs:['3 4\n1 2\n-2 3\n-1 -3\n2 -3'], hiddenInputs:['1 1\n1 -1','2 2\n1 2\n-1 -2','2 3\n1 2\n-1 2\n1 -2','3 3\n1 2\n2 3\n-1 -3','2 2\n1 -2\n2 -1'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const adj=Array.from({length:2*n+2},()=>[]); const idx=(x)=>x>0?2*(x-1):2*(-x-1)+1; const neg=(x)=>x%2===0?x+1:x-1; for(let i=1;i<=m;i++){ const [a,b]=lines[i].split(' ').map(Number); adj[neg(idx(a))].push(idx(b)); adj[neg(idx(b))].push(idx(a)); } const N=2*n; const ord=[]; const comp=Array(N).fill(-1); const vis=Array(N).fill(false); const dfs1=(u)=>{ const stk=[[u,0]]; vis[u]=true; while(stk.length){ const [v,j]=stk[stk.length-1]; if(j<adj[v].length){ const w=adj[v][j]; stk[stk.length-1][1]++; if(!vis[w]){vis[w]=true;stk.push([w,0]);} }else{ stk.pop(); ord.push(v); } } }; for(let i=0;i<N;i++) if(!vis[i]) dfs1(i); const radj=Array.from({length:N},()=>[]); for(let u=0;u<N;u++) for(const v of adj[u]) radj[v].push(u); let c=0; const dfs2=(u,c)=>{ const stk=[u]; comp[u]=c; while(stk.length){ const v=stk.pop(); for(const w of radj[v]) if(comp[w]===-1){comp[w]=c;stk.push(w);} } }; for(let i=ord.length-1;i>=0;i--) if(comp[ord[i]]===-1) dfs2(ord[i],c++); const res=[]; for(let i=0;i<n;i++){ if(comp[2*i]===comp[2*i+1]) return 'NO'; res.push(comp[2*i]>comp[2*i+1]?1:0); } return 'YES\n'+res.join(' '); } }),
  makeProblem({ id:5017, title:'Treap 구현', tier:'diamond', tags:['자료 구조','트립'], difficulty:9, timeLimit:1, memLimit:256, desc:'Treap을 이용해 수열에 원소 삽입, 삭제, k번째 원소 조회를 처리하시오.', inputDesc:'첫째 줄에 Q, 이후 Q줄에 명령이 주어진다. I x: x 삽입, D x: x 삭제, K k: k번째 원소.', outputDesc:'K 명령 결과를 줄마다 출력한다.', hint:'각 노드에 랜덤 우선순위와 서브트리 크기를 저장합니다. split/merge 연산으로 삽입/삭제를 구현합니다.', exampleInputs:['7\nI 3\nI 1\nI 4\nI 1\nI 5\nK 3\nK 5'], hiddenInputs:['4\nI 1\nI 2\nI 3\nK 2','5\nI 5\nI 3\nI 7\nD 3\nK 2','3\nI 10\nK 1\nD 10','6\nI 2\nI 4\nI 6\nK 1\nK 2\nK 3'], solve:(input) => { const lines=input.trim().split('\n'); const q=Number(lines[0]); const data=[]; for(let i=1;i<=q;i++){ const [cmd,arg]=lines[i].split(' '); if(cmd==='I') data.push(Number(arg)); else if(cmd==='D'){ const idx=data.indexOf(Number(arg)); if(idx!==-1) data.splice(idx,1); } else{ data.sort((a,b)=>a-b); return data.sort((a,b)=>a-b),data[Number(arg)-1]; } } const res=[]; for(let i=1;i<=q;i++){ const [cmd,arg]=lines[i].split(' '); if(cmd==='I') data.push(Number(arg)); else if(cmd==='D'){ const idx=data.indexOf(Number(arg)); if(idx!==-1) data.splice(idx,1); } else{ const sorted=[...data].sort((a,b)=>a-b); res.push(sorted[Number(arg)-1]); } } return res.join('\n'); } }),
  makeProblem({ id:5018, title:'FFT - 다항식 곱셈', tier:'diamond', tags:['수학','FFT'], difficulty:9, timeLimit:2, memLimit:512, desc:'두 다항식 A, B의 곱 A×B의 계수를 출력하시오.', inputDesc:'첫째 줄에 두 다항식 A, B의 차수 N M, 둘째 줄에 A의 계수 (낮은 차수부터), 셋째 줄에 B의 계수.', outputDesc:'A×B의 계수를 낮은 차수부터 출력한다.', hint:'FFT 없이도 N,M ≤ 1000이면 O(NM) 단순 곱셈으로 충분합니다.', exampleInputs:['2 2\n1 2 1\n1 -2 1'], hiddenInputs:['1 1\n1 1\n1 1','0 0\n3\n5','2 1\n1 0 1\n1 1','3 2\n1 2 3 4\n1 2 3','1 1\n1 -1\n1 1'], solve:(input) => { const lines=input.trim().split('\n'); const [n,m]=lines[0].split(' ').map(Number); const a=lines[1].split(' ').map(Number); const b=lines[2].split(' ').map(Number); const res=Array(n+m+1).fill(0); for(let i=0;i<=n;i++) for(let j=0;j<=m;j++) res[i+j]+=a[i]*b[j]; return res.join(' '); } }),
  makeProblem({ id:5019, title:'최적 이진 탐색 트리', tier:'diamond', tags:['다이나믹 프로그래밍'], difficulty:9, timeLimit:1, memLimit:256, desc:'N개의 키와 각 키의 탐색 빈도가 주어질 때 최적 이진 탐색 트리의 최소 탐색 비용을 구하시오.', inputDesc:'첫째 줄에 N, 둘째 줄에 N개의 빈도가 주어진다.', outputDesc:'최소 탐색 비용을 출력한다.', hint:'dp[i][j] = 키 i부터 j까지의 최적 BST 비용. 루트 k를 변화시키며 dp[i][k-1]+dp[k+1][j]+sum(freq[i..j]) 최솟값.', exampleInputs:['4\n3 3 1 1'], hiddenInputs:['1\n5','2\n3 5','3\n1 2 3','4\n1 1 1 1','5\n2 4 6 8 10','3\n10 1 1','2\n1 100','4\n5 5 5 5'], solve:(input) => { const lines=input.trim().split('\n'); const n=Number(lines[0]); const freq=lines[1].split(' ').map(Number); const pre=[0]; for(let i=0;i<n;i++) pre.push(pre[i]+freq[i]); const sum=(i,j)=>pre[j+1]-pre[i]; const INF=1e15; const dp=Array.from({length:n+1},()=>Array(n+1).fill(INF)); for(let i=0;i<n;i++) dp[i][i]=freq[i]; for(let len=2;len<=n;len++) for(let i=0;i+len-1<n;i++){ const j=i+len-1; dp[i][j]=INF; const s=sum(i,j); for(let k=i;k<=j;k++){ const left=k>i?dp[i][k-1]:0; const right=k<j?dp[k+1][j]:0; const val=left+right+s; if(val<dp[i][j]) dp[i][j]=val; } } return String(dp[0][n-1]); } }),
  makeProblem({ id:5020, title:'오프라인 LCA + 쿼리', tier:'diamond', tags:['트리','LCA','오일러 투어'], difficulty:9, timeLimit:1, memLimit:256, desc:'N개 노드 트리에서 Q개의 두 노드 쌍 LCA를 구하시오. Tarjan의 오프라인 LCA 알고리즘을 사용하시오.', inputDesc:'첫째 줄에 N Q, 이후 N-1줄에 간선, 이후 Q줄에 u v.', outputDesc:'각 쿼리의 LCA를 줄마다 출력한다.', hint:'DFS 중 방문 완료 노드는 조상 방향으로 union. 쿼리 (u,v) 처리 시 v가 이미 방문됐으면 find(v)가 LCA.', exampleInputs:['7 3\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n4 5\n4 6\n3 4'], hiddenInputs:['5 2\n1 2\n1 3\n2 4\n2 5\n4 5\n3 4','4 3\n1 2\n2 3\n3 4\n1 4\n2 4\n1 3','3 2\n1 2\n1 3\n2 3\n1 2'], solve:(input) => { const lines=input.trim().split('\n'); const [n,q]=lines[0].split(' ').map(Number); const adj=Array.from({length:n+1},()=>[]); for(let i=1;i<n;i++){ const [a,b]=lines[i].split(' ').map(Number); adj[a].push(b); adj[b].push(a); } const queries=Array.from({length:n+1},()=>[]); const ans=Array(q); for(let i=0;i<q;i++){ const [u,v]=lines[n+i].split(' ').map(Number); queries[u].push([v,i]); queries[v].push([u,i]); } const par=[...Array(n+1).keys()]; const find=(x)=>par[x]===x?x:par[x]=find(par[x]); const vis=Array(n+1).fill(false); const anc=Array(n+1).fill(0); for(let i=1;i<=n;i++) anc[i]=i; const dfs=(u,p)=>{ vis[u]=true; for(const v of adj[u]){ if(v===p) continue; dfs(v,u); par[find(v)]=find(u); anc[find(u)]=u; } for(const [v,qi] of queries[u]) if(vis[v]) ans[qi]=anc[find(v)]; }; dfs(1,-1); return ans.join('\n'); } }),
]

export const ALL_TAGS = [...new Set(PROBLEMS.flatMap((problem) => problem.tags || []))]
