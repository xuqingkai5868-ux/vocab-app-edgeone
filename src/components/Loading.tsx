import React from 'react';

interface LoadingProps {
  text?: string;
}

export function Loading({ text = '加载中...' }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      <p className="mt-3 text-gray-500 text-sm">{text}</p>
    </div>
  );
}
