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
      // 44px tall like the other counter buttons (28px was easy to miss on a touch screen), and it dips the moment it is
      // pressed so a tap shows before the count changes.
      className={cn("h-11 min-w-[3.25rem] px-2 text-xs justify-center touch-manipulation transition-transform active:scale-95 active:bg-accent", className)}
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
