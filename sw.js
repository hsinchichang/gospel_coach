// 離線快取：部署到 https 後，手機加到主畫面也能離線開啟。改了檔案記得把版本號加一。
const CACHE = "gospel-coach-v2";
const FILES = ["./", "index.html", "styles.css", "manifest.webmanifest", "icon.svg",
  "data/content.js", "data/verses.js", "js/store.js", "js/prompts.js", "js/app.js"];

self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
);
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
