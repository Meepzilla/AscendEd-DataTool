'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import { FormItem, FormLabel, type GoalInputContext } from './shared';

// Data Entry inputs for goal types (see goal-data-input.tsx, which picks the inputs for a goal's type).

/** Fluency: syllables and each kind of dysfluency. */
export function FluencyInputs({ ctx }: { ctx: GoalInputContext }) {
  const { data, isArchived, isLocked, handleChange, handleInteraction, calculateAccuracy } = ctx;
  return (
    <>
      <div className="grid grid-cols-2 gap-1">
        <FormItem>
          <FormLabel>Total Syllables</FormLabel>
           <div className="flex items-center gap-1">
            <Button aria-label="Decrease Total Syllables" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('totalSyllables', Math.max(0, (Number(data.totalSyllables) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
            <Input aria-label="Total Syllables" type="number" min="0" value={data.totalSyllables ?? 0} onChange={(e) => handleChange('totalSyllables', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
            <Button aria-label="Increase Total Syllables" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('totalSyllables', (Number(data.totalSyllables) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
          </div>
        </FormItem>
        <FormItem>
          <FormLabel>Stuttered Syllables</FormLabel>
          <div className="flex items-center gap-1">
            <Button aria-label="Decrease Stuttered Syllables" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('stutteredSyllables', Math.max(0, (Number(data.stutteredSyllables) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
            <Input aria-label="Stuttered Syllables" type="number" min="0" value={data.stutteredSyllables ?? 0} onChange={(e) => handleChange('stutteredSyllables', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
            <Button aria-label="Increase Stuttered Syllables" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('stutteredSyllables', (Number(data.stutteredSyllables) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
          </div>
        </FormItem>
         <div className="mt-1.5 col-span-2">
          <FormLabel>Fluency Percentage</FormLabel>
          <p className="text-sm font-semibold text-primary h-8 flex items-center">
              {calculateAccuracy()}
          </p>
      </div>
      </div>
       <div className="grid grid-cols-2 gap-1">
          <FormItem>
              <FormLabel>Blocks</FormLabel>
              <div className="flex items-center gap-1">
                  <Button aria-label="Decrease Blocks" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('blocks', Math.max(0, (Number(data.blocks) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
                  <Input aria-label="Blocks" type="number" min="0" value={data.blocks ?? 0} onChange={(e) => handleChange('blocks', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
                  <Button aria-label="Increase Blocks" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('blocks', (Number(data.blocks) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <FormItem>
              <FormLabel>Repetitions</FormLabel>
              <div className="flex items-center gap-1">
                  <Button aria-label="Decrease Repetitions" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('repetitions', Math.max(0, (Number(data.repetitions) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
                  <Input aria-label="Repetitions" type="number" min="0" value={data.repetitions ?? 0} onChange={(e) => handleChange('repetitions', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
                  <Button aria-label="Increase Repetitions" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('repetitions', (Number(data.repetitions) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
           <FormItem>
              <FormLabel>Prolongations</FormLabel>
              <div className="flex items-center gap-1">
                  <Button aria-label="Decrease Prolongations" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('prolongations', Math.max(0, (Number(data.prolongations) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
                  <Input aria-label="Prolongations" type="number" min="0" value={data.prolongations ?? 0} onChange={(e) => handleChange('prolongations', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
                  <Button aria-label="Increase Prolongations" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('prolongations', (Number(data.prolongations) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <FormItem>
              <FormLabel>Interjections</FormLabel>
              <div className="flex items-center gap-1">
                  <Button aria-label="Decrease Interjections" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('interjections', Math.max(0, (Number(data.interjections) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
                  <Input aria-label="Interjections" type="number" min="0" value={data.interjections ?? 0} onChange={(e) => handleChange('interjections', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
                  <Button aria-label="Increase Interjections" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('interjections', (Number(data.interjections) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
      </div>
       <FormItem>
        <FormLabel>Secondary Behaviors (notes)</FormLabel>
        <Textarea
          value={data.secondaryBehaviors || ''}
          onChange={(e) => handleChange('secondaryBehaviors', e.target.value)}
          placeholder="e.g., eye blinking, head nodding"
          rows={1}
          className="text-sm"
          disabled={isArchived || isLocked}
        />
      </FormItem>
       <FormItem>
        <FormLabel>Observation Notes (Type of stutter, context, etc.)</FormLabel>
        <Textarea
          value={data.observationNotes || ''}
          onChange={(e) => handleChange('observationNotes', e.target.value)}
          placeholder="e.g., Repetitions on initial sounds..."
          rows={1}
          className="text-sm"
          disabled={isArchived || isLocked}
        />
      </FormItem>
    </>
  );
}
