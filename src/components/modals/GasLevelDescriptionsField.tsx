'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { GAS_LEVELS, formatGasLevel } from '@/lib/gas';

/**
 * Goal Attainment Scaling: one optional text field per level (-2 to +2) describing what that level
 * means for this goal. A level left blank uses the generic label in Data Entry and reports.
 * Shared by the assigned-goal editor and the goal-template editor.
 */
export default function GasLevelDescriptionsField({ values, onChange }: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const setDescription = (index: number, value: string) => {
    const next = Array.from({ length: 5 }, (_, i) => values[i] ?? '');
    next[index] = value;
    onChange(next);
  };
  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">Level Descriptions (Optional)</legend>
      <p className="text-xs text-muted-foreground">
        What each attainment level looks like for this goal. Usually -1 is where the student is now (the baseline),
        0 is where you expect them to be by the timeframe, +1 and +2 are better than that, and -2 is a decline. Data
        Entry shows these under the level picker, and reports show them in the scale; a level left blank uses its
        generic label instead.
      </p>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Checklist for a good scale</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Only one thing changes from level to level (for example, how often, or how much help).</li>
          <li>The steps between levels are about equal and each one matters.</li>
          <li>The levels don&apos;t overlap and leave no gaps: every possible result fits exactly one level.</li>
          <li>Each level is concrete and observable, so two people would rate it the same.</li>
          <li>The expected level (0) is realistic: not too hard, not too easy.</li>
          <li>There is a set timeframe for reaching it.</li>
        </ul>
      </details>
      {GAS_LEVELS.map(info => {
        const index = info.level + 2;
        return (
          <div key={info.level} className="space-y-1">
            <label htmlFor={`gas-level-${info.level}`} className="block text-xs text-muted-foreground">
              {formatGasLevel(info.level)} — {info.description}
              <span className="ml-1 italic">(&ldquo;{info.studentWording}&rdquo;)</span>
            </label>
            <Input
              id={`gas-level-${info.level}`}
              value={values[index] ?? ''}
              placeholder={info.description}
              onChange={e => setDescription(index, e.target.value)}
            />
          </div>
        );
      })}
    </fieldset>
  );
}
