// PWA Service Worker 注册
// 在 App 装载后注册 sw.js，让 Android Chrome 识别为可安装 PWA

export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) => {
          console.log('[SW] 注册成功，scope:', reg.scope);
          // 检查是否需要更新
          reg.addEventListener('updatefound', () => {
            console.log('[SW] 检测到新版本');
          });
        },
        (err) => {
          console.warn('[SW] 注册失败:', err.message);
        }
      );
    });
  }
}
