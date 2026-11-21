'use client';

import React, { useEffect, useMemo, useState } from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomGoalTypeSchema, CUSTOM_MEASURE_KINDS, type CustomChartId, type CustomGoalType, type CustomMeasureKind, type Goal, type TargetDirection } from '@/lib/types';
import {
  CUSTOM_MEASURE_KIND_INFO,
  CUSTOM_TYPE_COLORS,
  customChartOptions,
  customChartShown,
  customChartStyle,
  defaultCustomGoalType,
  makeCustomDef,
} from '@/lib/goal-types/custom';
import { formatGoalTarget } from '@/lib/helpers';
import { applyFieldChange, clearTrials, cycleTrial, goalAccuracyText, scoreNextTrial, undoLastTrial } from '@/lib/goal-input-logic';
import { CustomGoalInputs } from '@/components/forms/goal-inputs/custom';
import PromptLevelCounters from '@/components/forms/goal-inputs/prompt-counters';
import type { GoalInputContext } from '@/components/forms/goal-inputs/shared';

interface CustomGoalTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: CustomGoalType | null;
  onSave: (saved: CustomGoalType) => void;
  saveCustomType: (draft: Omit<CustomGoalType, 'id' | 'version' | 'createdAt'> & { id?: string; version?: number; createdAt?: string }) => CustomGoalType;
}

const SAMPLE_DATES = ['Oct 1', 'Oct 8', 'Oct 15', 'Oct 22', 'Oct 29', 'Nov 5'];

function sampleValuesFor(ct: CustomGoalType): number[] {
  switch (ct.kind) {
    case 'accuracy':
      return [55, 60, 58, 70, 75, 80];
    case 'counter':
      return [2, 3, 3, 5, 4, 6];
    case 'timer':
      return [4, 6, 5, 8, 9, 11];
    case 'rating': {
      const min = ct.rating?.min ?? 1;
      const max = ct.rating?.max ?? 5;
      const span = Math.max(1, max - min);
      return [0, 0.25, 0.25, 0.5, 0.75, 1].map(p => Math.round(min + p * span));
    }
    case 'checklist':
      return [25, 33, 50, 67, 75, 100];
    case 'yesno':
      return [0, 100, 0, 100, 100, 100];
    case 'prompting':
      return [20, 30, 40, 55, 65, 80];
    case 'trials':
      return [50, 60, 60, 70, 80, 90];
    case 'latency':
      return [12, 10, 9, 7, 6, 4];
    case 'utterances':
      return [1.8, 2.1, 2.3, 2.6, 2.9, 3.2];
  }
}

