/**
 * VCTM ERP Production Service Worker
 * Secure, performance-optimized caching for hashed static assets and offline SPA routing.
 * 
 * SECURITY DIRECTIVE:
 * - NO Supabase API or database requests (*.supabase.co/*) are ever cached.
 * - NO /api/* administrative routes are ever cached.
 * - Dynamic academic ERP records remain strictly real-time and network-governed.
 */

const CACHE_NAME = 'vctm-erp-shell-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/vctm-logo.png',
  '/vctm-campus-mobile.avif',
  '/vctm-campus.avif',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Strict Security Rule: NEVER intercept or cache Supabase or API endpoints
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/')
  ) {
    return; // Direct network bypass
  }

  // 2. Navigation fallback for single page application (SPA) routing offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedIndex = await caches.match('/index.html');
        return cachedIndex || fetch(request);
      })
    );
    return;
  }

  // 3. Static assets (/assets/*, fonts, images) Cache-First with Network Fallback
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.avif') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Default: Direct Network
  return;
});
