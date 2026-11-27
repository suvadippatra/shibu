const CACHE_NAME = 'shibu-suite-v10';

const CORE_ASSETS = [
  './',
  './index.html',
  './settings.html',
  './manifest.webmanifest',
  './logo.png',
  './shared/css/fonts.css',
  './shared/css/tokens.css',
  './shared/css/animations.css',
  './shared/js/dom.js',
  './shared/js/site-prefs.js',
  './shared/js/math-pipeline.js',
  './shared/js/math-builder.js',
  './shared/js/watermark-vault.js',
  './fonts/TiroBangla.woff2',
  './fonts/TiroBangla-Italic.woff2',
  './fonts/DMSerifText.woff2',
  './qp/index.html',
  './qp/qp.css',
  './qp/state.js',
  './qp/qpf-parser.js',
  './qp/renderer.js',
  './qp/editor-ui.js',
  './qp/export-odt.js',
  './qp/main.js',
  './cbt/cbt_index.html',
  './cbt/Last.html',
  './cbt/css/cbt-editor.css',
  './cbt/vendor/cropper/cropper.min.css',
  './cbt/vendor/cropper/cropper.min.js',
  './cbt/js/cbt-state.js',
  './cbt/js/cbt-parser.js',
  './cbt/js/cbt-preview.js',
  './cbt/js/cbt-media.js',
  './cbt/js/cbt-editor.js',
  './cbt/js/cbt-compiler.js',
  './cbt/js/main.js',
  './add-watermark.html',
  './pdf-merge.html',
  './pdf-colour-invert.html',
  './pdf-watermark-detect.html',
  './pdf/pdf-tools.css',
  './pdf/watermark.js',
  './pdf/merge.js',
  './pdf/invert.js',
  './pdf/redact.js',
  './libs/katex.min.css',
  './libs/katex.min.js',
  './libs/auto-render.min.js',
  './libs/jszip.min.js',
  './libs/pdf-lib.min.js',
  './libs/fontkit.umd.min.js'
];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_ALL') {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(CORE_ASSETS))
        .then(() => {
          event.ports[0]?.postMessage({ ok: true });
        })
        .catch(() => {
          event.ports[0]?.postMessage({ ok: false });
        })
    );
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Normalize the cache key: strip query params so ignoreSearch:true is consistent
  const normalizedUrl = url.origin + url.pathname;
  const normalizedRequest = new Request(normalizedUrl, { headers: event.request.headers });

  event.respondWith(
    caches.match(normalizedRequest).then((cached) => {
      if (cached) {
        // Stale-while-revalidate: serve cached, refresh in background
        fetch(event.request)
          .then((resp) => {
            if (resp && resp.ok) {
              caches.open(CACHE_NAME).then((c) => c.put(normalizedRequest, resp));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(event.request).then((resp) => {
        if (resp && resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(normalizedRequest, clone));
        }
        return resp;
      });
    })
  );
});
