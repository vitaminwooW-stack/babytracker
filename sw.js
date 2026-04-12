// ── 누리케어 Service Worker v5.0 ──
const VERSION = 'nuri-care-v5.0';
const CACHE_NAME = VERSION;

// 캐시할 파일 목록
const CACHE_FILES = [
  './nuri-care.html',
  './nuri-care.html?v=5',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Jua&display=swap',
];

// ── 설치: 핵심 파일 캐싱 ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 폰트는 CORS 문제로 no-cors
      return cache.addAll(['./nuri-care.html']).then(() => {
        return fetch('https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Jua&display=swap')
          .then(res => cache.put('fonts-gowun-jua', res))
          .catch(() => {}); // 폰트 캐싱 실패해도 설치 계속
      });
    })
  );
  self.skipWaiting();
});

// ── 활성화: 구버전 캐시 삭제 ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── 요청 처리: Cache First (오프라인 우선) ──
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firebase / 외부 API는 항상 네트워크
  if (url.includes('firebase') || url.includes('googleapis.com/identitytoolkit')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}', {headers:{'Content-Type':'application/json'}})));
    return;
  }

  // Google Fonts CSS - 캐시 우선
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // 앱 HTML - Cache First, 백그라운드 업데이트
  if (url.includes('nuri-care.html') || url.endsWith('/')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(res => {
            cache.put(e.request, res.clone());
            return res;
          }).catch(() => null);

          // 캐시 있으면 즉시 반환, 백그라운드에서 업데이트
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // 나머지 - 네트워크 우선, 실패 시 캐시
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── 메시지 처리 ──
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'GET_VERSION') {
    e.ports[0].postMessage({ version: VERSION });
  }
});
