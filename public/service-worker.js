/**
 * Service Worker — ركشتك v3
 *
 * قواعد التخزين المؤقت الصارمة:
 * 1. ❌ صفحات HTML (أي طلب navigate/document) تُجلب من الشبكة دائماً —
 *    لا تُخزَّن ولا تُقدَّم من الكاش إطلاقاً (حتى لا يرى المستخدم نسخة قديمة
 *    من التطبيق، ولا يُعرض محتوى HTML لصفحات مقفولة مثل /admin).
 * 2. ❌ مسارات /api/ معفاة تماماً من أي تدخّل (بيانات حية وحساسة).
 * 3. ❌ الطلبات الخارجية (CDN/خرائط) لا تُخزَّن.
 * 4. ✅ الأصول الثابتة فقط (أيقونة + manifest + ملفات script/style/image/font
 *    من نفس النطاق) تُخزَّن بأسلوب stale-while-revalidate.
 */
const CACHE_NAME = "rakshtak-pwa-v3";

const STATIC_ASSETS = [
  "/manifest.json",
  "/icon.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) return caches.delete(name);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

const CACHEABLE_DESTINATIONS = new Set([
  "script",
  "style",
  "font",
  "image",
  "manifest",
]);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // خارجي: بدون تدخّل
  if (url.pathname.startsWith("/api/")) return; // API: أبداً

  // التنقّل بين الصفحات (HTML): الشبكة فقط — بلا كاش ولا fallback
  if (request.mode === "navigate" || request.destination === "document") {
    return;
  }

  // باقي الأصول من نفس النطاق: من الكاش أولاً مع تحديث من الشبكة في الخلفية
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok && CACHEABLE_DESTINATIONS.has(request.destination)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
