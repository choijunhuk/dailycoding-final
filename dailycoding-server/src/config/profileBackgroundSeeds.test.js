import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROFILE_BACKGROUND_SLUG,
  LEGACY_PROFILE_BACKGROUND_SLUGS,
  PROFILE_BACKGROUND_SEEDS,
} from './profileBackgroundSeeds.js';

test('profile background defaults do not expose the old dark duplicate', () => {
  const bySlug = new Map(PROFILE_BACKGROUND_SEEDS.map((item) => [item.slug, item]));
  assert.equal(DEFAULT_PROFILE_BACKGROUND_SLUG, 'solid-slate');
  assert.equal(bySlug.get(DEFAULT_PROFILE_BACKGROUND_SLUG)?.name, '기본 슬레이트');

  for (const slug of LEGACY_PROFILE_BACKGROUND_SLUGS) {
    assert.equal(bySlug.get(slug)?.is_default, 0);
  }

  assert.equal(bySlug.get('photo-4')?.image_url, '/backgrounds/background4.jpg');
  assert.equal(PROFILE_BACKGROUND_SEEDS.some((item) => item.name === '기본 다크'), false);
});
