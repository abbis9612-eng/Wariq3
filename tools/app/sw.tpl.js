// «العالم» — يخزّن كل ملفات اللعبة حتى تشتغل بدون نت (GW9). مولّد بـ tools/app/build.mjs: لا تعدّله بـ app/.
// التحديث: النسخة الجديدة تنتظر لحد ما اللاعب يضغط «حدّث» (رسالة skip)، حتى ما تتبدل اللعبة بنص الحرب.
const CACHE = 'wariq-world-__VER__';
const FILES = __FILES__;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('wariq-world-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() => e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
