const SHELL_CACHE = 'food-app-shell-v1';
const isLocalDevelopment = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    if (!isLocalDevelopment) {
      const response = await fetch('/');
      if (!response.ok) {
        throw new Error(`Could not cache the Food App shell: ${response.status}`);
      }
      const html = await response.clone().text();
      const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((url) => url.startsWith('/assets/'));
      const cache = await caches.open(SHELL_CACHE);
      await cache.put('/', response);
      await cache.addAll([
        '/manifest.webmanifest',
        '/food-app-icon-192.png',
        '/food-app-icon-512.png',
        '/apple-touch-icon.png',
        ...assetUrls,
      ]);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith('food-app-') && name !== SHELL_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (isLocalDevelopment) {
    return;
  }

  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put('/', response.clone());
      }
      return response;
    }).catch(async () => {
      const cachedShell = await caches.match('/');
      if (cachedShell) {
        return cachedShell;
      }
      throw new Error('Food App is offline and its app shell is not cached yet.');
    }));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/food-app-icon-')) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() || '' };
  }

  event.waitUntil(self.registration.showNotification(data.title || 'Food App', {
    body: data.body || 'You have a new notification.',
    icon: '/food-app-icon-192.png',
    badge: '/food-app-icon-192.png',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existingWindow = windows.find((client) => client.url === destination);
    if (existingWindow) {
      return existingWindow.focus();
    }
    return clients.openWindow(destination);
  }));
});
