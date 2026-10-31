'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import { FormItem, FormLabel, type GoalInputContext } from './shared';

// Data Entry inputs for goal types (see goal-data-input.tsx, which picks the inputs for a goal's type).

/** Articulation and AAC: target, word list, and correct / approximate / incorrect counts. */
export function CorrectIncorrectInputs({ ctx }: { ctx: GoalInputContext }) {
  const { data, isArchived, isLocked, handleChange, handleInteraction, calculateAccuracy } = ctx;
  return (
    <>
      <div className="grid grid-cols-2 gap-1">
        <FormItem>
          <FormLabel>Target Sound/Word</FormLabel>
          <Input
            type="text"
            value={data.targetSound || ''}
            onChange={(e) => handleChange('targetSound', e.target.value)}
            placeholder="e.g., /s/, 'sun'"
            className="h-8 text-sm"
            disabled={isArchived || isLocked}
          />
        </FormItem>
        <FormItem>
          <FormLabel>Word List (optional)</FormLabel>
          <Input
            type="text"
            value={data.wordList || ''}
            onChange={(e) => handleChange('wordList', e.target.value)}
            placeholder="e.g., cat, car, cup"
            className="h-8 text-sm"
            disabled={isArchived || isLocked}
          />
        </FormItem>
      </div>
      <div className="grid grid-cols-2 gap-1">
          <FormItem>
              <FormLabel>Correct</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Correct" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('correct', Math.max(0, (Number(data.correct) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Correct" type="number" min="0" value={data.correct ?? 0} onChange={(e) => handleChange('correct', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Correct" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('correct', (Number(data.correct) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <FormItem>
              <FormLabel>Approx.</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Approximate" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('approximate', Math.max(0, (Number(data.approximate) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Approximate" type="number" min="0" value={data.approximate ?? 0} onChange={(e) => handleChange('approximate', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Approximate" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('approximate', (Number(data.approximate) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <FormItem>
              <FormLabel>Incorrect</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Incorrect" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('incorrect', Math.max(0, (Number(data.incorrect) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Incorrect" type="number" min="0" value={data.incorrect ?? 0} onChange={(e) => handleChange('incorrect', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Incorrect" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('incorrect', (Number(data.incorrect) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <div className="mt-1.5">
              <FormLabel>Accuracy</FormLabel>
              <p className="text-sm font-semibold text-primary h-8 flex items-center">
              {calculateAccuracy()}
              </p>
          </div>
      </div>
    </>
  );
}

/** Feeding and swallowing: trials accepted and refused. */
export function FeedingInputs({ ctx }: { ctx: GoalInputContext }) {
  const { data, isArchived, isLocked, handleChange, handleInteraction, calculateAccuracy } = ctx;
  return (
    <>
      <div className="grid grid-cols-2 gap-1">
        <FormItem>
          <FormLabel>Food/Liquid Name</FormLabel>
          <Input
            type="text"
            value={data.foodOrLiquidName || ''}
            onChange={(e) => handleChange('foodOrLiquidName', e.target.value)}
            placeholder="e.g., Apple sauce"
            className="h-8 text-sm"
            disabled={isArchived || isLocked}
          />
        </FormItem>
        <FormItem>
          <FormLabel>Texture/Consistency</FormLabel>
          <Input
            type="text"
            value={data.textureOrConsistency || ''}
            onChange={(e) => handleChange('textureOrConsistency', e.target.value)}
            placeholder="e.g., Pureed"
            className="h-8 text-sm"
            disabled={isArchived || isLocked}
          />
        </FormItem>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <FormItem>
          <FormLabel>Trials Accepted</FormLabel>
          <div className="flex items-center gap-1">
            <Button aria-label="Decrease Trials Accepted" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('trialsAccepted', Math.max(0, (Number(data.trialsAccepted) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
            <Input aria-label="Trials Accepted" type="number" min="0" value={data.trialsAccepted ?? 0} onChange={(e) => handleChange('trialsAccepted', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
            <Button aria-label="Increase Trials Accepted" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('trialsAccepted', (Number(data.trialsAccepted) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
          </div>
        </FormItem>
        <FormItem>
          <FormLabel>Trials Refused</FormLabel>
          <div className="flex items-center gap-1">
            <Button aria-label="Decrease Trials Refused" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('trialsRefused', Math.max(0, (Number(data.trialsRefused) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
            <Input aria-label="Trials Refused" type="number" min="0" value={data.trialsRefused ?? 0} onChange={(e) => handleChange('trialsRefused', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
            <Button aria-label="Increase Trials Refused" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('trialsRefused', (Number(data.trialsRefused) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
          </div>
        </FormItem>
           <div className="mt-1.5 col-span-2">
              <FormLabel>Accuracy</FormLabel>
              <p className="text-sm font-semibold text-primary h-8 flex items-center">
              {calculateAccuracy()}
              </p>
          </div>
      </div>
       <FormItem>
        <FormLabel>Observation Notes</FormLabel>
        <Textarea
          value={data.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="e.g., Coughing, pocketing, time to swallow"
          rows={1}
          className="text-sm"
          disabled={isArchived || isLocked}
        />
      </FormItem>
    </>
  );
}

/** Language comprehension: questions answered correctly and incorrectly. */
export function ComprehensionInputs({ ctx }: { ctx: GoalInputContext }) {
  const { data, isArchived, isLocked, handleChange, handleInteraction, calculateAccuracy } = ctx;
  return (
    <>
       <FormItem>
        <FormLabel>Details / Target Skill</FormLabel>
        <Input
          type="text"
          value={data.details || ''}
          onChange={(e) => handleChange('details', e.target.value)}
          placeholder="e.g., WH-questions, 2-step directions"
          className="h-8 text-sm"
          disabled={isArchived || isLocked}
        />
      </FormItem>
      <div className="grid grid-cols-2 gap-1">
          <FormItem>
              <FormLabel>Correct</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Correct" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('questionsCorrect', Math.max(0, (Number(data.questionsCorrect) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Correct" type="number" min="0" value={data.questionsCorrect ?? 0} onChange={(e) => handleChange('questionsCorrect', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Correct" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('questionsCorrect', (Number(data.questionsCorrect) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <FormItem>
              <FormLabel>Approx.</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Approximate" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('approximate', Math.max(0, (Number(data.approximate) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Approximate" type="number" min="0" value={data.approximate ?? 0} onChange={(e) => handleChange('approximate', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Approximate" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('approximate', (Number(data.approximate) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <FormItem>
              <FormLabel>Incorrect</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Incorrect" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('questionsIncorrect', Math.max(0, (Number(data.questionsIncorrect) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Incorrect" type="number" min="0" value={data.questionsIncorrect ?? 0} onChange={(e) => handleChange('questionsIncorrect', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Incorrect" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('questionsIncorrect', (Number(data.questionsIncorrect) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <div className="mt-1.5">
              <FormLabel>Accuracy</FormLabel>
              <p className="text-sm font-semibold text-primary h-8 flex items-center">
              {calculateAccuracy()}
              </p>
          </div>
      </div>
    </>
  );
}

/** Language expression: successful and unsuccessful responses. */
export function ExpressionInputs({ ctx }: { ctx: GoalInputContext }) {
  const { data, isArchived, isLocked, handleChange, handleInteraction, calculateAccuracy } = ctx;
   return (
    <>
       <FormItem>
        <FormLabel>Details / Target Skill</FormLabel>
        <Input
          type="text"
          value={data.details || ''}
          onChange={(e) => handleChange('details', e.target.value)}
          placeholder="e.g., Past tense verbs, describing objects"
          className="h-8 text-sm"
          disabled={isArchived || isLocked}
        />
      </FormItem>
      <div className="grid grid-cols-2 gap-1">
          <FormItem>
              <FormLabel>Correct</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Correct" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('successfulResponses', Math.max(0, (Number(data.successfulResponses) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Correct" type="number" min="0" value={data.successfulResponses ?? 0} onChange={(e) => handleChange('successfulResponses', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Correct" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('successfulResponses', (Number(data.successfulResponses) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <FormItem>
              <FormLabel>Approx.</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Approximate" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('approximate', Math.max(0, (Number(data.approximate) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Approximate" type="number" min="0" value={data.approximate ?? 0} onChange={(e) => handleChange('approximate', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Approximate" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('approximate', (Number(data.approximate) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <FormItem>
              <FormLabel>Incorrect</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Incorrect" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('unsuccessfulResponses', Math.max(0, (Number(data.unsuccessfulResponses) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Incorrect" type="number" min="0" value={data.unsuccessfulResponses ?? 0} onChange={(e) => handleChange('unsuccessfulResponses', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Incorrect" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('unsuccessfulResponses', (Number(data.unsuccessfulResponses) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <div className="mt-1.5">
              <FormLabel>Accuracy</FormLabel>
              <p className="text-sm font-semibold text-primary h-8 flex items-center">
              {calculateAccuracy()}
              </p>
          </div>
      </div>
    </>
  );
}

/** Phonological processes: correct and incorrect productions. */
export function PhonologicalInputs({ ctx }: { ctx: GoalInputContext }) {
  const { data, isArchived, isLocked, handleChange, handleInteraction, calculateAccuracy } = ctx;
  return (
    <>
       <FormItem>
        <FormLabel>Target Process</FormLabel>
        <Input
          type="text"
          value={data.targetProcess || ''}
          onChange={(e) => handleChange('targetProcess', e.target.value)}
          placeholder="e.g., Fronting, Stopping"
          className="h-8 text-sm"
          disabled={isArchived || isLocked}
        />
      </FormItem>
      <div className="grid grid-cols-2 gap-1">
          <FormItem>
              <FormLabel>Correct</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Correct" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('correctProductions', Math.max(0, (Number(data.correctProductions) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Correct" type="number" min="0" value={data.correctProductions ?? 0} onChange={(e) => handleChange('correctProductions', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Correct" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('correctProductions', (Number(data.correctProductions) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <FormItem>
              <FormLabel>Approx.</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Approximate" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('approximate', Math.max(0, (Number(data.approximate) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Approximate" type="number" min="0" value={data.approximate ?? 0} onChange={(e) => handleChange('approximate', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Approximate" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('approximate', (Number(data.approximate) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <FormItem>
              <FormLabel>Incorrect</FormLabel>
              <div className="flex items-center gap-1">
              <Button aria-label="Decrease Incorrect" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('incorrectProductions', Math.max(0, (Number(data.incorrectProductions) || 0) - 1)))} disabled={isArchived}><Minus className="h-4 w-4" /></Button>
              <Input aria-label="Incorrect" type="number" min="0" value={data.incorrectProductions ?? 0} onChange={(e) => handleChange('incorrectProductions', parseInt(e.target.value, 10) || 0)} className="h-9 text-sm text-center w-16" disabled={isArchived || isLocked} />
              <Button aria-label="Increase Incorrect" type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 touch-manipulation" onClick={(e) => handleInteraction(e, () => handleChange('incorrectProductions', (Number(data.incorrectProductions) || 0) + 1))} disabled={isArchived}><Plus className="h-4 w-4" /></Button>
              </div>
          </FormItem>
          <div className="mt-1.5">
              <FormLabel>Accuracy</FormLabel>
              <p className="text-sm font-semibold text-primary h-8 flex items-center">
              {calculateAccuracy()}
              </p>
          </div>
      </div>
    </>
  );
}
