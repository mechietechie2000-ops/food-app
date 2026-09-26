import { api } from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function getPushRegistration() {
  // Push handling now lives in the main service worker (service-worker.js)
  // instead of a separate push-sw.js — see index.js / service-worker.js
  // comments for why. Match on service-worker.js instead of push-sw.js.
  const registrations = await navigator.serviceWorker.getRegistrations();
  const registration = registrations.find((reg) =>
    reg.active?.scriptURL.includes('service-worker.js')
  );
  if (!registration) throw new Error('Push service worker not registered yet');
  return registration;
}

export async function subscribeToPush() {
  const registration = await getPushRegistration();

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission denied');

  const { data } = await api.get('/push/vapidPublicKey');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  });

  await api.post('/push/subscribe', subscription);
  return subscription;
}

export async function unsubscribeFromPush() {
  const registration = await getPushRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  }
}