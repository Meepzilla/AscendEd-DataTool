'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoalTextPopoverProps {
  name: string;
  /** The goal's full SMART goal text. */
  smartGoal?: string;
  /** The template's short description. */
  description?: string;
  className?: string;
  /** Show only an info icon as the trigger (for rows that are themselves a button). */
  iconOnly?: boolean;
}

/**
 * A goal's name that can be tapped to read the whole goal. Many goal bank names are shortened (they end in
 * "…"); the full goal is in its SMART goal text, which the popover shows.
 */
export default function GoalTextPopover({ name, smartGoal, description, className, iconOnly = false }: GoalTextPopoverProps) {
  // Goals without generated text get a placeholder SMART goal ("SMART goal for <name>"), which adds nothing.
  const goalText = smartGoal && !smartGoal.startsWith('SMART goal for ') ? smartGoal.trim() : '';
  const descriptionText = description?.trim() || '';
  if (!goalText && !descriptionText) return iconOnly ? null : <span className={className}>{name}</span>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {iconOnly ? (
          <button
            type="button"
            className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary touch-manipulation', className)}
            title="Read the full goal"
            aria-label={`Read the full goal: ${name}`}
          >
            <Info className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              'text-left underline decoration-dotted decoration-muted-foreground/60 underline-offset-2 hover:decoration-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm',
              className
            )}
            title="Tap to read the full goal"
          >
            {name}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,90vw)] max-h-[60vh] overflow-y-auto text-sm space-y-2" align="start">
        <p className="font-semibold leading-snug">{name}</p>
        {goalText && <p className="leading-relaxed whitespace-pre-wrap">{goalText}</p>}
        {descriptionText && descriptionText !== goalText && (
          <p className="text-xs text-muted-foreground leading-relaxed">{descriptionText}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
