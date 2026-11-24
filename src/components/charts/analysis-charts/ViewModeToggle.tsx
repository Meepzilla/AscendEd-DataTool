'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ViewModeOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface ViewModeToggleProps<T extends string> {
  label: string;
  value: T;
  options: ViewModeOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Accessible segmented control matching the app's TabsList look, used to switch how a chart's data is shown.
 */
export default function ViewModeToggle<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: ViewModeToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex flex-wrap items-center rounded-md bg-muted p-1 text-muted-foreground', className)}
    >
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              active ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
