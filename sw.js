'use strict';

// Increment this version whenever a new application version is published.
const CACHE_NAME = 'vitrines-pwa-v16';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=7',
  './app.js?v=21',
  './recherche.js?v=9',
  './catalogue.js?v=11',
  './manifest.webmanifest',
  './icons/vitrines-192.png',
  './icons/vitrines-512.png',
];
const NETWORK_FIRST = new Set([
  'index.html',
  'app.js',
  'styles.css',
  'catalogue.js',
  'recherche.js',
]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/placements')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  if (url.origin === self.location.origin && (
    NETWORK_FIRST.has(url.pathname.split('/').pop())
    || url.pathname.includes('/pdf/')
  )) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        return response;
      }).catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok && url.origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    })),
  );
});
