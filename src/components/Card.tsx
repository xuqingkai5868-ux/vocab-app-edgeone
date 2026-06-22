import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${
        onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
