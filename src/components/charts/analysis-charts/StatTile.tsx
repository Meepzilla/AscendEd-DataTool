'use client';

import React, { useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// A figure on the Reports page that shows how it is worked out: on hover with a mouse, and on tap (iPad,
// phone) or Enter/Space with the keyboard, since a hover-only tooltip can't be opened on a touch screen.

interface Props {
  label: string;
  value: React.ReactNode;
  /** How the figure is worked out; without one the tile is plain. */
  explanation?: string;
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}

export default function StatTile({ label, value, explanation, icon, className, valueClassName }: Props) {
  const [open, setOpen] = useState(false);
  // Opened by the mouse resting on it (closes when it leaves), or by a tap or the keyboard (stays until closed).
  const byHover = useRef(false);
  const body = (
    <>
      {icon}
      <span className={cn('block font-bold', valueClassName)}>{value}</span>
      <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        {label}
        {explanation && <Info className="h-3 w-3 shrink-0 opacity-70" aria-hidden />}
      </span>
    </>
  );
  const tileClass = cn('flex flex-col items-center justify-center rounded-lg bg-muted/50 text-center', className);
  if (!explanation) return <div className={tileClass}>{body}</div>;

  return (
    <Popover open={open} onOpenChange={next => { byHover.current = false; setOpen(next); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(tileClass, 'w-full cursor-help hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary')}
          aria-label={`${label}: ${typeof value === 'string' || typeof value === 'number' ? value : ''}. Show how it is worked out`}
          onPointerEnter={e => { if (e.pointerType === 'mouse' && !open) { byHover.current = true; setOpen(true); } }}
          onPointerLeave={e => { if (e.pointerType === 'mouse' && byHover.current) { byHover.current = false; setOpen(false); } }}
          // A click after hovering keeps it open (instead of the trigger closing it).
          onClick={e => { if (byHover.current) { e.preventDefault(); byHover.current = false; } }}
        >
          {body}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 max-w-[calc(100vw-2rem)] text-sm"
        side="top"
        // Leave focus on the tile, so hovering doesn't move it and the keyboard stays where it was.
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <p className="mb-1 font-semibold">{label}</p>
        <p className="text-muted-foreground">{explanation}</p>
      </PopoverContent>
    </Popover>
  );
}
