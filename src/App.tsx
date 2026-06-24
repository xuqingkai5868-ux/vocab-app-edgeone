import React, { useEffect } from 'react';
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
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
