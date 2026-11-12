// Service Worker – Vorlage. Beim Build setzt das Vite-Plugin (vite-plugin-lektionen.ts)
// Version und Dateiliste ein und schreibt das Ergebnis nach dist/sw.js.
/* eslint-disable */
const VERSION = '__VERSION__';
const DATEIEN = __DATEIEN__;
const CACHE = `voci-${VERSION}`;

const url = (pfad) => new URL(pfad, self.registration.scope).href;

self.addEventListener('install', (event) => {
  // Alles vorab laden – danach funktioniert die App komplett offline.
  // Kein skipWaiting(): die neue Version wird erst aktiv, wenn das Kind
  // auf "neu laden" tippt (oder die App komplett geschlossen wurde).
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN.map(url))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('voci-') && name !== CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'aktivieren') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (req.mode === 'navigate') {
        const seite = await cache.match(url('./'));
        if (seite) return seite;
      }
      const treffer = await cache.match(req, { ignoreSearch: true });
      if (treffer) return treffer;
      try {
        return await fetch(req);
      } catch (e) {
        if (req.mode === 'navigate') {
          const seite = await cache.match(url('./'));
          if (seite) return seite;
        }
        throw e;
      }
    })(),
  );
});
