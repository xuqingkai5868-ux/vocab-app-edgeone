// PET 闯关 PWA Service Worker v2 — 自动缓存清理 + 版本感知
// 通过 sw.js?v=X.Y.Z 注册来触发版本更新

// 缓存名称从 URL query 参数获取版本号，实现每次发版自动换缓存
const APP_VERSION = new URL(location.href).searchParams.get('v') || '2.0.0';
const CACHE_NAME = `pet-vocab-${APP_VERSION}`;
const STATIC_CACHE = `${CACHE_NAME}-static`;

// 安装时预缓存核心资源
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/icon-192.png',
        '/icon-512.png',
      ]);
    })
  );
});

// 激活时清理旧版本缓存 + 立即接管所有页面
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // 清理所有不属于当前版本的缓存
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== CACHE_NAME)
            .map((k) => {
              console.log(`[SW] 清理旧缓存: ${k}`);
              return caches.delete(k);
            })
        )
      ),
      // 立即接管所有已打开的页面（不需刷新就能用新缓存）
      self.clients.claim(),
    ])
  );
});

// 策略：
// - 导航请求（HTML）：Network First → 始终获取最新 HTML，离线时用缓存兜底
// - 静态资源（JS/CSS/图片等有 content hash 的文件）：Cache First → 速度快，版本变化自动失效
// - API 请求：Network Only → 始终获取最新数据
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API 请求：始终走网络，不缓存
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 导航请求（HTML 页面）：Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstWithFallback(event.request));
    return;
  }

  // 静态资源（JS/CSS/图片等有 content hash）：Cache First
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$/)
  ) {
    event.respondWith(cacheFirstWithUpdate(event.request));
    return;
  }

  // 其他（manifest.json 等）：Cache First
  event.respondWith(cacheFirstWithUpdate(event.request));
});

// Network First：优先从网络获取，网络不可用时使用缓存
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // 完全离线且没有缓存时返回离线页面
    return new Response('离线中，请检查网络连接', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// Cache First：优先使用缓存，同时后台更新
async function cacheFirstWithUpdate(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const clone = response.clone();
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch (e) {
    return new Response('资源加载失败', { status: 504 });
  }
}
