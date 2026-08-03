/**
 * SSCC Junnar ERP — Progressive Web App Service Worker
 * Caches core app assets for offline availability and fast loading.
 */

const CACHE_NAME = 'sscc-erp-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/manifest.json',
  '/css/main.css',
  '/css/styles.css',
  '/css/messenger.css',
  '/js/app.js',
  '/js/api.js',
  '/js/theme.js',
  '/js/toast.js',
  '/js/crypto.js',
  '/js/messenger.js'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW-CACHE-WARN] Failed to pre-cache some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
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

self.addEventListener('fetch', (evt) => {
  // Do NOT cache API requests or non-GET requests
  if (evt.request.method !== 'GET' || evt.request.url.includes('/api/')) {
    return;
  }

  evt.respondWith(
    caches.match(evt.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached and refresh in background
        fetch(evt.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(evt.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(evt.request);
    })
  );
});
