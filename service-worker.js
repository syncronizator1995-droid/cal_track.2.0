/* ============================================================
   Cal Track — service worker

   A service worker is a small script the browser keeps running
   in the background. Its job here is to save a copy of the app
   so it still opens when you have no signal.

   Strategy: NETWORK FIRST.
   Every time you open the app it tries the internet first and
   only falls back to the saved copy if that fails. That means
   when you push a change to GitHub you see it straight away,
   instead of being stuck looking at an old cached version.
   ============================================================ */

const CACHE = 'cal-track-v1';

const SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.map(function (name) {
          if (name !== CACHE) return caches.delete(name);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;

  // Only handle plain page/file loads.
  if (request.method !== 'GET') return;

  // Food lookups go straight to the internet — never cached,
  // so you always get current data from Open Food Facts.
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(function (response) {
        const copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        return response;
      })
      .catch(function () {
        return caches.match(request).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
  );
});
