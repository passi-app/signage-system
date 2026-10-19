const CACHE_VERSION = 'pubscreen-v23';
const STATIC_CACHE_NAME = `static-${CACHE_VERSION}`;
const MEDIA_CACHE_NAME = `media-${CACHE_VERSION}`;

// Core assets required for the app shell to function offline
const CORE_STATIC_ASSETS = [
  './',
  './index.html',
  './links.html',
  './our-pages.html',
  './our-pages',
  './favicon.ico',
  './style.css?v=14',
  './app.js?v=14',
  './media-list.json',
  './logos/passi-logo.png?v=6',
  './logos/lagora-logo.png?v=2',
  './logos/qr-code.png?v=7',
  './sponsors/sponsor1.png',
  './sponsors/sponsor2.png'
];

// =========================================================================
// 1. LIFECYCLE: INSTALL & ACTIVATE
// =========================================================================
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing PubScreen Offline Engine...');

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(async (cache) => {
      for (const asset of CORE_STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[Service Worker] Warning: Pre-cache item missed: ${asset}`, err);
        }
      }
      console.log('[Service Worker] Core static shell cached successfully.');
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating & claiming clients...');

  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE_NAME && key !== MEDIA_CACHE_NAME) {
            console.log('[Service Worker] Clearing stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// =========================================================================
// 2. FETCH INTERCEPTION & CACHING STRATEGIES
// =========================================================================
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Ignore non-http/https requests (prevents chrome-extension://, moz-extension:// unsupported cache errors)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 2. Ignore non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 3. For video requests: when online, do NOT intercept range requests so browser natively streams via HTTP 206
  const isVideoRequest = url.pathname.endsWith('.mp4') ||
                         url.pathname.endsWith('.webm') ||
                         url.pathname.includes('/videos/');

  if (isVideoRequest) {
    if (navigator.onLine) {
      // Let browser fetch video natively with full Range support
      return;
    }
    event.respondWith(handleVideoRequest(request));
    return;
  }

  // Network-first for HTML pages (ensures UI updates are immediate, fallback to cache when offline)
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(networkFirstStrategy(request, STATIC_CACHE_NAME));
    return;
  }

  // Network-first for dynamic media-list.json (always try for new CMS commits, fallback to cache)
  if (url.pathname.endsWith('media-list.json')) {
    event.respondWith(networkFirstStrategy(request, STATIC_CACHE_NAME));
    return;
  }

  // Network-first for sponsors (so official sponsor images update immediately without stale cache)
  if (url.pathname.includes('/sponsors/')) {
    event.respondWith(networkFirstStrategy(request, MEDIA_CACHE_NAME));
    return;
  }

  // Cache-first with network fallback & dynamic cache for static assets
  event.respondWith(staleWhileRevalidateOrCacheFirst(request));
});

/**
 * Robust HTTP 206 Partial Content Range Request handler for cached video.
 * Browser media players require Range responses (Content-Range, Accept-Ranges, 206 status).
 */
async function handleVideoRequest(request) {
  const rangeHeader = request.headers.get('range');

  // Try network first if online to stream the latest media
  if (navigator.onLine) {
    try {
      const networkResponse = await fetch(request);
      // Clone and cache full response if 200 OK
      if (networkResponse.status === 200) {
        const cache = await caches.open(MEDIA_CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (networkErr) {
      console.warn('[Service Worker] Network failed for video. Falling back to cache:', request.url);
    }
  }

  // Retrieve cached video
  const mediaCache = await caches.open(MEDIA_CACHE_NAME);
  // Match by URL ignoring range header in the request lookup
  let cachedResponse = await mediaCache.match(request.url);

  if (!cachedResponse) {
    // If not in media cache, check static cache
    cachedResponse = await caches.match(request.url);
  }

  if (!cachedResponse) {
    // Offline and not in cache
    return new Response('Media currently unavailable offline.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // If no Range header requested, return standard cached 200 response
  if (!rangeHeader) {
    return cachedResponse;
  }

  // Handle Partial Content Range (HTTP 206) from cached ArrayBuffer
  try {
    const arrayBuffer = await cachedResponse.arrayBuffer();
    const totalLength = arrayBuffer.byteLength;

    // Parse bytes=start-end header
    const matches = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!matches) {
      return cachedResponse;
    }

    const start = parseInt(matches[1], 10);
    const end = matches[2] ? parseInt(matches[2], 10) : totalLength - 1;

    if (start >= totalLength || end >= totalLength) {
      return new Response('', {
        status: 416,
        statusText: 'Range Not Satisfiable',
        headers: { 'Content-Range': `bytes */${totalLength}` }
      });
    }

    const slicedBuffer = arrayBuffer.slice(start, end + 1);
    const contentType = cachedResponse.headers.get('content-type') || 'video/mp4';

    return new Response(slicedBuffer, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': contentType,
        'Content-Range': `bytes ${start}-${end}/${totalLength}`,
        'Content-Length': String(slicedBuffer.byteLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  } catch (err) {
    console.error('[Service Worker] Error constructing Range response:', err);
    return cachedResponse;
  }
}

/**
 * Network-first strategy for media-list.json
 */
async function networkFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok && request.url.startsWith('http')) {
      try {
        await cache.put(request, networkResponse.clone());
      } catch (e) {
        console.warn('[Service Worker] Cache put ignored:', e);
      }
    }
    return networkResponse;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Cache-first with dynamic caching for general web assets and sponsor images
 */
async function staleWhileRevalidateOrCacheFirst(request) {
  // Check static and media caches
  const cachedResponse = await caches.match(request);

  const fetchPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse && networkResponse.status === 200 && request.url.startsWith('http')) {
      try {
        const url = request.url;
        const targetCacheName = url.includes('/sponsors/') ? MEDIA_CACHE_NAME : STATIC_CACHE_NAME;
        const cache = await caches.open(targetCacheName);
        await cache.put(request, networkResponse.clone());
      } catch (cacheErr) {
        console.warn('[Service Worker] Stale cache put skipped:', cacheErr);
      }
    }
    return networkResponse;
  }).catch(() => {
    // Silent catch when offline; cached response handles display
  });

  return cachedResponse || fetchPromise;
}
