'use client';

import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormItem, FormLabel, type GoalInputContext } from './shared';
import { GAS_LEVELS, formatGasLevel, type GasLevel } from '@/lib/gas';

// Data Entry inputs for Goal Attainment Scaling (see goal-data-input.tsx, which picks the inputs for a goal's type).
// Level labels and descriptions live in src/lib/gas.ts; this file only renders them.

/**
 * The five level descriptions for this goal: the goal's gasLevelDescriptions where set
 * (an array indexed by level + 2), falling back to the generic descriptions for any level
 * left blank. Blank entries fall back per level, not all-or-nothing.
 */
export function gasLevelDescriptions(goal: GoalInputContext['goal']): string[] {
  const custom = (goal as { gasLevelDescriptions?: string[] }).gasLevelDescriptions;
  return GAS_LEVELS.map((info, i) => {
    const text = Array.isArray(custom) ? custom[i] : undefined;
    return typeof text === 'string' && text.trim() !== '' ? text.trim() : info.description;
  });
}

/** Goal Attainment Scaling: a five-level picker, the level descriptions in full, and notes. */
export function GasInputs({ ctx }: { ctx: GoalInputContext }) {
  const { goal, data, isArchived, isLocked, handleChange, handleInteraction, calculateAccuracy } = ctx;
  // No level recorded yet means no data: gasLevel stays undefined until a level is picked, never defaulted to 0.
  const selected: GasLevel | undefined =
    typeof data.gasLevel === 'number' && GAS_LEVELS.some(info => info.level === data.gasLevel)
      ? (data.gasLevel as GasLevel)
      : undefined;
  const descriptions = gasLevelDescriptions(goal);

  return (
    <>
      <FormItem>
        <FormLabel>Attainment level</FormLabel>
        <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Attainment level">
          {GAS_LEVELS.map((info) => {
            const level = info.level;
            const isSelected = selected === level;
            return (
              <Button
                key={level}
                type="button"
                size="sm"
                variant={isSelected ? 'default' : 'outline'}
                role="radio"
                aria-checked={isSelected}
                aria-label={`${formatGasLevel(level)}: ${descriptions[level + 2]}${isSelected ? ' (tap again to clear)' : ''}`}
                className="h-auto min-h-11 min-w-11 px-0.5 py-1.5 flex flex-col items-center gap-0.5 text-xs leading-tight touch-manipulation"
                title={`${formatGasLevel(level)}: ${descriptions[level + 2]}${isSelected ? ' — tap again to clear' : ''}`}
                onClick={(e) =>
                  handleInteraction(e, () => handleChange('gasLevel', isSelected ? undefined : level))
                }
                disabled={isArchived}
              >
                <span className="text-sm font-semibold">{formatGasLevel(level)}</span>
                <span className="whitespace-normal break-words">{info.label}</span>
              </Button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">Tap a level to record it. Tap the selected level again to clear it.</p>
      </FormItem>
      <FormItem>
        <FormLabel>Level descriptions</FormLabel>
        <ul className="space-y-0.5">
          {GAS_LEVELS.map((info) => (
            <li key={info.level} className={`text-xs ${selected === info.level ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
              {formatGasLevel(info.level)} — {descriptions[info.level + 2]}
            </li>
          ))}
        </ul>
      </FormItem>
      <div className="mt-1.5">
        <FormLabel>Attainment</FormLabel>
        <p className="text-sm font-semibold text-primary">{calculateAccuracy()}</p>
      </div>
      <FormItem>
        <FormLabel>Notes</FormLabel>
        <Textarea
          value={data.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Describe what was observed at this level"
          rows={1}
          className="text-sm"
          disabled={isArchived || isLocked}
        />
      </FormItem>
    </>
  );
}
