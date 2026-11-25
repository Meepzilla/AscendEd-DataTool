'use client';

import React from 'react';
import { Check, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { GoalDataUpdater } from '@/lib/types';
import { itemMasterySummary, itemScores, setItemResult, type ItemResult } from '@/lib/item-mastery';

// Data Entry for an item mastery goal: one row per item on the goal's list, with Correct and Incorrect buttons.
// Tapping the chosen result again clears it; items left unmarked weren't tried. Hotkeys mark the next unmarked item
// (C correct, N incorrect).

interface Props {
  items: string[];
  data: Record<string, any>;
  update: (data: GoalDataUpdater) => void;
  interact: (e: React.SyntheticEvent<HTMLButtonElement>, callback: () => void) => void;
  disabled?: boolean;
  isLocked?: boolean;
  goalId: string;
}

const RESULTS: { result: Exclude<ItemResult, ''>; label: string; icon: React.ReactNode }[] = [
  { result: 'correct', label: 'Correct', icon: <Check className="h-4 w-4" aria-hidden="true" /> },
  { result: 'incorrect', label: 'Incorrect', icon: <X className="h-4 w-4" aria-hidden="true" /> },
];

export default function ItemMasteryInput({ items, data, update, interact, disabled, isLocked, goalId }: Props) {
  const scores = itemScores(data, items);
  if (scores.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        This goal has no items yet. Add them in Students → the student → Edit Assigned Goal → Items.
      </p>
    );
  }
  const summary = itemMasterySummary({ items: scores });

  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {scores.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
            <span className="min-w-0 break-words text-sm font-medium">{s.label}</span>
            <div className="flex shrink-0 gap-1" role="group" aria-label={s.label}>
              {RESULTS.map(({ result, label, icon }) => {
                const selected = s.result === result;
                return (
                  <button
                    key={result}
                    type="button"
                    aria-pressed={selected}
                    aria-label={label}
                    title={label}
                    disabled={disabled}
                    onClick={e => interact(e, () => update(current => setItemResult(current, items, i, result)))}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-md border touch-manipulation disabled:opacity-50',
                      selected
                        ? result === 'correct' ? 'border-green-500 bg-green-500/20 text-green-800 dark:text-green-300'
                          : 'border-red-400 bg-red-400/15 text-red-800 dark:text-red-300'
                        : 'border-input bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {icon}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm font-semibold text-primary" aria-live="polite">
        {summary.tried
          ? `${summary.correct} of ${summary.tried} items tried correct (${Math.round(summary.percent ?? 0)}%)`
          : `0 of ${scores.length} items tried`}
      </p>
      <div className="space-y-1">
        <Label htmlFor={`im-notes-${goalId}`} className="text-xs">Notes</Label>
        <Textarea
          id={`im-notes-${goalId}`}
          value={data.notes || ''}
          onChange={e => {
            const notes = e.target.value;
            update(current => ({ ...current, notes }));
          }}
          rows={1}
          className="text-sm"
          disabled={disabled || isLocked}
        />
      </div>
    </div>
  );
}
