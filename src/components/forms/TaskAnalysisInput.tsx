'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { STEP_LEVELS, STEP_LEVEL_LABELS, STEP_LEVEL_SHORT, setStepLevel, stepScores, taskAnalysisSummary, type StepLevel } from '@/lib/task-analysis';

// Data Entry for a task analysis goal: one row per step, with a button per level (Independent, the prompt levels,
// Not done). Tapping the chosen level again clears it. Hotkeys score the next unscored step (C, N, D/V/G/P/F/I).

interface Props {
  steps: string[];
  data: Record<string, any>;
  /** The goal's whole data after a change. */
  update: (data: Record<string, any>) => void;
  interact: (e: React.SyntheticEvent<HTMLButtonElement>, callback: () => void) => void;
  disabled?: boolean;
  isLocked?: boolean;
  goalId: string;
}

export default function TaskAnalysisInput({ steps, data, update, interact, disabled, isLocked, goalId }: Props) {
  if (steps.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        This goal has no steps yet. Add them in Students → the student → Edit Assigned Goal → Task Steps.
      </p>
    );
  }
  const scores = stepScores(data, steps);
  const summary = taskAnalysisSummary({ steps: scores });

  return (
    <div className="space-y-2">
      <ol className="space-y-1.5">
        {scores.map((s, i) => (
          <li key={i} className="rounded-md border p-1.5">
            <p className="mb-1 text-xs font-medium"><span className="text-muted-foreground">{i + 1}.</span> {s.label}</p>
            <div className="flex flex-wrap gap-1" role="group" aria-label={`Step ${i + 1}: ${s.label}`}>
              {STEP_LEVELS.map((level: StepLevel) => {
                const selected = s.level === level;
                return (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={selected}
                    aria-label={STEP_LEVEL_LABELS[level]}
                    title={STEP_LEVEL_LABELS[level]}
                    disabled={disabled}
                    onClick={e => interact(e, () => update(setStepLevel(data, steps, i, level)))}
                    className={cn(
                      'h-9 min-w-11 rounded-md border px-2 text-sm font-semibold touch-manipulation disabled:opacity-50',
                      selected
                        ? level === 'Independent' ? 'border-green-500 bg-green-500/20 text-green-300'
                          : level === 'NotDone' ? 'border-red-400 bg-red-400/15 text-red-300'
                          : 'border-primary bg-primary/20 text-primary'
                        : 'border-input bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {STEP_LEVEL_SHORT[level]}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      <p className="text-sm font-semibold text-primary" aria-live="polite">
        {summary.scored
          ? `${summary.independent} of ${summary.scored} scored steps independent (${Math.round(summary.percent ?? 0)}%)`
          : `0 of ${steps.length} steps scored`}
      </p>
      <div className="space-y-1">
        <Label htmlFor={`ta-notes-${goalId}`} className="text-xs">Notes</Label>
        <Textarea
          id={`ta-notes-${goalId}`}
          value={data.notes || ''}
          onChange={e => update({ ...data, notes: e.target.value })}
          rows={1}
          className="text-sm"
          disabled={disabled || isLocked}
        />
      </div>
    </div>
  );
}