export default function CustomGoalTypeModal({
  isOpen,
  onClose,
  initialType,
  onSave,
  saveCustomType,
}: CustomGoalTypeModalProps) {
  const [draft, setDraft] = useState<CustomGoalType>(() => initialType ?? defaultCustomGoalType('preview'));
  const [previewData, setPreviewData] = useState<Record<string, any>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const start = initialType ? JSON.parse(JSON.stringify(initialType)) : defaultCustomGoalType('preview');
    setDraft(start);
    setPreviewData(makeCustomDef(start).initialData());
    setErrorMessage(null);
  }, [isOpen, initialType]);

  const def = useMemo(() => makeCustomDef(draft), [draft]);

  const setKind = (kind: CustomMeasureKind) => {
    const defaultTarget = kind === 'rating'
      ? Math.max(draft.rating?.min ?? 1, (draft.rating?.max ?? 5) - 1)
      : CUSTOM_MEASURE_KIND_INFO[kind].defaultTarget;
    // A response time aims to come down; switching to or from it sets the matching direction.
    const direction: TargetDirection = kind === 'latency' ? 'decrease' : draft.kind === 'latency' ? 'increase' : draft.direction;
    const next: CustomGoalType = { ...draft, kind, defaultTarget, direction };
    setDraft(next);
    setPreviewData(makeCustomDef(next).initialData());
  };

  const setRatingBounds = (min: number, max: number) => {
    const safeMin = Math.max(0, Math.min(8, Math.floor(min)));
    const safeMax = Math.max(safeMin + 1, Math.min(safeMin + 9, Math.min(10, Math.floor(max))));
    const oldMin = draft.rating?.min ?? 1;
    const oldLabels = draft.rating?.levelLabels ?? [];
    const levelLabels: string[] = [];
    for (let l = safeMin; l <= safeMax; l++) {
      levelLabels.push(oldLabels[l - oldMin] ?? '');
    }
    const defaultTarget = draft.defaultTarget !== undefined
      ? Math.min(safeMax, Math.max(safeMin, draft.defaultTarget))
      : Math.max(safeMin, safeMax - 1);
    setDraft({
      ...draft,
      rating: { min: safeMin, max: safeMax, levelLabels },
      defaultTarget,
    });
  };

  const previewGoal: Goal = useMemo(() => ({
    id: 'preview-goal',
    name: draft.name.trim() || 'Sample goal',
    type: 'CUSTOM',
    smartGoal: `Sample goal measured with ${draft.name.trim() || 'custom type'}.`,
    sessionTargetValue: draft.defaultTarget,
    targetDirection: draft.direction,
    customType: draft,
  }), [draft]);

  const previewCtx: GoalInputContext = {
    goal: previewGoal,
    data: previewData,
    captureType: 'CUSTOM',
    isArchived: false,
    isLocked: false,
    isFocused: false,
    handleChange: (field, value) => {
      if (typeof value === 'function') {
        setPreviewData(prev => value(prev));
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        setPreviewData(value);
      } else {
        setPreviewData(prev => ({ ...prev, [field]: value }));
      }
    },
    adjustCount: (field, delta) => {
      setPreviewData(prev => ({ ...prev, [field]: Math.max(0, (Number(prev[field]) || 0) + delta) }));
    },
    handleInteraction: (_e, cb) => cb(),
    calculateAccuracy: () => goalAccuracyText(previewGoal, previewData),
    handleTrialClick: (index) => setPreviewData(prev => applyFieldChange('CUSTOM', prev, 'trials', cycleTrial(prev, index))),
    handleFillNextTrial: (status) => setPreviewData(prev => {
      const trials = scoreNextTrial(prev, status);
      return trials ? applyFieldChange('CUSTOM', prev, 'trials', trials) : prev;
    }),
    handleClearTrials: () => setPreviewData(prev => applyFieldChange('CUSTOM', prev, 'trials', clearTrials(prev))),
    handleUndoLastTrial: () => setPreviewData(prev => {
      const trials = undoLastTrial(prev);
      return trials ? applyFieldChange('CUSTOM', prev, 'trials', trials) : prev;
    }),
  };

  const sampleChart = useMemo(() => {
    const info = def.measureInfo(previewGoal);
    const values = sampleValuesFor(draft);
    const target = draft.defaultTarget ?? CUSTOM_MEASURE_KIND_INFO[draft.kind].defaultTarget;
    const min = info.min ?? 0;
    const max = info.max ?? Math.max(...values, target, 1) * 1.2;
    const w = 400;
    const h = 135;
    const x = (i: number) => 28 + (i * (w - 42)) / Math.max(1, values.length - 1);
    const y = (v: number) => h - 22 - ((v - min) / Math.max(1, max - min)) * (h - 38);
    const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const avgFormatted = def.formatValue(previewGoal, avg);
    const targetFormatted = formatGoalTarget(previewGoal, target, draft.direction);
    const sentence = `Across ${values.length} sessions with data, ${def.narrativeNoun(previewGoal)} averaged ${avgFormatted} against a target of ${targetFormatted}.`;
    return { info, values, target, w, h, x, y, points, sentence };
  }, [def, draft, previewGoal]);

  // Reports charts: the progress chart's style and the extra charts that fit the measure (all of them until chosen).
  const chartOptions = customChartOptions(draft);
  const chartStyle = customChartStyle(draft);
  const shownCharts = chartOptions.filter(o => customChartShown(draft, o.id)).map(o => o.id);
  const setCharts = (style: 'line' | 'bar', show: CustomChartId[]) => setDraft({ ...draft, charts: { style, show } });
  const toggleChart = (id: CustomChartId, on: boolean) =>
    setCharts(chartStyle, on ? [...new Set([...shownCharts, id])] : shownCharts.filter(c => c !== id));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const candidate: CustomGoalType = {
      ...draft,
      id: initialType?.id || 'temp-id',
      version: initialType?.version || 1,
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      createdAt: initialType?.createdAt || new Date().toISOString(),
    };
    const parsed = CustomGoalTypeSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message || 'Please check the fields and try again.');
      return;
    }
    try {
      const saved = saveCustomType({
        ...parsed.data,
        id: initialType?.id,
      });
      onSave(saved);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not save custom goal type.');
    }
  };

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialType ? `Edit Custom Goal Type: ${initialType.name}` : 'Create Custom Goal Type'}
      description="Build a reusable goal type from measurement pieces. Existing goals keep a snapshot of the type as it was when they were created."
      size="3xl"
    >
      <form onSubmit={handleSave} className="max-h-[78vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left column: Builder configuration */}
          <div className="lg:col-span-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="custom-type-name">Goal Type Name</Label>
                <Input
                  id="custom-type-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g., Peer interaction quality"
                />
              </div>
              <div className="space-y-1">
                <Label>Badge Color</Label>
                <div className="flex items-center gap-1.5 pt-1.5">
                  {CUSTOM_TYPE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setDraft({ ...draft, color })}
                      className={cn(
                        'h-6 w-6 rounded-full transition-transform',
                        draft.color === color && 'ring-2 ring-offset-2 ring-foreground scale-110',
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                      aria-pressed={draft.color === color}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="custom-type-description">Description (optional)</Label>
              <Input
                id="custom-type-description"
                value={draft.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Shown in Help and the goal type picker"
              />
            </div>

            <div className="space-y-1.5">
              <Label>How is it measured?</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CUSTOM_MEASURE_KINDS.map((kind) => {
                  const info = CUSTOM_MEASURE_KIND_INFO[kind];
                  const active = draft.kind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setKind(kind)}
                      className={cn(
                        'rounded-lg border p-2.5 text-left transition-colors',
                        active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:border-primary/50',
                      )}
                      aria-pressed={active}
                    >
                      <div className="text-xs font-semibold text-foreground">{info.label}</div>
                      <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{info.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Method-specific settings */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              {draft.kind === 'accuracy' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="custom-acc-correct">“Correct” button label</Label>
                      <Input
                        id="custom-acc-correct"
                        value={draft.accuracy?.correctLabel ?? 'Correct'}
                        onChange={(e) => setDraft({
                          ...draft,
                          accuracy: { ...(draft.accuracy ?? { correctLabel: 'Correct', incorrectLabel: 'Incorrect', approximate: true }), correctLabel: e.target.value },
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="custom-acc-incorrect">“Incorrect” button label</Label>
                      <Input
                        id="custom-acc-incorrect"
                        value={draft.accuracy?.incorrectLabel ?? 'Incorrect'}
                        onChange={(e) => setDraft({
                          ...draft,
                          accuracy: { ...(draft.accuracy ?? { correctLabel: 'Correct', incorrectLabel: 'Incorrect', approximate: true }), incorrectLabel: e.target.value },
                        })}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={draft.accuracy?.approximate !== false}
                      onCheckedChange={(checked) => setDraft({
                        ...draft,
                        accuracy: { ...(draft.accuracy ?? { correctLabel: 'Correct', incorrectLabel: 'Incorrect', approximate: true }), approximate: Boolean(checked) },
                      })}
                    />
                    Include “Approximate” tally
                  </label>
                </>
              )}

              {draft.kind === 'counter' && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="custom-counter-label">What are you counting?</Label>
                    <Input
                      id="custom-counter-label"
                      value={draft.counter?.label ?? 'Occurrences'}
                      onChange={(e) => setDraft({
                        ...draft,
                        counter: { ...(draft.counter ?? { label: 'Occurrences', perMinute: false }), label: e.target.value },
                      })}
                      placeholder="e.g., Initiations, Self-advocacy requests"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={Boolean(draft.counter?.perMinute)}
                      onCheckedChange={(checked) => setDraft({
                        ...draft,
                        counter: { ...(draft.counter ?? { label: 'Occurrences', perMinute: false }), perMinute: Boolean(checked) },
                      })}
                    />
                    Report as rate per minute (adds an Observation Minutes field)
                  </label>
                </>
              )}

              {draft.kind === 'timer' && (
                <div className="space-y-1">
                  <Label htmlFor="custom-timer-label">What are you timing?</Label>
                  <Input
                    id="custom-timer-label"
                    value={draft.timer?.label ?? 'Duration'}
                    onChange={(e) => setDraft({ ...draft, timer: { label: e.target.value } })}
                    placeholder="e.g., Engaged play, Regulation break"
                  />
                </div>
              )}

              {draft.kind === 'rating' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="custom-rating-min">Lowest level</Label>
                      <Input
                        id="custom-rating-min"
                        type="number"
                        min={0}
                        max={8}
                        value={draft.rating?.min ?? 1}
                        onChange={(e) => setRatingBounds(Number(e.target.value), draft.rating?.max ?? 5)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="custom-rating-max">Highest level</Label>
                      <Input
                        id="custom-rating-max"
                        type="number"
                        min={1}
                        max={10}
                        value={draft.rating?.max ?? 5}
                        onChange={(e) => setRatingBounds(draft.rating?.min ?? 1, Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Level labels (optional)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {Array.from({ length: (draft.rating?.max ?? 5) - (draft.rating?.min ?? 1) + 1 }, (_, i) => {
                        const level = (draft.rating?.min ?? 1) + i;
                        return (
                          <div key={level} className="flex items-center gap-1.5">
                            <span className="w-5 text-right text-xs font-semibold text-muted-foreground">{level}</span>
                            <Input
                              value={draft.rating?.levelLabels?.[i] ?? ''}
                              onChange={(e) => {
                                const nextLabels = [...(draft.rating?.levelLabels ?? [])];
                                nextLabels[i] = e.target.value;
                                setDraft({
                                  ...draft,
                                  rating: { min: draft.rating?.min ?? 1, max: draft.rating?.max ?? 5, levelLabels: nextLabels },
                                });
                              }}
                              placeholder={`Level ${level} label`}
                              className="h-8 text-xs"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {draft.kind === 'checklist' && (
                <div className="space-y-2">
                  <Label>Checklist steps</Label>
                  <div className="space-y-1.5">
                    {(draft.checklist?.steps ?? []).map((step, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="w-5 text-right text-xs text-muted-foreground">{idx + 1}.</span>
                        <Input
                          value={step}
                          onChange={(e) => {
                            const nextSteps = [...(draft.checklist?.steps ?? [])];
                            nextSteps[idx] = e.target.value;
                            setDraft({ ...draft, checklist: { steps: nextSteps } });
                          }}
                          placeholder={`Step ${idx + 1}`}
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => {
                            const nextSteps = (draft.checklist?.steps ?? []).filter((_, i) => i !== idx);
                            setDraft({ ...draft, checklist: { steps: nextSteps.length ? nextSteps : [''] } });
                          }}
                          aria-label={`Remove step ${idx + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextSteps = [...(draft.checklist?.steps ?? []), `Step ${(draft.checklist?.steps?.length ?? 0) + 1}`];
                      setDraft({ ...draft, checklist: { steps: nextSteps } });
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />Add step
                  </Button>
                </div>
              )}

              {draft.kind === 'prompting' && (
                <div className="space-y-1">
                  <Label htmlFor="custom-prompting-label">What is each tally?</Label>
                  <Input
                    id="custom-prompting-label"
                    value={draft.prompting?.label ?? 'Responses'}
                    onChange={(e) => setDraft({ ...draft, prompting: { label: e.target.value } })}
                    placeholder="e.g., Requests, Transitions"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Each tally is recorded with the prompt it needed: Independent, Visual, Verbal, Gestural, Partial physical or Model.
                  </p>
                </div>
              )}

              {draft.kind === 'trials' && (
                <div className="space-y-1">
                  <Label htmlFor="custom-trials-count">Trials per session</Label>
                  <Input
                    id="custom-trials-count"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    className="w-28"
                    value={draft.trials?.count ?? 10}
                    onChange={(e) => {
                      const n = Math.floor(Number(e.target.value));
                      const count = Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 10;
                      const next = { ...draft, trials: { count } };
                      setDraft(next);
                      setPreviewData(makeCustomDef(next).initialData());
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">The number of trials can still be changed for a session in Data Entry.</p>
                </div>
              )}

              {draft.kind === 'latency' && (
                <div className="space-y-1">
                  <Label htmlFor="custom-latency-label">What does the student respond with?</Label>
                  <Input
                    id="custom-latency-label"
                    value={draft.latency?.label ?? 'Response'}
                    onChange={(e) => setDraft({ ...draft, latency: { label: e.target.value } })}
                    placeholder="e.g., Responds to name, Starts the task"
                  />
                </div>
              )}

              {draft.kind === 'utterances' && (
                <div className="space-y-1">
                  <Label htmlFor="custom-utterance-unit">Count utterances in</Label>
                  <Select
                    value={draft.utterances?.unit ?? 'words'}
                    onValueChange={(val) => {
                      const next = { ...draft, utterances: { unit: val as 'words' | 'morphemes' } };
                      setDraft(next);
                      setPreviewData(makeCustomDef(next).initialData());
                    }}
                  >
                    <SelectTrigger id="custom-utterance-unit" className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="words">Words (MLU-w)</SelectItem>
                      <SelectItem value="morphemes">Morphemes (MLU-m)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {draft.kind === 'yesno' && (
                <div className="space-y-1">
                  <Label htmlFor="custom-yesno-question">Session question</Label>
                  <Input
                    id="custom-yesno-question"
                    value={draft.yesno?.question ?? 'Met the criterion this session?'}
                    onChange={(e) => setDraft({ ...draft, yesno: { question: e.target.value } })}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="custom-default-target">Default session target</Label>
                <Input
                  id="custom-default-target"
                  type="number"
                  step="any"
                  value={draft.defaultTarget ?? ''}
                  onChange={(e) => setDraft({
                    ...draft,
                    defaultTarget: e.target.value === '' ? undefined : Number(e.target.value),
                  })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="custom-direction">Target direction</Label>
                <Select
                  value={draft.direction}
                  onValueChange={(val) => setDraft({ ...draft, direction: val as TargetDirection })}
                >
                  <SelectTrigger id="custom-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase">Increase (higher is better)</SelectItem>
                    <SelectItem value="decrease">Decrease (lower is better)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <Label className="text-xs font-semibold">Extras on each goal card</Label>
              <div className="flex flex-wrap gap-4">
                {draft.kind !== 'prompting' && <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={Boolean(draft.extras?.promptLevel)}
                    onCheckedChange={(checked) => setDraft({
                      ...draft,
                      extras: { ...(draft.extras ?? { promptLevel: false, notes: true }), promptLevel: Boolean(checked) },
                    })}
                  />
                  Record prompt level counters
                </label>}
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={draft.extras?.notes !== false}
                    onCheckedChange={(checked) => setDraft({
                      ...draft,
                      extras: { ...(draft.extras ?? { promptLevel: false, notes: true }), notes: Boolean(checked) },
                    })}
                  />
                  Notes box for each goal
                </label>
              </div>
            </div>

            <fieldset className="space-y-2 border-t border-border pt-3">
              <legend className="text-xs font-semibold">Charts in Reports</legend>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Progress chart style">
                <span className="text-xs text-muted-foreground">Progress chart:</span>
                {(['line', 'bar'] as const).map(style => (
                  <button
                    key={style}
                    type="button"
                    aria-pressed={chartStyle === style}
                    onClick={() => setCharts(style, shownCharts)}
                    className={cn(
                      'h-9 min-h-11 rounded-md border px-3 text-xs font-medium',
                      chartStyle === style ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary' : 'border-input bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {style === 'line' ? 'Line' : 'Bars'}
                  </button>
                ))}
              </div>
              {chartOptions.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Also show:</span>
                  {chartOptions.map(option => (
                    <label key={option.id} className="flex items-start gap-2 text-xs cursor-pointer">
                      <Checkbox
                        className="mt-0.5"
                        checked={shownCharts.includes(option.id)}
                        onCheckedChange={(checked) => toggleChart(option.id, Boolean(checked))}
                      />
                      <span>
                        <span className="font-medium text-foreground">{option.label}</span>
                        <span className="block text-muted-foreground">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">This measure has no extra charts; Reports show its progress chart and figures.</p>
              )}
            </fieldset>

            {errorMessage && (
              <p role="alert" className="text-xs font-medium text-destructive">{errorMessage}</p>
            )}
          </div>

          {/* Right column: Live preview */}
          <div className="lg:col-span-2 space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live Preview
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Data Entry card (interactive)</div>
              <div className="rounded-lg border border-border bg-card p-2.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{draft.name.trim() || 'Untitled Goal Type'}</div>
                    {draft.defaultTarget !== undefined && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        Target: {formatGoalTarget(previewGoal, draft.defaultTarget, draft.direction)}
                      </div>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs inline-flex items-center gap-1"
                    style={{ borderColor: draft.color }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: draft.color }} aria-hidden />
                    {draft.name.trim() || 'Custom'}
                  </Badge>
                </div>
                <CustomGoalInputs ctx={previewCtx} customTypeOverride={draft} />
                {(draft.extras?.promptLevel || draft.kind === 'prompting') && (
                  <PromptLevelCounters
                    captureType="CUSTOM"
                    data={previewData}
                    onChange={(_field, nextData) => setPreviewData(nextData)}
                    isArchived={false}
                    interact={(_e, cb) => cb()}
                  />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Progress chart ({sampleChart.info.label})</div>
              <div className="rounded-lg border border-border bg-card p-2">
                <svg viewBox={`0 0 ${sampleChart.w} ${sampleChart.h}`} className="w-full h-32">
                  <line
                    x1={28}
                    x2={sampleChart.w - 12}
                    y1={sampleChart.y(sampleChart.target)}
                    y2={sampleChart.y(sampleChart.target)}
                    stroke="currentColor"
                    className="text-muted-foreground/60"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={sampleChart.w - 14}
                    y={Math.max(12, sampleChart.y(sampleChart.target) - 4)}
                    textAnchor="end"
                    fontSize="10"
                    fill="currentColor"
                    className="text-muted-foreground"
                  >
                    target {sampleChart.target}{sampleChart.info.unit}
                  </text>
                  {chartStyle === 'bar' ? sampleChart.values.map((v, i) => (
                    <rect key={i} x={sampleChart.x(i) - 12} y={sampleChart.y(v)} width={24}
                      height={Math.max(0, sampleChart.h - 22 - sampleChart.y(v))} rx={2} fill={draft.color} />
                  )) : (
                    <>
                      <polyline
                        points={sampleChart.points}
                        fill="none"
                        stroke={draft.color}
                        strokeWidth="2.5"
                      />
                      {sampleChart.values.map((v, i) => (
                        <circle key={i} cx={sampleChart.x(i)} cy={sampleChart.y(v)} r="3.5" fill={draft.color} />
                      ))}
                    </>
                  )}
                  {SAMPLE_DATES.map((d, i) => (
                    <text
                      key={d}
                      x={sampleChart.x(i)}
                      y={sampleChart.h - 4}
                      fontSize="10"
                      textAnchor="middle"
                      fill="currentColor"
                      className="text-muted-foreground"
                    >
                      {d}
                    </text>
                  ))}
                </svg>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {shownCharts.length
                  ? `Also in Reports: ${chartOptions.filter(o => shownCharts.includes(o.id)).map(o => o.label).join(', ')}.`
                  : 'No extra charts in Reports.'}
              </p>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Report narrative &amp; formula</div>
              <div className="rounded-lg border border-border bg-card p-2.5 space-y-1.5 text-xs">
                <p>{sampleChart.sentence}</p>
                <p className="text-muted-foreground border-t border-border pt-1.5">
                  <strong className="text-foreground">How it&apos;s calculated:</strong> {def.formulaText(previewGoal)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border mt-4 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {initialType ? 'Save Changes' : 'Save Goal Type'}
          </Button>
        </div>
      </form>
    </GenericModal>
  );
}
