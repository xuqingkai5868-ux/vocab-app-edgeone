import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { useApp } from '../contexts/AppContext';

function SyncIndicator() {
  const { isSyncing } = useApp();
  return (
    <div className={`fixed top-0 right-4 z-40 transition-all duration-300 ${isSyncing ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="flex items-center gap-1.5 px-2 py-1 mt-1">
        <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
        <span className="text-[10px] text-primary-400 font-medium">同步中</span>
      </div>
    </div>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <SyncIndicator />
      <main className="max-w-lg mx-auto px-4 py-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
