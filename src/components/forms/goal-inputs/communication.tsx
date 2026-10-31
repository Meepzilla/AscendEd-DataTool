'use client';

import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import TallyButton from '../TallyButton';
import { COMMUNICATION_FUNCTIONS, STORY_PARTS, STORY_PART_SCORE_LABELS, STORY_LINKING_WORDS, linkingWordField } from '@/lib/goal-constants';
import { FormItem, FormLabel, type GoalInputContext } from './shared';

// Data Entry inputs for goal types (see goal-data-input.tsx, which picks the inputs for a goal's type).

/** Communication functions: each function used spontaneously or prompted. */
export function CommunicationFunctionsInputs({ ctx }: { ctx: GoalInputContext }) {
  const { data, isArchived, isLocked, handleChange, handleInteraction, calculateAccuracy } = ctx;
  const tally = (field: string, delta: number) => (e: React.SyntheticEvent<HTMLButtonElement>) =>
    handleInteraction(e, () => handleChange(field, Math.max(0, (Number(data[field]) || 0) + delta)));
  return (
    <>
      <FormItem>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-1.5 gap-y-1">
          <FormLabel>Function</FormLabel>
          <FormLabel>Spontaneous</FormLabel>
          <FormLabel>Prompted</FormLabel>
          {COMMUNICATION_FUNCTIONS.map(({ key, label }) => (
            <React.Fragment key={key}>
              <span className="text-xs">{label}</span>
              <TallyButton
                label="S"
                count={Number(data[`${key}Spontaneous`]) || 0}
                title={`${label}, spontaneous`}
                className="border-green-600 text-green-700 dark:text-green-400"
                disabled={isArchived}
                onIncrement={tally(`${key}Spontaneous`, 1)}
                onDecrement={tally(`${key}Spontaneous`, -1)}
              />
              <TallyButton
                label="P"
                count={Number(data[`${key}Prompted`]) || 0}
                title={`${label}, prompted`}
                className="border-yellow-600 text-yellow-700 dark:text-yellow-400"
                disabled={isArchived}
                onIncrement={tally(`${key}Prompted`, 1)}
                onDecrement={tally(`${key}Prompted`, -1)}
              />
            </React.Fragment>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Tap to add a use. Press and hold (or right-click) to remove one.</p>
      </FormItem>
      <div className="mt-1.5">
        <FormLabel>Functions Used</FormLabel>
        <p className="text-sm font-semibold text-primary">{calculateAccuracy()}</p>
      </div>
      <FormItem>
        <FormLabel>Notes</FormLabel>
        <Textarea
          value={data.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="e.g., Context, communication modes used"
          rows={1}
          className="text-sm"
          disabled={isArchived || isLocked}
        />
      </FormItem>
    </>
  );
}

/** Story elements: each story part scored 0-2, and linking words. */
export function StoryElementsInputs({ ctx }: { ctx: GoalInputContext }) {
  const { data, isArchived, isLocked, handleChange, handleInteraction, calculateAccuracy } = ctx;
  return (
    <>
      <FormItem>
        <FormLabel>Story Parts (0 Missing · 1 Partial · 2 Complete)</FormLabel>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
          {STORY_PARTS.map(({ key, label }) => {
            const score = Number(data[key]) || 0;
            return (
              <React.Fragment key={key}>
                <span className="text-xs">{label}</span>
                <div className="flex gap-1" role="radiogroup" aria-label={label}>
                  {[0, 1, 2].map(value => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={score === value ? 'default' : 'outline'}
                      role="radio"
                      aria-checked={score === value}
                      className="h-7 w-8 px-0 text-xs touch-manipulation"
                      title={`${label}: ${STORY_PART_SCORE_LABELS[value]}`}
                      onClick={(e) => handleInteraction(e, () => handleChange(key, value))}
                      disabled={isArchived}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </FormItem>
      <div className="mt-1.5">
        <FormLabel>Story Score</FormLabel>
        <p className="text-sm font-semibold text-primary">{calculateAccuracy()}</p>
      </div>
      <FormItem>
        <FormLabel>Linking Words</FormLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {STORY_LINKING_WORDS.map(word => {
            const field = linkingWordField(word);
            const change = (delta: number) => (e: React.SyntheticEvent<HTMLButtonElement>) =>
              handleInteraction(e, () => handleChange(field, Math.max(0, (Number(data[field]) || 0) + delta)));
            return (
              <TallyButton
                key={word}
                label={word}
                count={Number(data[field]) || 0}
                title={`Linking word "${word}"`}
                className="w-full"
                disabled={isArchived}
                onIncrement={change(1)}
                onDecrement={change(-1)}
              />
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">Tap to count a linking word. Press and hold (or right-click) to remove one.</p>
      </FormItem>
      <FormItem>
        <FormLabel>Story / Notes</FormLabel>
        <Textarea
          value={data.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="e.g., Story used, retell or personal story, supports given"
          rows={1}
          className="text-sm"
          disabled={isArchived || isLocked}
        />
      </FormItem>
    </>
  );
}
