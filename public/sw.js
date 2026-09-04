// Service worker.
//
// Στρατηγική, σκόπιμα συντηρητική για εφαρμογή οικονομικών:
//
//   ΑΡΧΕΙΑ (js, css, εικονίδια)  cache-first. Αλλάζουν όνομα σε κάθε build,
//                                οπότε δεν κινδυνεύεις να δεις παλιά έκδοση.
//
//   ΠΛΟΗΓΗΣΗ (το index.html)     network-first με εφεδρεία την cache. Έτσι
//                                παίρνεις πάντα την τελευταία έκδοση όταν
//                                υπάρχει δίκτυο, και ανοίγει και χωρίς.
//
//   ΔΕΔΟΜΕΝΑ (Supabase, /api)    ΠΟΤΕ cache. Ένα υπόλοιπο από χθες που
//                                παρουσιάζεται ως σημερινό είναι χειρότερο
//                                από ένα μήνυμα σφάλματος.

const VERSION = 'pheidon-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Δεδομένα χρήστη: πάντα από το δίκτυο, ποτέ από την cache.
  if (url.hostname.endsWith('supabase.co') || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(VERSION).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
