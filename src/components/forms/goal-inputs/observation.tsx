'use client';

import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { FormItem, FormLabel, type GoalInputContext } from './shared';

// Data Entry inputs for goal types (see goal-data-input.tsx, which picks the inputs for a goal's type).

/** Qualitative observation and cognitive: notes and a 1-5 rating. */
export function ObservationInputs({ ctx }: { ctx: GoalInputContext }) {
  const { data, isArchived, isLocked, handleChange } = ctx;
  return (
    <>
      <FormItem>
        <FormLabel>Observation Notes</FormLabel>
        <Textarea
          value={data.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Describe observed behaviors, participation, etc."
          rows={1}
          className="text-sm"
          disabled={isArchived || isLocked}
        />
      </FormItem>
      <FormItem>
        <FormLabel>Rating (1-5)</FormLabel>
        <Slider
          value={[data.rating ?? 3]}
          min={1} max={5} step={1}
          onValueChange={(value) => handleChange('rating', value[0])}
          className="pt-2"
          disabled={isArchived || isLocked}
        />
        <div className="text-center text-xs font-medium mt-1">{data.rating ?? 3}</div>
      </FormItem>
    </>
  );
}

/** Prompting: notes (the prompt levels are counted below the inputs). */
export function PromptingInputs({ ctx }: { ctx: GoalInputContext }) {
  const { data, isArchived, isLocked, handleChange } = ctx;
  return (
    <FormItem>
      <FormLabel>Context/Observation Notes</FormLabel>
      <Textarea
        value={data.notes || ''}
        onChange={(e) => handleChange('notes', e.target.value)}
        placeholder="Describe the task or context for the prompting"
        rows={2}
        className="text-sm"
        disabled={isArchived || isLocked}
      />
    </FormItem>
  );
}
