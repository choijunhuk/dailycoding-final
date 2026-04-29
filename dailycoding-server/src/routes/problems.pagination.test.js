import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test_secret';

const { normalizeProblemListQuery, normalizeTextQuery, paginateProblemRows } = await import('./problems.js');

test('problem list query normalization clamps pagination and invalid filters', () => {
  const query = normalizeProblemListQuery({
    search: '   Alpha   Graph   ',
    sort: 'unknown-sort',
    status: 'bookmarked',
    page: '99',
    limit: '999',
    tier: 'silver',
    tag: '  그래프  ',
  });

  assert.deepEqual(query, {
    tier: ['silver'],
    problemType: undefined,
    preferredLanguage: undefined,
    tag: ['그래프'],
    search: 'Alpha Graph',
    sort: 'id',
    status: 'bookmarked',
    limit: 24,
    requestedPage: 99,
    paginated: true,
  });
});

test('problem text query trimming and pagination helpers preserve newest-first page slices', () => {
  assert.equal(normalizeTextQuery('   Trimmed   Search   '), 'Trimmed Search');

  const rows = [
    { id: 30, title: 'Newest Problem' },
    { id: 20, title: 'Middle Problem' },
    { id: 10, title: 'Older Problem' },
  ];

  const payload = paginateProblemRows(rows, 5, 2);
  assert.equal(payload.total, 3);
  assert.equal(payload.page, 2);
  assert.equal(payload.limit, 2);
  assert.equal(payload.totalPages, 2);
  assert.equal(payload.hasPrev, true);
  assert.equal(payload.hasNext, false);
  assert.deepEqual(payload.items.map((item) => item.id), [10]);
});

test('oversized search text is truncated before route-level validation message checks', () => {
  const oversized = 'x'.repeat(140);
  assert.equal(normalizeTextQuery(oversized, 100).length, 100);
});
