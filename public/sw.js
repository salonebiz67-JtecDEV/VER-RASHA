/* VEY RASHA — Scoped Public Boutique Media Cache Service Worker
 *
 * Strictly caches ONLY public product, collection, category, and campaign images
 * served from Supabase Storage (`boutique-media`).
 * NEVER caches customer API calls, auth tokens, orders, addresses, or profiles.
 * Compatible with GitHub Pages (/VER-RASHA/) and Capacitor Android WebView.
 */

const CACHE_NAME = 'vey-rasha-media-v1';
const MAX_CACHE_ENTRIES = 160;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('vey-rasha-media-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isPublicBoutiqueImageRequest(request, url) {
  if (request.method !== 'GET') return false;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;

  // Never intercept authenticated, API, or Edge Function requests
  if (
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.includes('/functions/v1/') ||
    url.pathname.includes('/realtime/v1/') ||
    url.pathname.startsWith('/api/')
  ) {
    return false;
  }

  return url.pathname.includes('/storage/v1/object/public/boutique-media/');
}

async function trimCacheIfNeeded(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_CACHE_ENTRIES) return;
  const excess = keys.length - MAX_CACHE_ENTRIES;
  for (let i = 0; i < excess; i += 1) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (!isPublicBoutiqueImageRequest(request, url)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }

      const networkResponse = await fetch(request, {
        mode: 'cors',
        credentials: 'omit',
      });

      const contentType = (networkResponse.headers.get('content-type') || '').toLowerCase();
      if (
        networkResponse.status === 200 &&
        contentType.startsWith('image/') &&
        (networkResponse.type === 'basic' || networkResponse.type === 'cors')
      ) {
        await cache.put(request, networkResponse.clone());
        trimCacheIfNeeded(cache).catch(() => {});
      }

      return networkResponse;
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'EVICT_BOUTIQUE_IMAGE_CACHE') {
    event.waitUntil(caches.delete(CACHE_NAME));
  }
});
