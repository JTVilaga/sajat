/* ------------------------------------------------------------------
   KIADOK service worker – offline működés
   FONTOS: ha bármelyik fájlt módosítod, emeld a CACHE_NAME verzióját,
   különben a telepített app a régi, gyorsítótárazott fájlokat használja.
   ------------------------------------------------------------------ */
const CACHE_NAME = "kiadok-cache-v1";

const ASSETS_TO_CACHE = [
    "./",
    "index.html",
    "manifest.json",
    "css/app.css",
    "js/util.js",
    "js/store.js",
    "js/xlsx-io.js",
    "js/ics.js",
    "js/naplo-adat.js",
    "js/nezet-naptar.js",
    "js/nezet-kiadasok.js",
    "js/nezet-naplo.js",
    "js/nezet-egyeb.js",
    "js/nezet-szef.js",
    "js/nezet-adatok.js",
    "js/app.js",
    "vendor/xlsx.full.min.js",
    "ikon/ikon-192.png",
    "ikon/ikon-512.png",
    "ikon/ikon-maskable-512.png",
    "ikon/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return Promise.all(ASSETS_TO_CACHE.map(function (url) {
                return cache.add(url).catch(function (err) {
                    console.warn("Nem sikerült előre gyorsítótárazni:", url, err);
                });
            }));
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; })
                .map(function (k) { return caches.delete(k); }));
        })
    );
    self.clients.claim();
});

/* Hálózat először (max. 3 mp), ha nincs net vagy lassú → gyorsítótár */
self.addEventListener("fetch", function (event) {
    const url = new URL(event.request.url);
    if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

    event.respondWith(new Promise(function (resolve) {
        let kesz = false;
        const timer = setTimeout(function () {
            caches.match(event.request).then(function (r) {
                if (r && !kesz) { kesz = true; resolve(r); }
            });
        }, 3000);

        fetch(event.request, { cache: "no-store" }).then(function (response) {
            clearTimeout(timer);
            if (response.ok) {
                const masolat = response.clone();
                caches.open(CACHE_NAME).then(function (c) { c.put(event.request, masolat); });
            }
            if (!kesz) { kesz = true; resolve(response); }
        }).catch(function () {
            clearTimeout(timer);
            caches.match(event.request).then(function (r) {
                if (!kesz) { kesz = true; resolve(r || caches.match("index.html")); }
            });
        });
    }));
});
