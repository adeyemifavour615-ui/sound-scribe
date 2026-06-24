const CACHE_NAME = 'soundscribe-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html'
];

// Install Event: Pre-cache core platform layout files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate Event: Clear older cache structures
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Interceptor: Prioritizes cached media if network fails
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Audio streams and image assets interception pipeline
  if (requestUrl.pathname.includes('/api/songs') || event.request.url.endsWith('.mp3') || requestUrl.hostname.includes('unsplash.com')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => null); // Silent fallback on complete lack of coverage
      })
    );
    return;
  }

  // Core fallback infrastructure strategy for structural frames
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    }).catch(() => caches.match('/index.html'))
  );
});