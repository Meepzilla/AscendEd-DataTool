'use client';

import React, { useState } from 'react';
import { Undo2, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { GoalDataUpdater } from '@/lib/types';
import {
  MAX_UTTERANCE_LENGTH, UTTERANCE_BUTTONS, addUtterance, formatSampleLength, languageSampleSummary, removeUtterance,
  sessionSampleUnit, utteranceLengths, type SampleUnit,
} from '@/lib/language-sample';

// Data Entry for a language sample (MLU) goal: tap the length of each utterance as the student says it (in words or
// morphemes, as set on the goal); longer ones are typed in. The running MLU, the number of utterances and the
// longest are shown below. Tapping an utterance in the list removes it.

interface Props {
  unit: SampleUnit;
  data: Record<string, any>;
  update: (data: GoalDataUpdater) => void;
  interact: (e: React.SyntheticEvent<HTMLButtonElement>, callback: () => void) => void;
  disabled?: boolean;
  isLocked?: boolean;
  goalId: string;
}

export default function LanguageSampleInput({ unit: goalUnit, data, update, interact, disabled, isLocked, goalId }: Props) {
  const [typed, setTyped] = useState('');
  const unit = sessionSampleUnit(data, { sampleUnit: goalUnit });
  const lengths = utteranceLengths(data);
  const summary = languageSampleSummary(data);
  const unitWord = unit === 'morphemes' ? 'morphemes' : 'words';

  const add = (n: number) => update(current => addUtterance(current, n, goalUnit));
  const typedNumber = Number(typed);
  const typedValid = Number.isInteger(typedNumber) && typedNumber >= 1 && typedNumber <= MAX_UTTERANCE_LENGTH;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground" id={`ls-help-${goalId}`}>
        Tap the number of {unitWord} in each utterance.
      </p>
      <div className="flex flex-wrap gap-1" role="group" aria-label={`Utterance length in ${unitWord}`} aria-describedby={`ls-help-${goalId}`}>
        {UTTERANCE_BUTTONS.map(n => (
          <button
            key={n}
            type="button"
            aria-label={`Add an utterance of ${n} ${n === 1 ? unitWord.slice(0, -1) : unitWord}`}
            disabled={disabled}
            onClick={e => interact(e, () => add(n))}
            className="h-11 min-w-11 rounded-md border border-input bg-background px-2 text-base font-semibold tabular-nums touch-manipulation hover:bg-accent disabled:opacity-50"
          >
            {n}
          </button>
        ))}
      </div>
      <form
        className="space-y-1"
        onSubmit={e => {
          e.preventDefault();
          if (!typedValid || disabled || isLocked) return;
          add(typedNumber);
          setTyped('');
        }}
      >
        <Label htmlFor={`ls-len-${goalId}`} className="block text-xs">Longer utterance ({unitWord})</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`ls-len-${goalId}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_UTTERANCE_LENGTH}
            value={typed}
            onChange={e => setTyped(e.target.value)}
            className="h-11 w-24 text-base"
            disabled={disabled || isLocked}
          />
        <Button type="submit" variant="outline" className="h-11" disabled={!typedValid || disabled || isLocked}>Add</Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11"
          disabled={disabled || lengths.length === 0}
          onClick={e => interact(e, () => update(current => removeUtterance(current)))}
        >
          <Undo2 className="mr-1 h-4 w-4" aria-hidden="true" />Undo last
        </Button>
        </div>
      </form>
      {lengths.length > 0 && (
        <ol className="flex flex-wrap gap-1" aria-label="Utterances recorded (tap one to remove it)">
          {lengths.map((n, i) => (
            <li key={i}>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove utterance ${i + 1} (${n} ${unitWord})`}
                onClick={e => interact(e, () => update(current => removeUtterance(current, i)))}
                className="inline-flex h-8 min-w-8 items-center gap-0.5 rounded-full border border-input bg-muted/40 px-2 text-xs tabular-nums hover:bg-destructive/10 disabled:opacity-50"
              >
                {n}<X className="h-3 w-3 opacity-60" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm font-semibold text-primary" aria-live="polite">
        {summary.mlu === null
          ? 'No utterances recorded yet'
          : `MLU ${formatSampleLength(summary.mlu, unit)} · ${summary.utterances} utterance${summary.utterances === 1 ? '' : 's'} · longest ${summary.longest}`}
      </p>
      <div className="space-y-1">
        <Label htmlFor={`ls-notes-${goalId}`} className="text-xs">Notes</Label>
        <Textarea
          id={`ls-notes-${goalId}`}
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
