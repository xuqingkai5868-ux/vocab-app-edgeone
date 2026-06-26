import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/home', label: '首页', icon: '🏠' },
  { path: '/study', label: '学习', icon: '📖' },
  { path: '/review', label: '复习', icon: '🔄' },
  { path: '/wrong-words', label: '错词本', icon: '📕' },
  { path: '/settings', label: '设置', icon: '⚙' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/home') return location.pathname === '/home';
    if (path === '/study') return location.pathname === '/study' || location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 safe-area-bottom">
      <div className="flex max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path, { replace: true })}
              className="flex flex-col items-center justify-center flex-1 py-2 relative transition-all"
            >
              <span className={`text-lg leading-none ${active ? '' : 'opacity-40 grayscale'}`}>{item.icon}</span>
              <span className={`text-[10px] mt-1 font-medium ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
                {item.label}
              </span>
              {active && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
