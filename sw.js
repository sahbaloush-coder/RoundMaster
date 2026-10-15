/* RoundMaster offline worker.
   Keeps a copy of the app on the device so it opens without internet.
   - The app page: tries the internet first (to pick up updates), falls back to the saved copy.
   - Styling, icons and fonts: served from the saved copy.
   Patient data is NOT here - it stays in the app's own storage on the device. */
const CACHE = 'roundmaster-307d9cd6eb';
const FILES = [
    "./",
    "./index.html",
    "./app-v2.webmanifest",
    "./vendor/tailwind.js",
    "./vendor/fontawesome/css/all.min.css",
    "./vendor/fontawesome/webfonts/fa-solid-900.woff2",
    "./vendor/fontawesome/webfonts/fa-regular-400.woff2",
    "./rm-heart-180.png",
    "./rm-heart-192.png",
    "./rm-heart-512.png",
    "./rm-heart-maskable-512.png",
    "./apple-touch-icon.png"
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k.startsWith('roundmaster-') && k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

    if (req.mode === 'navigate') {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE);
            try {
                const res = await withTimeout(fetch(req, { cache: 'no-store' }), 4000);
                if (res && res.ok) cache.put('./index.html', res.clone());
                return res;
            } catch (e) {
                return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        try {
            const res = await fetch(req);
            if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone());
            return res;
        } catch (e) {
            return Response.error();
        }
    })());
});
