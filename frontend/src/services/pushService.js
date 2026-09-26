import { api } from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

async function getVapidPublicKey() {
  const { data } = await api.get('/push/vapidPublicKey');
  return urlBase64ToUint8Array(data.publicKey);
}

async function savePushSubscription(subscription, rollbackOnFailure) {
  try {
    await api.post('/push/subscribe', subscription.toJSON());
  } catch (error) {
    if (rollbackOnFailure) {
      await subscription.unsubscribe();
    }
    throw error;
  }
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Push notifications are not supported by this browser.');
  }
  if (Notification.permission === 'denied') {
    throw new Error('Notifications are blocked for this site. Enable them in your browser settings, then try again.');
  }

  const applicationServerKey = await getVapidPublicKey();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted. Check this site’s browser settings.');
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  await savePushSubscription(subscription, !existingSubscription);
  return subscription;
}

export async function refreshPushSubscription() {
  if (Notification.permission !== 'granted') {
    throw new Error('Allow notifications for Food App before refreshing this device subscription.');
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    await api.post('/push/unsubscribe', { endpoint: existingSubscription.endpoint });
    const unsubscribed = await existingSubscription.unsubscribe();
    if (!unsubscribed) {
      throw new Error('The browser could not replace this device’s push subscription.');
    }
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: await getVapidPublicKey(),
  });
  await savePushSubscription(subscription, true);
  return subscription;
}

export async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    return;
  }

  await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed) {
    throw new Error('The browser could not remove this device’s push subscription.');
  }
}

export async function sendTestPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    throw new Error('This device is not subscribed. Enable notifications before sending a test.');
  }
  return api('/push/test', {
    method: 'POST',
    body: { endpoint: subscription.endpoint },
  });
}