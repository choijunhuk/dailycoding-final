import api from '../api.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function getPushStatus() {
  const { data } = await api.get('/push/status');
  return data;
}

export async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
  }
  const keyRes = await api.get('/push/public-key');
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || keyRes.data?.publicKey;
  if (!publicKey) throw new Error('푸시 알림 서버 키가 설정되지 않았습니다.');
  const registration = await navigator.serviceWorker.register('/sw.js');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다.');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await api.post('/push/subscribe', subscription.toJSON());
  return subscription;
}

export async function unsubscribePush() {
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  await api.delete('/push/unsubscribe', { data: { endpoint: subscription?.endpoint } });
  if (subscription) await subscription.unsubscribe();
}
