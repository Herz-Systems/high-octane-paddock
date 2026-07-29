/* HIGH OCTANE MALLORCA — Designrichtung Paddock
   Service Worker: network-first für Dokumente, cache-first für Assets.
   Cache-Cleanup ausschliesslich mit eigenem Präfix 'hom-c-'. */

const PREFIX = 'hom-c-';
const CACHE = PREFIX + 'v2';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/logo/logo.png',
  './assets/logo/icon-192.png',
  './assets/logo/icon-512.png',
  './assets/logo/icon-512-maskable.png',
  './assets/img/car-01.jpg',
  './assets/img/car-02.jpg',
  './assets/img/car-03.jpg',
  './assets/img/car-04.jpg',
  './assets/img/car-05.jpg',
  './assets/img/car-06.jpg',
  './assets/img/car-07.jpg',
  './assets/img/car-08.jpg',
  './assets/img/car-09.jpg',
  './assets/img/car-10.jpg',
  './assets/video/hero-poster.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Ein fehlendes Asset darf die Installation nicht sprengen.
    await Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // iOS fordert Videos in Bereichen an (Range-Request) und erwartet eine Teilantwort.
  // Aus dem Cache käme immer die ganze Datei — dann bleibt das Video stehen.
  // Deshalb: Bereichsanfragen und Videos grundsätzlich direkt ans Netz durchreichen.
  if (req.headers.has('range') || req.destination === 'video') return;

  const isDoc = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isDoc) {
    // network-first
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  // cache-first für Assets
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (e) {
      return new Response('', { status: 504 });
    }
  })());
});
