// Application release 5.0.0. Cache version is independent of the user's data format.
const CACHE_VERSION = 'isotretinoin-v5.0.0';
const RELEASE = '5.0.0';
const FILES = ['style.css', 'app.js', 'storage.js', 'calculations.js', 'ui.js', 'attachments.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png'];
const APP_SHELL = [
  './', './index.html', ...FILES.map((file) => `./${file}?v=${RELEASE}`),
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png'
];
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Bypass the HTTP cache when preparing an atomic offline release.
    await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('isotretinoin-') && key !== CACHE_VERSION).map((key) => caches.delete(key)));
    // Only static Cache Storage is cleaned. localStorage and IndexedDB are untouched.
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Navigation and all modules come from the same installed release.
    if (request.mode === 'navigate') return (await cache.match('./index.html')) || fetch(request);
    const cached = await cache.match(request);
    if (cached) return cached;
    return fetch(request);
  })());
});
