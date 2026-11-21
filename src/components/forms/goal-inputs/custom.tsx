'use client';

import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Minus, Play, Square, RotateCcw, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { summarizeDuration } from '@/lib/goal-constants/behavior';
import { defaultCustomGoalType } from '@/lib/goal-types/custom';
import type { CustomGoalType } from '@/lib/types';
import { FormItem, FormLabel, type GoalInputContext } from './shared';
import { TrialInputs } from './trials';
import { LatencyInput } from '../behavior-inputs';
import LanguageSampleInput from '../LanguageSampleInput';

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function CustomGoalInputs({ ctx, customTypeOverride }: { ctx: GoalInputContext; customTypeOverride?: CustomGoalType }) {
  const { goal, data, isArchived, isLocked, handleChange, handleInteraction, calculateAccuracy } = ctx;
  const ct = customTypeOverride ?? goal.customType ?? defaultCustomGoalType('fallback');
  const [, setTick] = useState(0);

  useEffect(() => {
    if (ct.kind !== 'timer' || !data.runningSince) return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [ct.kind, data.runningSince]);

  const updateWhole = (fields: Record<string, any>) => {
    const firstKey = Object.keys(fields)[0] || 'recorded';
    handleChange(firstKey, { ...data, ...fields });
  };

  // The behavior tools' update: a patch, or a function of the latest data that returns one.
  const updateFields = (fields: Record<string, any> | ((current: Record<string, any>) => Record<string, any>)) => {
    if (typeof fields === 'function') {
      handleChange('behavior', (current: Record<string, any>) => {
        const patch = fields(current);
        return patch === current ? current : { ...current, ...patch };
      });
    } else {
      handleChange(Object.keys(fields)[0] ?? 'behavior', (current: Record<string, any>) => ({ ...current, ...fields }));
    }
  };

  const renderKindInputs = () => {
    switch (ct.kind) {
      case 'prompting':
        // The prompt level counters under the card record the tallies (as for the Prompting type).
        return (
          <p className="text-xs text-muted-foreground">
            Tally each {(ct.prompting?.label || 'response').toLowerCase()} below by the prompt it needed.
            <span className="ml-1 font-semibold text-primary" aria-live="polite">{calculateAccuracy()}</span>
          </p>
        );
      case 'trials':
        return <TrialInputs ctx={ctx} />;
      case 'latency':
        return (
          <LatencyInput
            data={data}
            update={updateFields}
            interact={handleInteraction}
            disabled={isArchived}
            isLocked={isLocked}
            goalId={goal.id}
            communication
          />
        );
      case 'utterances':
        return (
          <LanguageSampleInput
            unit={ct.utterances?.unit === 'morphemes' ? 'morphemes' : 'words'}
            data={data}
            update={next => handleChange('utterances', next)}
            interact={handleInteraction}
            disabled={isArchived}
            isLocked={isLocked}
            goalId={goal.id}
            showNotes={false}
          />
        );
      case 'accuracy': {
        const correctLabel = ct.accuracy?.correctLabel || 'Correct';
        const incorrectLabel = ct.accuracy?.incorrectLabel || 'Incorrect';
        const showApprox = ct.accuracy?.approximate !== false;
        return (
          <div className="grid grid-cols-2 gap-1.5">
            <FormItem>
              <FormLabel>{correctLabel}</FormLabel>
              <div className="flex items-center gap-1">
                <Button
                  aria-label={`Decrease ${correctLabel}`}
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 min-h-11 min-w-11 shrink-0 touch-manipulation"
                  onClick={(e) => handleInteraction(e, () => handleChange('correct', Math.max(0, (Number(data.correct) || 0) - 1)))}
                  disabled={isArchived}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  aria-label={correctLabel}
                  type="number"
                  min="0"
                  value={data.correct ?? 0}
                  onChange={(e) => handleChange('correct', Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="h-9 text-sm text-center w-16"
                  disabled={isArchived || isLocked}
                />
                <Button
                  aria-label={`Increase ${correctLabel}`}
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 min-h-11 min-w-11 shrink-0 touch-manipulation"
                  onClick={(e) => handleInteraction(e, () => handleChange('correct', (Number(data.correct) || 0) + 1))}
                  disabled={isArchived}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </FormItem>

            {showApprox && (
              <FormItem>
                <FormLabel>Approx.</FormLabel>
                <div className="flex items-center gap-1">
                  <Button
                    aria-label="Decrease Approximate"
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 min-h-11 min-w-11 shrink-0 touch-manipulation"
                    onClick={(e) => handleInteraction(e, () => handleChange('approximate', Math.max(0, (Number(data.approximate) || 0) - 1)))}
                    disabled={isArchived}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    aria-label="Approximate"
                    type="number"
                    min="0"
                    value={data.approximate ?? 0}
                    onChange={(e) => handleChange('approximate', Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="h-9 text-sm text-center w-16"
                    disabled={isArchived || isLocked}
                  />
                  <Button
                    aria-label="Increase Approximate"
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 min-h-11 min-w-11 shrink-0 touch-manipulation"
                    onClick={(e) => handleInteraction(e, () => handleChange('approximate', (Number(data.approximate) || 0) + 1))}
                    disabled={isArchived}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </FormItem>
            )}

            <FormItem>
              <FormLabel>{incorrectLabel}</FormLabel>
              <div className="flex items-center gap-1">
                <Button
                  aria-label={`Decrease ${incorrectLabel}`}
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 min-h-11 min-w-11 shrink-0 touch-manipulation"
                  onClick={(e) => handleInteraction(e, () => handleChange('incorrect', Math.max(0, (Number(data.incorrect) || 0) - 1)))}
                  disabled={isArchived}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  aria-label={incorrectLabel}
                  type="number"
                  min="0"
                  value={data.incorrect ?? 0}
                  onChange={(e) => handleChange('incorrect', Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="h-9 text-sm text-center w-16"
                  disabled={isArchived || isLocked}
                />
                <Button
                  aria-label={`Increase ${incorrectLabel}`}
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 min-h-11 min-w-11 shrink-0 touch-manipulation"
                  onClick={(e) => handleInteraction(e, () => handleChange('incorrect', (Number(data.incorrect) || 0) + 1))}
                  disabled={isArchived}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </FormItem>

            <div className="mt-1.5">
              <FormLabel>Accuracy</FormLabel>
              <p className="text-sm font-semibold text-primary h-8 flex items-center">
                {calculateAccuracy()}
              </p>
            </div>
          </div>
        );
      }

      case 'counter': {
        const label = ct.counter?.label || 'Count';
        const count = Math.max(0, Number(data.count) || 0);
        return (
          <div className="space-y-1.5">
            <FormItem>
              <FormLabel>{label}</FormLabel>
              <div className="flex items-center gap-2">
                <Button
                  aria-label={`Decrease ${label}`}
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 min-h-11 min-w-11 shrink-0 touch-manipulation"
                  onClick={(e) => handleInteraction(e, () => handleChange('count', Math.max(0, count - 1)))}
                  disabled={isArchived}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  aria-label={label}
                  type="number"
                  min="0"
                  value={count}
                  onChange={(e) => handleChange('count', Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="h-10 text-base font-semibold text-center w-20"
                  disabled={isArchived || isLocked}
                />
                <Button
                  aria-label={`Increase ${label}`}
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 min-h-11 min-w-11 shrink-0 touch-manipulation"
                  onClick={(e) => handleInteraction(e, () => handleChange('count', count + 1))}
                  disabled={isArchived}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground ml-1">{calculateAccuracy()}</span>
              </div>
            </FormItem>
            {ct.counter?.perMinute && (
              <FormItem>
                <FormLabel>Observation Minutes</FormLabel>
                <Input
                  aria-label="Observation Minutes"
                  type="number"
                  min="0"
                  step="any"
                  value={data.observationMinutes ?? ''}
                  onChange={(e) => handleChange('observationMinutes', e.target.value)}
                  placeholder="e.g., 20"
                  className="h-8 text-sm w-28"
                  disabled={isArchived || isLocked}
                />
              </FormItem>
            )}
          </div>
        );
      }

      case 'timer': {
        const label = ct.timer?.label || 'Timer';
        const summary = summarizeDuration(data);
        const episodes: number[] = summary.episodes;
        const start = () => updateWhole({ runningSince: Date.now() });
        const stop = () => updateWhole({
          episodeSeconds: [...episodes, summary.runningSeconds],
          episodeStarts: [...(Array.isArray(data.episodeStarts) ? data.episodeStarts : []), new Date(Number(data.runningSince)).toISOString()],
          runningSince: null,
        });
        const reset = () => updateWhole({
          episodeSeconds: [],
          episodeStarts: [],
          runningSince: null,
          totalSeconds: 0,
          episodeCount: 0,
        });
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-mono text-xl font-bold tabular-nums min-w-[4.5rem]">
                {formatClock(summary.totalSeconds)}
              </div>
              <Button
                type="button"
                size="sm"
                variant={summary.running ? 'destructive' : 'default'}
                className="min-h-10 touch-manipulation"
                onClick={(e) => handleInteraction(e, summary.running ? stop : start)}
                disabled={isArchived}
              >
                {summary.running ? <><Square className="h-3.5 w-3.5 mr-1.5" />Stop</> : <><Play className="h-3.5 w-3.5 mr-1.5" />Start</>}
              </Button>
              {(summary.totalSeconds > 0 || summary.running) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10 touch-manipulation"
                  onClick={(e) => handleInteraction(e, reset)}
                  disabled={isArchived}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />Reset
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{calculateAccuracy()}</span>
            </div>
          </FormItem>
        );
      }

      case 'rating': {
        const min = ct.rating?.min ?? 1;
        const max = ct.rating?.max ?? 5;
        const levels: number[] = [];
        for (let l = min; l <= max; l++) levels.push(l);
        const current = data.rating !== undefined && data.rating !== null && data.rating !== '' ? Number(data.rating) : undefined;
        return (
          <FormItem>
            <FormLabel>Rating ({min}–{max})</FormLabel>
            <div
              className="grid gap-1.5 pt-0.5"
              style={{ gridTemplateColumns: `repeat(${Math.min(levels.length, 5)}, minmax(0, 1fr))` }}
            >
              {levels.map((level, idx) => {
                const selected = current === level;
                const levelLabel = ct.rating?.levelLabels?.[idx] || '';
                return (
                  <Button
                    key={level}
                    type="button"
                    variant={selected ? 'default' : 'outline'}
                    className={cn(
                      'h-auto min-h-11 py-1.5 px-2 flex flex-col items-center justify-center text-center touch-manipulation',
                      selected && 'ring-2 ring-primary ring-offset-1',
                    )}
                    onClick={(e) => handleInteraction(e, () => handleChange('rating', level))}
                    disabled={isArchived}
                    aria-pressed={selected}
                  >
                    <span className="text-sm font-bold leading-none">{level}</span>
                    {levelLabel && (
                      <span className={cn('text-[11px] leading-tight mt-0.5 line-clamp-1', selected ? 'text-primary-foreground/90' : 'text-muted-foreground')}>
                        {levelLabel}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </FormItem>
        );
      }

      case 'checklist': {
        const stepLabels = ct.checklist?.steps?.length ? ct.checklist.steps : ['Step 1'];
        const steps: boolean[] = Array.isArray(data.steps) ? data.steps : [];
        const toggleStep = (index: number, checked: boolean) => {
          const next = stepLabels.map((_, i) => (i === index ? checked : Boolean(steps[i])));
          handleChange('steps', next);
        };
        return (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Checklist Steps</FormLabel>
              <span className="text-xs font-semibold text-primary">{calculateAccuracy()}</span>
            </div>
            <div className="space-y-1.5 pt-0.5">
              {stepLabels.map((stepLabel, idx) => {
                const checked = Boolean(steps[idx]);
                const stepId = `custom-step-${goal.id}-${idx}`;
                return (
                  <label
                    key={idx}
                    htmlFor={stepId}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer transition-colors',
                      checked ? 'border-primary/60 bg-primary/5 font-medium' : 'border-border bg-background/60',
                      (isArchived || isLocked) && 'pointer-events-none opacity-60',
                    )}
                  >
                    <Checkbox
                      id={stepId}
                      checked={checked}
                      onCheckedChange={(val) => toggleStep(idx, Boolean(val))}
                      disabled={isArchived || isLocked}
                    />
                    <span className="flex-1">{stepLabel}</span>
                  </label>
                );
              })}
            </div>
          </FormItem>
        );
      }

      case 'yesno': {
        const question = ct.yesno?.question || 'Met the criterion this session?';
        return (
          <FormItem>
            <FormLabel>{question}</FormLabel>
            <div className="flex items-center gap-2 pt-0.5">
              <Button
                type="button"
                size="sm"
                variant={data.met === true ? 'default' : 'outline'}
                className="min-h-10 flex-1 touch-manipulation"
                onClick={(e) => handleInteraction(e, () => handleChange('met', true))}
                disabled={isArchived}
                aria-pressed={data.met === true}
              >
                <Check className="h-4 w-4 mr-1" />Yes
              </Button>
              <Button
                type="button"
                size="sm"
                variant={data.met === false ? 'default' : 'outline'}
                className="min-h-10 flex-1 touch-manipulation"
                onClick={(e) => handleInteraction(e, () => handleChange('met', false))}
                disabled={isArchived}
                aria-pressed={data.met === false}
              >
                <X className="h-4 w-4 mr-1" />No
              </Button>
            </div>
          </FormItem>
        );
      }
    }
  };

  return (
    <div className="space-y-1.5">
      {renderKindInputs()}
      {ct.extras?.notes !== false && (
        <FormItem>
          <FormLabel>Notes</FormLabel>
          <Textarea
            value={data.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Notes for this goal…"
            rows={1}
            className="text-sm"
            disabled={isArchived || isLocked}
          />
        </FormItem>
      )}
    </div>
  );
}
