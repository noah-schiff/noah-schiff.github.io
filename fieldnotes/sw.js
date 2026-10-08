// Offline support. Pages load from the network when possible so updates show up
// right away, falling back to the cache offline; other files are cache-first.
const CACHE = 'fieldnotes-v6';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-512.png'];

self.addEventListener('install', e => {
  // 'reload' skips the browser's HTTP cache, so a new version never caches stale files.
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only the app's own files. API calls (ArcGIS, iNaturalist) carry sign-in
  // tokens and must never be served from or stored in this cache.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      // 'no-cache' revalidates with the server instead of trusting a 10-minute-old copy.
      const network = fetch(e.request, { cache: 'no-cache' })
        .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; });
      network.catch(() => {});
      if (e.request.mode === 'navigate') {
        return Promise.race([network, new Promise((_, rej) => setTimeout(rej, 4000))])
          .catch(() => cached || network);
      }
      return cached || network.catch(() => cached);
    })
  );
});
