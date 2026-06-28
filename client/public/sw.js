const CACHE_NAME = "saiko-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

function isSameOriginStaticAsset(request, url) {
  if (request.method !== "GET" || url.origin !== self.location.origin) return false;
  return ["document", "font", "image", "manifest", "script", "style", "worker"].includes(request.destination);
}

function isCachedSupabaseRead(request, url) {
  if (request.method !== "GET") return false;
  return (
    url.href.includes("/rest/v1/menu_items") ||
    url.href.includes("/rest/v1/menu_categories") ||
    url.href.includes("/rest/v1/business_settings")
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.mode === "navigate" || isSameOriginStaticAsset(event.request, url) || isCachedSupabaseRead(event.request, url)) {
    event.respondWith(networkFirst(event.request));
  }
});
