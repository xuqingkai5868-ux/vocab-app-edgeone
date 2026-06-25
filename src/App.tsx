import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { Layout } from './components/Layout';
import { Loading } from './components/Loading';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Study } from './pages/Study';
import { Grammar } from './pages/Grammar';
import { Dictation } from './pages/Dictation';
import { Review } from './pages/Review';
import { WrongWords } from './pages/WrongWords';
import { Settings } from './pages/Settings';
import { warmUpTTS } from './services/utils/speak';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (!isLoggedIn) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function UpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const handler = () => setShowUpdate(true);
    window.addEventListener('sw-update-ready', handler);
    return () => window.removeEventListener('sw-update-ready', handler);
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between shadow-lg animate-slide-down">
      <span className="text-sm font-medium">📦 新版本已就绪</span>
      <button
        onClick={() => window.location.reload()}
        className="text-xs bg-white text-amber-700 px-3 py-1 rounded-full font-medium hover:bg-amber-50"
      >
        立即刷新
      </button>
    </div>
  );
}

function AppRoutes() {
  const { isLoggedIn, isLoading } = useAuth();

  // 在首次用户交互时唤醒 TTS 引擎（Android 需要用户手势才能初始化）
  useEffect(() => {
    if (!isLoggedIn) return;

    // 立即尝试（部分浏览器可用）
    warmUpTTS();

    // 监听首次点击/触摸来真正唤醒
    const handleFirstInteraction = () => {
      warmUpTTS();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [isLoggedIn]);

  if (isLoading) return <Loading />;

  return (
    <Routes>
      <Route path="/" element={isLoggedIn ? <Navigate to="/home" replace /> : <Login />} />
      <Route element={<ProtectedRoute><AppProvider><Layout /></AppProvider></ProtectedRoute>}>
        <Route path="/home" element={<Home />} />
        <Route path="/study" element={<Study />} />
        <Route path="/grammar/:stageId" element={<Grammar />} />
        <Route path="/dictation" element={<Dictation />} />
        <Route path="/review" element={<Review />} />
        <Route path="/wrong-words" element={<WrongWords />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UpdateBanner />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
