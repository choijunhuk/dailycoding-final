function normalizeCause(item, lang) {
  const fallback = lang === 'ko' ? '기타 오답' : 'Other wrong answers'
  return String(item?.cause || item?.result || fallback).trim() || fallback
}

function priorityRank(priority) {
  if (priority === 'high') return 0
  if (priority === 'medium') return 1
  return 2
}

export function buildRecoveryGroups(items = [], lang = 'en') {
  const groups = new Map()

  for (const item of Array.isArray(items) ? items : []) {
    const cause = normalizeCause(item, lang)
    const group = groups.get(cause) || {
      cause,
      count: 0,
      items: [],
      topTags: [],
      highPriorityCount: 0,
    }
    group.count += 1
    group.items.push(item)
    if (item?.priority === 'high') group.highPriorityCount += 1
    for (const tag of item?.tags || []) {
      if (!group.topTags.includes(tag)) group.topTags.push(tag)
    }
    group.topTags = group.topTags.slice(0, 4)
    groups.set(cause, group)
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: group.items.slice().sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)),
    }))
    .sort((a, b) => {
      if (b.highPriorityCount !== a.highPriorityCount) return b.highPriorityCount - a.highPriorityCount
      return b.count - a.count
    })
}

export function pickPrimaryRecoveryAction(items = [], lang = 'en') {
  const queue = Array.isArray(items) ? items : []
  if (queue.length === 0) {
    return {
      problemId: null,
      submissionId: null,
      label: lang === 'ko' ? '새 도전 시작' : 'Start a new challenge',
      reason: lang === 'ko'
        ? '미해결 오답이 없습니다. 새 문제나 배틀로 다음 약점을 찾아보세요.'
        : 'No unresolved wrong answers. Try a new problem or battle to find the next weakness.',
    }
  }

  const [first] = queue.slice().sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
  return {
    problemId: first.problemId,
    submissionId: first.submissionId,
    label: lang === 'ko' ? '가장 먼저 복구' : 'Recover first',
    reason: lang === 'ko'
      ? `${normalizeCause(first, lang)} 유형부터 복구하면 같은 실수를 빠르게 줄일 수 있습니다.`
      : `Recover ${normalizeCause(first, lang)} first to reduce repeat mistakes quickly.`,
  }
}
