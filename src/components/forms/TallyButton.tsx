'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLongPress, longPressStyle } from '@/hooks/use-long-press';

interface TallyButtonProps {
  label: string;
  count: number;
  title: string;
  className?: string;
  disabled?: boolean;
  onIncrement: (e: React.SyntheticEvent<HTMLButtonElement>) => void;
  onDecrement: (e: React.SyntheticEvent<HTMLButtonElement>) => void;
}

// A counter button: tap/click adds one; press and hold (touch) or right-click (mouse) removes one.
const TallyButton: React.FC<TallyButtonProps> = ({ label, count, title, className, disabled, onIncrement, onDecrement }) => {
  const longPressHandlers = useLongPress<HTMLButtonElement>(onDecrement);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-7 min-w-[3.25rem] px-2 text-xs justify-center touch-manipulation", className)}
      style={longPressStyle}
      onClick={onIncrement}
      {...longPressHandlers}
      title={`${title}: tap or click to add one; press and hold, or right-click, to remove one.`}
      aria-label={`${title}: ${count}`}
      disabled={disabled}
    >
      {label}: {count}
    </Button>
  );
};

export default TallyButton;
