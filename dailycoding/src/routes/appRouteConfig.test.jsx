import { test } from 'vitest';
import assert from 'node:assert/strict';
import { AUTHENTICATED_ROUTES, PUBLIC_ROUTES, getRoutePaths } from './appRouteConfig.jsx';

test('PUBLIC_ROUTES keeps share and auth recovery routes public', () => {
  const paths = getRoutePaths(PUBLIC_ROUTES);

  assert.ok(paths.includes('/share/:slug'));
  assert.ok(paths.includes('/reset-password'));
  assert.ok(paths.includes('/pricing'));
});

test('AUTHENTICATED_ROUTES exposes learning, battle, and recovery destinations', () => {
  const paths = getRoutePaths(AUTHENTICATED_ROUTES);

  assert.ok(paths.includes('/learning'));
  assert.ok(paths.includes('/battle'));
  assert.ok(paths.includes('/recovery'));
});

test('admin route is explicitly gated in route metadata', () => {
  const adminRoute = AUTHENTICATED_ROUTES.find((route) => route.path === '/admin');

  assert.equal(adminRoute.requiresAdmin, true);
});
