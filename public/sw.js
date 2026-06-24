const CACHE_NAME = 'soundscribe-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html'
];

// Install Event: Cache structural assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Serve from cache if offline, and cache audio files dynamically
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Special strategy for audio tracking data or storage links
  if (requestUrl.pathname.includes('/api/songs') || event.request.url.endsWith('.mp3')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          return cachedResponse;
        });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default Cache-First Strategy for images/css/HTML files
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