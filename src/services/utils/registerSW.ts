// PWA Service Worker 注册 — 版本感知 + 自动更新
// 通过 query param ?v=X.Y.Z 让浏览器识别 SW 变更，触发 update 流程

// 注意：__APP_VERSION__ 在构建时由 Vite 的 define 替换
// 开发环境下使用默认版本号
declare const __APP_VERSION__: string;

// 封装 version 访问，兼容构建和开发
function getAppVersion(): string {
  try {
    return __APP_VERSION__ || '2.0.0';
  } catch {
    return '2.0.0';
  }
}

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const version = getAppVersion();
    // 注册时带上版本号作为 query param
    // SW 内部用此版本号构建缓存名称，发版后版本号变化 → 浏览器检测到新 SW → install → activate → 清理旧缓存
    navigator.serviceWorker.register(`/sw.js?v=${version}`).then(
      (reg) => {
        console.log(`[SW] 注册成功，版本: ${version}，scope:`, reg.scope);

        // 监听新版本检测
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          console.log('[SW] 检测到新版本，正在安装...');

          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              // 新版本已安装并等待激活 — 通知用户刷新
              console.log('[SW] 新版本已就绪，建议刷新页面');
              // 触发自定义事件，让 App 层可以显示更新提示
              window.dispatchEvent(new CustomEvent('sw-update-ready'));
            }
          });
        });
      },
      (err) => {
        console.warn('[SW] 注册失败:', err.message);
      }
    );
  });
}
