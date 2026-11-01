'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, X, CircleHelp, RotateCcw, Undo2 } from 'lucide-react';
import type { TrialStatus } from '@/lib/types';
import { MAX_TRIALS } from '@/lib/goal-input-logic';
import { FormItem, FormLabel, type GoalInputContext } from './shared';

// Data Entry inputs for goal types (see goal-data-input.tsx, which picks the inputs for a goal's type).

/** Discrete and sequenced trials: the trial grid. */
export function TrialInputs({ ctx }: { ctx: GoalInputContext }) {
  const { data, captureType, isArchived, isLocked, isFocused, handleChange, calculateAccuracy, handleTrialClick, handleFillNextTrial, handleClearTrials, handleUndoLastTrial } = ctx;
  const trials = Array.isArray(data.trials) ? data.trials : Array(data.numberOfTrials || 5).fill('untouched');
  const focusedTrialIndex = data.focusedTrialIndex ?? trials.findIndex(t => t === 'untouched');
  return (
    <>
      <FormItem>
        <FormLabel>Number of Trials</FormLabel>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="1"
            max={MAX_TRIALS}
            value={data.numberOfTrials ?? ''}
            onChange={(e) => handleChange('numberOfTrials', e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
            className="h-8 text-sm text-center w-20"
            aria-label="Number of Trials"
            disabled={isArchived || isLocked}
          />
           <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" className="h-7 px-2 text-xs bg-green-500 hover:bg-green-600" onClick={(e) => handleFillNextTrial('correct', e)} disabled={isArchived || isLocked}>Correct</Button>
              <Button type="button" size="sm" className="h-7 px-2 text-xs bg-yellow-500 hover:bg-yellow-600" onClick={(e) => handleFillNextTrial('approximate', e)} disabled={isArchived || isLocked}>Approx.</Button>
              <Button type="button" size="sm" className="h-7 px-2 text-xs bg-red-500 hover:bg-red-600" onClick={(e) => handleFillNextTrial('incorrect', e)} disabled={isArchived || isLocked}>Incorrect</Button>
              <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={(e) => handleUndoLastTrial(e)} disabled={isArchived || isLocked} title="Undo Last"><Undo2 className="h-3.5 w-3.5" /></Button>
              <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={(e) => handleClearTrials(e)} disabled={isArchived || isLocked} title="Reset All"><RotateCcw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </FormItem>
      {captureType === 'SEQUENCED_TRIALS' && (Number(data.successfulAttempts) || Number(data.failedAttempts) || Number(data.approximate)) ? (
        // Sessions entered before sequenced trials used the trial boxes kept counts; they still count.
        <p className="text-xs text-muted-foreground">
          Also counted (entered before the trial boxes): {Number(data.successfulAttempts) || 0} correct, {Number(data.approximate) || 0} approximate, {Number(data.failedAttempts) || 0} incorrect.
        </p>
      ) : null}
      <FormItem>
        <FormLabel>Trial Sequence (Click to cycle)</FormLabel>
        <div className="flex flex-wrap gap-2 items-center">
          {trials.map((status: TrialStatus, index: number) => {
             const statusClasses = {
                untouched: 'bg-muted/50 border-dashed text-muted-foreground',
                correct: 'bg-green-100 dark:bg-green-900/50 border-green-500 text-green-600 dark:text-green-400',
                incorrect: 'bg-red-100 dark:bg-red-900/50 border-red-500 text-red-600 dark:text-red-400',
                approximate: 'bg-yellow-100 dark:bg-yellow-900/50 border-yellow-500 text-yellow-600 dark:text-yellow-400',
             };
             const Icon = status === 'correct' ? Check : status === 'incorrect' ? X : status === 'approximate' ? () => <span className="font-bold">A</span> : CircleHelp;

            return (
              <Button
                key={index}
                type="button"
                variant="outline"
                size="icon"
                className={cn("h-8 w-8 rounded-full transition-all", statusClasses[status], isFocused && index === focusedTrialIndex && "ring-2 ring-primary ring-offset-2")}
                onClick={(e) => handleTrialClick(index, e)}
                disabled={isArchived}
                title={`Trial ${index + 1}: ${status}. Click to change.`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>
      </FormItem>
       <div className="mt-1.5">
          <FormLabel>Accuracy</FormLabel>
          <p className="text-sm font-semibold text-primary h-8 flex items-center">
          {calculateAccuracy()}
          </p>
      </div>
    </>
  );
}
