// ── 누리케어 Service Worker ──
// 버전을 올리면 자동으로 사용자 앱이 업데이트돼요
const VERSION = 'nuri-care-v2.0';
const CACHE_NAME = VERSION;

// 캐시할 파일 목록
const CACHE_FILES = [
  './nuri-care.html',
];

// 설치: 파일 캐시
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_FILES);
    })
  );
  // 즉시 활성화 (대기 없이 바로 업데이트)
  self.skipWaiting();
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// 네트워크 우선 → 실패 시 캐시 (Network First 전략)
// → GitHub에 파일 업데이트하면 사용자가 항상 새 버전 받아요
self.addEventListener('fetch', e => {
  // HTML 요청만 처리 (네트워크 우선)
  if (e.request.mode === 'navigate' || e.request.url.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // 새 버전을 캐시에 저장
          const cloned = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, cloned));
          return res;
        })
        .catch(() => {
          // 오프라인 시 캐시에서 제공
          return caches.match(e.request);
        })
    );
    return;
  }
  // 나머지는 캐시 우선
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
