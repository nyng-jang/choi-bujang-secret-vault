// 내 자료실 서비스 워커: 인터넷이 끊겼을 때 오프라인 안내 화면만 보여 줍니다.
// - 저장하는 것은 offline.html과 아이콘뿐입니다. 메모, 로그인 토큰, /api 응답은 저장하지 않습니다.
// - /api 요청과 화면 이외의 요청은 건드리지 않고 그대로 서버로 보냅니다.
// - 이 파일은 기기를 확인하거나 승인하지 않습니다. 승인 여부는 서버와 판정기가 정합니다.
const CACHE = 'byteback-offline-v1';
const OFFLINE_FILES = ['/offline.html', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(OFFLINE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  // 화면 이동(주소창, 앱 아이콘으로 열기)만 다룹니다. /api 요청은 여기에 해당하지 않습니다.
  if (request.mode !== 'navigate') return;
  event.respondWith(fetch(request).catch(async () => {
    const cached = await caches.match('/offline.html');
    return cached ?? new Response('오프라인입니다.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});
