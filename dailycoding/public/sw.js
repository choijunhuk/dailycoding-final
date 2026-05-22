self.addEventListener('push', (event) => {
  let payload = { title: 'DailyCoding', body: 'New notification received.', url: '/' };
  try { payload = event.data ? event.data.json() : payload; } catch { /* malformed push payload fallback */ }
  event.waitUntil(self.registration.showNotification(payload.title || 'DailyCoding', {
    body: payload.body || '',
    data: { url: payload.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
