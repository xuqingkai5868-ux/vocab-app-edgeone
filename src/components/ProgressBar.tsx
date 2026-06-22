import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  color?: string;
}

export function ProgressBar({ value, max, label, color = 'bg-primary-500' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>{label}</span>
          <span>{value}/{max}</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
