import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { Layout } from './components/Layout';
import { Loading } from './components/Loading';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Study } from './pages/Study';
import { Dictation } from './pages/Dictation';
import { Review } from './pages/Review';
import { Vocabulary } from './pages/Vocabulary';
import { Settings } from './pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!isLoggedIn) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) return <Loading />;

  return (
    <Routes>
      <Route path="/" element={isLoggedIn ? <Navigate to="/home" replace /> : <Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppProvider>
              <Layout />
            </AppProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/study" element={<Study />} />
        <Route path="/dictation" element={<Dictation />} />
        <Route path="/review" element={<Review />} />
        <Route path="/vocabulary" element={<Vocabulary />} />
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
