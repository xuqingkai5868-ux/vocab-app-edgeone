import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/home', label: '首页', icon: '🏠' },
  { path: '/conversation', label: '对话', icon: '💬' },
  { path: '/review', label: '复习', icon: '📝' },
  { path: '/vocabulary', label: '生词本', icon: '📖' },
  { path: '/calendar', label: '日历', icon: '📅' },
  { path: '/stats', label: '统计', icon: '📊' },
  { path: '/settings', label: '设置', icon: '⚙️' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex overflow-x-auto">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center py-2 px-3 min-w-0 flex-1 transition-colors ${
              location.pathname === item.path
                ? 'text-primary-500'
                : 'text-gray-400'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-xs mt-0.5 whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
