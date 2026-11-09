/* NS Cellphone Store offline support: the app opens with no internet.
   Its own scope (/ns/), so it never mixes with the Bismillah POS cache. */
const CACHE = 'ns-store-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ns-store-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (/supabase\.co$/.test(url.host)) return;          // BiixiPay Cloud data: never cache
  if (url.origin === location.origin) {
    // network first so updates show right away; cached copy when offline
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
  } else if (/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(url.host)) {
    // Supabase, barcode scanner and Excel libraries: cache first
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
      return r;
    })));
  }
});
