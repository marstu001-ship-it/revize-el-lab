var CACHE_NAME = 'revize-el-lab-v1.26-20261021';
// LAB: ostrý program (/revize-el/) sdílí s labem původ, a tedy i úložiště
// cache. Lab proto maže JEN své staré cache (revize-el-lab-…) a čte JEN ze
// své (zCache), nikdy z cache ostrého programu. Rozsah SW je složka, ze
// které se registruje (/revize-el-lab/), takže do /revize-el/ nezasahuje.
var LAB_PREDPONA = 'revize-el-lab-';
function zCache(req) {
  return caches.open(CACHE_NAME).then(function(c) { return c.match(req); });
}
// Vlastní soubory — bez nich aplikace offline nefunguje.
var URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  // vektorové PDF schématu rozvaděče — knihovna a písmo s háčky, musí jít offline
  './vektor/svg2pdf.umd.min.js',
  './vektor/RobotoCondensed-Regular.ttf',
  './vektor/RobotoCondensed-Bold.ttf'
];
// Externí zdroje — uložit, když to jde. Když CDN nebo fonty nejdou stáhnout
// (offline při první návštěvě, firemní proxy), instalace SW nesmí spadnout,
// jinak by uživatel zůstal úplně bez service workeru.
var URLS_OPTIONAL = [
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&family=Courier+Prime:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// Instalace — uložit vše do cache. {cache:'reload'} obchází HTTP cache
// prohlížeče, aby se vždy uložil opravdu nejnovější obsah ze serveru
// (bez tohoto kroku může prohlížeč z HTTP cache vrátit starou verzi
// a SW by ji uložil dál jako "novou").
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS_TO_CACHE.map(function(url) {
        return new Request(url, { cache: 'reload' });
      })).then(function() {
        return Promise.all(URLS_OPTIONAL.map(function(url) {
          return cache.add(new Request(url, { cache: 'reload', mode: 'cors' }))
                      .catch(function() { /* doplní se později přes fetch handler */ });
        }));
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Aktivace — smazat staré cache verze + převzít kontrolu nad otevřenými
// záložkami (clients.claim) a poslat jim zprávu, ať se reloadnou.
// Maže se JEN vlastní řada revize-el-v… — na témže původu můžou běžet i jiné
// programy s vlastní cache a ty se smazat nesmí (v9.123).
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n.indexOf(LAB_PREDPONA) === 0 && n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Network-first strategie pro HTML (navigace) a pro samotný sw.js —
// uživatel vždycky dostane nejnovější stránku, když je online.
// Offline: fallback na cache.
// Stale-while-revalidate pro ostatní assety (fonty, CDN script) — rychlé,
// ale na pozadí aktualizuje cache.
self.addEventListener('fetch', function(e) {
  var req = e.request;
  var url = new URL(req.url);
  var isNavigate = req.mode === 'navigate' ||
                   (req.method === 'GET' && req.headers.get('accept') &&
                    req.headers.get('accept').indexOf('text/html') !== -1);
  var isSameOrigin = url.origin === self.location.origin;
  var isHtmlOrSw = isSameOrigin && (isNavigate ||
                                     url.pathname.endsWith('/sw.js') ||
                                     url.pathname.endsWith('/index.html') ||
                                     url.pathname.endsWith('/manifest.json'));

  if (isHtmlOrSw) {
    // Network-first: zkus síť, při neúspěchu (offline) fallback na cache
    e.respondWith(
      fetch(req).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
        }
        return response;
      }).catch(function() {
        return zCache(req).then(function(cached) {
          return cached || zCache('./index.html');
        });
      })
    );
    return;
  }

  // Stale-while-revalidate pro vše ostatní
  e.respondWith(
    zCache(req).then(function(cached) {
      var fetchPromise = fetch(req).then(function(response) {
        if (response && response.status === 200 && req.method === 'GET') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(req, clone); });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});
