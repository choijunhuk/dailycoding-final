// DailyCoding service worker.
// - Push notifications (existing)
// - Static-asset caching (new): /assets/* served stale-while-revalidate
// - HTML always network-first so deploys are visible immediately

const STATIC_CACHE = 'dc-static-v1';
const ASSET_PATTERNS = [/\/assets\//, /\/tiers\//, /\.(?:png|jpg|jpeg|gif|svg|webp|woff2?)$/];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache API or socket traffic.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  // HTML — network first so new deploys propagate.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html')),
    );
    return;
  }

  // Static assets — stale-while-revalidate.
  if (ASSET_PATTERNS.some((re) => re.test(url.pathname))) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const networkPromise = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || networkPromise;
      }),
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = { title: 'DailyCoding', body: 'New notification received.', url: '/' };
  try { payload = event.data ? event.data.json() : payload; } catch { /* malformed push payload fallback */ }
  event.waitUntil(self.registration.showNotification(payload.title || 'DailyCoding', {
    body: payload.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: payload.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
