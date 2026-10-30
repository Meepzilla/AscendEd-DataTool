'use client';

import React, { useState } from 'react';
import { Clock, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// A time picker made from the app's own controls. The browser's time input opens the phone's clock dialog,
// which on Android in landscape is cut off below its Set button; this panel scrolls to fit the screen.

interface TimePickerProps {
  id?: string;
  /** "HH:mm" (24-hour), or '' for no time. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function parse(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || '');
  return match ? { hour: Number(match[1]) % 24, minute: Number(match[2]) % 60 } : null;
}

export function formatTime12(value: string): string {
  const time = parse(value);
  if (!time) return '';
  return `${time.hour % 12 === 0 ? 12 : time.hour % 12}:${pad(time.minute)} ${time.hour < 12 ? 'AM' : 'PM'}`;
}

export function TimePicker({ id, value, onChange, className, disabled }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const current = parse(value);
  const now = new Date();
  const time = current ?? { hour: now.getHours(), minute: now.getMinutes() };
  const pm = time.hour >= 12;
  const hour12 = time.hour % 12 === 0 ? 12 : time.hour % 12;

  const set = (hour: number, minute: number) => onChange(`${pad(((hour % 24) + 24) % 24)}:${pad(((minute % 60) + 60) % 60)}`);
  const setHour12 = (h: number) => set((h % 12) + (pm ? 12 : 0), time.minute);
  const setPm = (toPm: boolean) => set((time.hour % 12) + (toPm ? 12 : 0), time.minute);
  const stepMinute = (delta: number) => {
    const total = (time.hour * 60 + time.minute + delta + 24 * 60) % (24 * 60);
    set(Math.floor(total / 60), total % 60);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn('w-full justify-start text-left font-normal', !current && 'text-muted-foreground', className)}
        >
          <Clock className="mr-2 h-4 w-4" />
          {current ? formatTime12(value) : 'Pick a time'}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="w-[min(34rem,calc(100vw-1rem))] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-3 space-y-3"
      >
        {/* Done stays in the top row so it is on screen even when the panel is short (phone in landscape). */}
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-2xl font-semibold tabular-nums">{`${hour12}:${pad(time.minute)}`}</p>
          <div className="flex gap-1" role="radiogroup" aria-label="AM or PM">
            {[false, true].map(isPm => (
              <Button key={String(isPm)} type="button" size="sm" role="radio" aria-checked={pm === isPm}
                variant={pm === isPm ? 'default' : 'outline'} onClick={() => setPm(isPm)}>
                {isPm ? 'PM' : 'AM'}
              </Button>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => { const n = new Date(); set(n.getHours(), n.getMinutes()); }}>Now</Button>
          <Button type="button" size="sm" onClick={() => { if (!current) set(time.hour, time.minute); setOpen(false); }}>Done</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
          <div>
            <p className="mb-1 flex h-8 items-center text-xs font-medium text-muted-foreground">Hour</p>
            <div className="grid grid-cols-6 gap-1">
              {HOURS.map(h => (
                <Button key={h} type="button" size="sm" className="h-9 px-0" variant={h === hour12 ? 'default' : 'outline'} onClick={() => setHour12(h)}>{h}</Button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Minute</p>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => stepMinute(-1)} aria-label="One minute earlier"><Minus className="h-4 w-4" /></Button>
                <span className="w-8 text-center text-sm tabular-nums">:{pad(time.minute)}</span>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => stepMinute(1)} aria-label="One minute later"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {MINUTES.map(m => (
                <Button key={m} type="button" size="sm" className="h-9 px-0" variant={m === time.minute ? 'default' : 'outline'} onClick={() => set(time.hour, m)}>:{pad(m)}</Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
