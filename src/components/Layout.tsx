import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <main className="max-w-lg mx-auto px-4 py-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
