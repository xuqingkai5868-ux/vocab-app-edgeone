import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import { registerSW } from './services/utils/registerSW';
import { ensureVocabLoaded, MASTER_WORDS } from './services/utils/petVocabLoader';

// 先加载词库（动态 fetch，不阻塞 bundle），再渲染应用
async function boot() {
  try {
    await ensureVocabLoaded();
    console.log('[Boot] 词库加载完成，共', MASTER_WORDS.length, '词');
  } catch (e) {
    console.error('[Boot] 词库加载失败，应用将无法正常工作:', e);
  }

  // 注册 PWA Service Worker（仅在浏览器中执行）
  registerSW();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

boot();
