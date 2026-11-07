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
        What each attainment level means for this goal. Data Entry shows these under the level picker, and reports
        show them where a level is displayed; a level left blank uses its generic label instead.
      </p>
      {GAS_LEVELS.map(info => {
        const index = info.level + 2;
        return (
          <div key={info.level} className="space-y-1">
            <label htmlFor={`gas-level-${info.level}`} className="block text-xs text-muted-foreground">
              {formatGasLevel(info.level)} — {info.description}
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
