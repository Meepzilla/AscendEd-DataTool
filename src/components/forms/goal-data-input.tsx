
'use client';

import React from 'react';
import type { Goal, SessionGoalData, PromptType, GoalType, TrialStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { PROMPT_TYPES, PROMPT_COLORS, PROMPT_ABBREVIATIONS, PROMPT_HOTKEY_MAP } from '@/lib/promptConstants';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatGoalTarget, goalTypeLabel } from '@/lib/helpers';
import { TrendingUp, ArrowUp, ArrowDown, Plus, Minus, ArchiveIcon, Pin, Check, X, CircleHelp, RotateCcw, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useConfetti } from '@/hooks/use-confetti';
import { useLongPress, longPressStyle } from '@/hooks/use-long-press';
import TallyButton from './TallyButton';
import { FrequencyInput, DurationInput, AbcInput } from './behavior-inputs';
import {
  COMMUNICATION_FUNCTIONS, summarizeCommunicationFunctions,
  STORY_PARTS, STORY_PART_SCORE_LABELS, STORY_LINKING_WORDS, linkingWordField, scoreStory,
  GOAL_TYPES_WITHOUT_PROMPT_COUNTERS,
} from '@/lib/goal-constants';

interface GoalDataInputComponentProps {
  goal: Goal;
  data: SessionGoalData['data'];
  onChange: (updatedFieldName: string, newData: SessionGoalData['data']) => void;
  isFocused?: boolean;
  onSetFocus?: () => void;
  id: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isArchived?: boolean;
  isLocked?: boolean;
}

export default function GoalDataInputComponent({
  goal,
  data,
  onChange,
  isFocused,
  onSetFocus,
  id,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isArchived,
  isLocked = false,
}: GoalDataInputComponentProps) {
  const { toast } = useToast();
  const { fire } = useConfetti();

  const handleInteraction = (e: React.SyntheticEvent<HTMLButtonElement>, callback: () => void) => {
    if (isArchived) return;

    if (isLocked) {
      fire();
      return;
    }
    callback();
  };

  const handleChange = (field: string, value: any) => {
    // This function is now only for logic, not for checking lock status
    let newData = { ...data, [field]: value };

    // If a fluency dysfluency is incremented, also increment total syllables.
    const isIncrementing = value > (data[field] || 0);
    if (goal.dataCaptureType === 'FLUENCY_SYLLABLE_STUTTER' && isIncrementing && ['stutteredSyllables', 'blocks', 'repetitions', 'interjections'].includes(field)) {
        const incrementAmount = value - (data[field] || 0);
        newData.totalSyllables = (newData.totalSyllables || 0) + incrementAmount;
    }

    if (field === 'numberOfTrials') {
      const newSize = Math.max(1, Number(value) || 1);
      const oldTrials = Array.isArray(data.trials) ? data.trials : [];
      const newTrials = Array(newSize).fill('untouched');
      for (let i = 0; i < Math.min(oldTrials.length, newSize); i++) {
        newTrials[i] = oldTrials[i];
      }
      newData.trials = newTrials;
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      onChange(field, value);
    } else {
      onChange(field, newData);
    }
  };


  const calculateAccuracy = (): string => {
    let correct: number;
    let totalOpportunities: number;
    const type = goal.dataCaptureType || goal.type;
    let actualPerformancePct: number;

    switch (type) {
      case 'ARTICULATION':
      case 'AAC':
        correct = Number(data.correct || 0);
        totalOpportunities = correct + Number(data.incorrect || 0) + Number(data.approximate || 0);
        break;
      case 'LANGUAGE_COMPREHENSION':
        correct = Number(data.questionsCorrect || 0);
        totalOpportunities = correct + Number(data.questionsIncorrect || 0) + Number(data.approximate || 0);
        break;
      case 'LANGUAGE_EXPRESSION':
        correct = Number(data.successfulResponses || 0);
        totalOpportunities = correct + Number(data.unsuccessfulResponses || 0) + Number(data.approximate || 0);
        break;
      case 'PHONOLOGICAL_PROCESSES':
        correct = Number(data.correctProductions || 0);
        totalOpportunities = correct + Number(data.incorrectProductions || 0) + Number(data.approximate || 0);
        break;
      case 'FLUENCY_SYLLABLE_STUTTER':
        totalOpportunities = Number(data.totalSyllables || 0);
        const stutteredSyllables = Number(data.stutteredSyllables || 0);
        const blocks = Number(data.blocks || 0);
        const repetitions = Number(data.repetitions || 0);
        const interjections = Number(data.interjections || 0);
        const totalDysfluencies = stutteredSyllables + blocks + repetitions + interjections;
        correct = Math.max(0, totalOpportunities - totalDysfluencies);
        break;
      case 'FEEDING_SWALLOWING':
        correct = Number(data.trialsAccepted || 0);
        totalOpportunities = correct + Number(data.trialsRefused || 0);
        break;
      case 'SEQUENCED_TRIALS': {
        const successful = Number(data.successfulAttempts || 0);
        const failed = Number(data.failedAttempts || 0);
        const approx = Number(data.approximate || 0);
        totalOpportunities = successful + failed + approx;
        correct = successful;
        break;
      }
      case 'DISCRETE_TRIALS': {
        const trials = data.trials || [];
        correct = trials.filter((t: TrialStatus) => t === 'correct').length;
        const validTrials = trials.filter((t: TrialStatus) => t !== 'untouched').length;
        actualPerformancePct = validTrials > 0 ? (correct / validTrials) * 100 : 0;
        return `${actualPerformancePct.toFixed(1)}% (${correct}/${validTrials})`;
      }
      case 'COMMUNICATION_FUNCTIONS': {
        const summary = summarizeCommunicationFunctions(data);
        return `${summary.functionsUsedSpontaneously} of ${summary.functionCount} used spontaneously (${summary.spontaneous} spontaneous, ${summary.prompted} prompted)`;
      }
      case 'STORY_CHAMPS': {
        const story = scoreStory(data);
        return `${story.percent.toFixed(1)}% (${story.points}/${story.maxPoints} points)`;
      }
      case 'PROMPTING':
      case 'QUALITATIVE_OBSERVATION':
      case 'COGNITIVE':
      default:
        return 'N/A';
    }

    if (totalOpportunities === 0) return 'N/A (0%)';
    
    actualPerformancePct = (correct / totalOpportunities) * 100;
    return `${actualPerformancePct.toFixed(1)}% (${correct}/${totalOpportunities})`;
  };

  const handleTrialClick = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => {
      const currentTrials: TrialStatus[] = Array.isArray(data.trials) ? [...data.trials] : Array(data.numberOfTrials || 5).fill('untouched');
      const currentState = currentTrials[index] || 'untouched';
      const nextStateCycle: Record<TrialStatus, TrialStatus> = {
        'untouched': 'correct',
        'correct': 'approximate',
        'approximate': 'incorrect',
        'incorrect': 'untouched',
      };
      currentTrials[index] = nextStateCycle[currentState];
      handleChange('trials', currentTrials);
    });
  };

  const handleFillNextTrial = (status: TrialStatus, e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => {
        const currentTrials: TrialStatus[] = Array.isArray(data.trials) ? [...data.trials] : Array(data.numberOfTrials || 5).fill('untouched');
        const nextUntouchedIndex = currentTrials.indexOf('untouched');

        if (nextUntouchedIndex !== -1) {
            currentTrials[nextUntouchedIndex] = status;
            handleChange('trials', currentTrials);
        } else {
            toast({
                title: "All Trials Filled",
                description: "All available trials have been recorded.",
                variant: "default",
            });
        }
    });
  };

  const handleClearTrials = (e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => {
      const currentTrials: TrialStatus[] = Array.isArray(data.trials) ? data.trials : [];
      const clearedTrials = Array(currentTrials.length).fill('untouched');
      handleChange('trials', clearedTrials);
    });
  };

  const handleUndoLastTrial = (e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => {
      const currentTrials: TrialStatus[] = Array.isArray(data.trials) ? [...data.trials] : [];
      const lastFilledIndex = currentTrials.map((t, i) => (t !== 'untouched' ? i : -1)).filter(i => i !== -1).pop();

      if (lastFilledIndex !== undefined) {
        currentTrials[lastFilledIndex] = 'untouched';
        handleChange('trials', currentTrials);
      } else {
        toast({ title: "Nothing to Undo", description: "No trials have been marked yet.", variant: "default" });
      }
    });
  };


  const renderInputFields = () => {
    const captureType = goal.dataCaptureType || goal.type;
    switch (captureType) {
      case 'AAC':
      case 'ARTICULATION':
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
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('correct', Math.max(0, (Number(data.correct) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.correct ?? 0} onChange={(e) => handleChange('correct', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('correct', (Number(data.correct) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                </FormItem>
                <FormItem>
                    <FormLabel>Approx.</FormLabel>
                    <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('approximate', Math.max(0, (Number(data.approximate) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.approximate ?? 0} onChange={(e) => handleChange('approximate', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('approximate', (Number(data.approximate) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                </FormItem>
                <FormItem>
                    <FormLabel>Incorrect</FormLabel>
                    <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('incorrect', Math.max(0, (Number(data.incorrect) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.incorrect ?? 0} onChange={(e) => handleChange('incorrect', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('incorrect', (Number(data.incorrect) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
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
      case 'SEQUENCED_TRIALS':
      case 'DISCRETE_TRIALS': {
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
                  max="20"
                  value={data.numberOfTrials ?? ''}
                  onChange={(e) => handleChange('numberOfTrials', e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                  className="h-8 text-sm text-center w-20"
                  disabled={isArchived || isLocked}
                />
                 <div className="flex flex-wrap gap-1">
                    <Button size="sm" className="h-7 px-2 text-xs bg-green-500 hover:bg-green-600" onClick={(e) => handleFillNextTrial('correct', e)} disabled={isArchived || isLocked}>Correct</Button>
                    <Button size="sm" className="h-7 px-2 text-xs bg-yellow-500 hover:bg-yellow-600" onClick={(e) => handleFillNextTrial('approximate', e)} disabled={isArchived || isLocked}>Approx.</Button>
                    <Button size="sm" className="h-7 px-2 text-xs bg-red-500 hover:bg-red-600" onClick={(e) => handleFillNextTrial('incorrect', e)} disabled={isArchived || isLocked}>Incorrect</Button>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={(e) => handleUndoLastTrial(e)} disabled={isArchived || isLocked} title="Undo Last"><Undo2 className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={(e) => handleClearTrials(e)} disabled={isArchived || isLocked} title="Reset All"><RotateCcw className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </FormItem>
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
      case 'FEEDING_SWALLOWING':
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
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('trialsAccepted', Math.max(0, (Number(data.trialsAccepted) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.trialsAccepted ?? 0} onChange={(e) => handleChange('trialsAccepted', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('trialsAccepted', (Number(data.trialsAccepted) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
              <FormItem>
                <FormLabel>Trials Refused</FormLabel>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('trialsRefused', Math.max(0, (Number(data.trialsRefused) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.trialsRefused ?? 0} onChange={(e) => handleChange('trialsRefused', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('trialsRefused', (Number(data.trialsRefused) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
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
      case 'FLUENCY_SYLLABLE_STUTTER':
        return (
          <>
            <div className="grid grid-cols-2 gap-1">
              <FormItem>
                <FormLabel>Total Syllables</FormLabel>
                 <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('totalSyllables', Math.max(0, (Number(data.totalSyllables) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.totalSyllables ?? 0} onChange={(e) => handleChange('totalSyllables', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('totalSyllables', (Number(data.totalSyllables) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
              <FormItem>
                <FormLabel>Stuttered Syllables</FormLabel>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('stutteredSyllables', Math.max(0, (Number(data.stutteredSyllables) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.stutteredSyllables ?? 0} onChange={(e) => handleChange('stutteredSyllables', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('stutteredSyllables', (Number(data.stutteredSyllables) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
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
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('blocks', Math.max(0, (Number(data.blocks) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                        <Input type="number" min="0" value={data.blocks ?? 0} onChange={(e) => handleChange('blocks', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('blocks', (Number(data.blocks) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                </FormItem>
                <FormItem>
                    <FormLabel>Repetitions</FormLabel>
                    <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('repetitions', Math.max(0, (Number(data.repetitions) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                        <Input type="number" min="0" value={data.repetitions ?? 0} onChange={(e) => handleChange('repetitions', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('repetitions', (Number(data.repetitions) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                </FormItem>
                 <FormItem>
                    <FormLabel>Prolongations</FormLabel>
                    <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('prolongations', Math.max(0, (Number(data.prolongations) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                        <Input type="number" min="0" value={data.prolongations ?? 0} onChange={(e) => handleChange('prolongations', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('prolongations', (Number(data.prolongations) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                </FormItem>
                <FormItem>
                    <FormLabel>Interjections</FormLabel>
                    <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('interjections', Math.max(0, (Number(data.interjections) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                        <Input type="number" min="0" value={data.interjections ?? 0} onChange={(e) => handleChange('interjections', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('interjections', (Number(data.interjections) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
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
      case 'QUALITATIVE_OBSERVATION':
      case 'COGNITIVE':
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
      case 'PROMPTING':
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
      case 'LANGUAGE_COMPREHENSION':
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
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('questionsCorrect', Math.max(0, (Number(data.questionsCorrect) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.questionsCorrect ?? 0} onChange={(e) => handleChange('questionsCorrect', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('questionsCorrect', (Number(data.questionsCorrect) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                </FormItem>
                <FormItem>
                    <FormLabel>Approx.</FormLabel>
                    <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('approximate', Math.max(0, (Number(data.approximate) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.approximate ?? 0} onChange={(e) => handleChange('approximate', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('approximate', (Number(data.approximate) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                </FormItem>
                <FormItem>
                    <FormLabel>Incorrect</FormLabel>
                    <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('questionsIncorrect', Math.max(0, (Number(data.questionsIncorrect) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.questionsIncorrect ?? 0} onChange={(e) => handleChange('questionsIncorrect', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('questionsIncorrect', (Number(data.questionsIncorrect) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
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
      case 'LANGUAGE_EXPRESSION':
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
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('successfulResponses', Math.max(0, (Number(data.successfulResponses) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.successfulResponses ?? 0} onChange={(e) => handleChange('successfulResponses', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('successfulResponses', (Number(data.successfulResponses) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                </FormItem>
                <FormItem>
                    <FormLabel>Approx.</FormLabel>
                    <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('approximate', Math.max(0, (Number(data.approximate) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.approximate ?? 0} onChange={(e) => handleChange('approximate', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('approximate', (Number(data.approximate) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                </FormItem>
                <FormItem>
                    <FormLabel>Incorrect</FormLabel>
                    <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('unsuccessfulResponses', Math.max(0, (Number(data.unsuccessfulResponses) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.unsuccessfulResponses ?? 0} onChange={(e) => handleChange('unsuccessfulResponses', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('unsuccessfulResponses', (Number(data.unsuccessfulResponses) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
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
      case 'PHONOLOGICAL_PROCESSES':
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
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('correctProductions', Math.max(0, (Number(data.correctProductions) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.correctProductions ?? 0} onChange={(e) => handleChange('correctProductions', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('correctProductions', (Number(data.correctProductions) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                </FormItem>
                <FormItem>
                    <FormLabel>Approx.</FormLabel>
                    <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('approximate', Math.max(0, (Number(data.approximate) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.approximate ?? 0} onChange={(e) => handleChange('approximate', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('approximate', (Number(data.approximate) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                </FormItem>
                <FormItem>
                    <FormLabel>Incorrect</FormLabel>
                    <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('incorrectProductions', Math.max(0, (Number(data.incorrectProductions) || 0) - 1)))} disabled={isArchived}><Minus className="h-3.5 w-3.5" /></Button>
                    <Input type="number" min="0" value={data.incorrectProductions ?? 0} onChange={(e) => handleChange('incorrectProductions', parseInt(e.target.value, 10) || 0)} className="h-8 text-sm text-center w-16" disabled={isArchived || isLocked} />
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={(e) => handleInteraction(e, () => handleChange('incorrectProductions', (Number(data.incorrectProductions) || 0) + 1))} disabled={isArchived}><Plus className="h-3.5 w-3.5" /></Button>
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
      case 'COMMUNICATION_FUNCTIONS': {
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
      case 'STORY_CHAMPS':
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
      case 'BEHAVIOR_FREQUENCY':
      case 'BEHAVIOR_DURATION':
      case 'BEHAVIOR_ABC': {
        const behaviorProps = {
          data,
          // Several fields at once: handleChange treats an object as the goal's whole data.
          update: (fields: Record<string, any>) => handleChange(Object.keys(fields)[0], { ...data, ...fields }),
          interact: handleInteraction,
          disabled: isArchived,
          isLocked,
        };
        if (captureType === 'BEHAVIOR_FREQUENCY') return <FrequencyInput {...behaviorProps} />;
        if (captureType === 'BEHAVIOR_DURATION') return <DurationInput {...behaviorProps} />;
        return <AbcInput {...behaviorProps} />;
      }
      default:
        return <p className="text-muted-foreground text-xs">No specific data fields for this goal type.</p>;
    }
  };

  const showPromptCounters = !GOAL_TYPES_WITHOUT_PROMPT_COUNTERS.includes((goal.dataCaptureType || goal.type) as GoalType);


  return (
    <Card
      id={id}
      className={cn(
        "border-border bg-card/50 transition-all duration-150 ease-in-out relative",
        isFocused && "ring-2 ring-primary ring-offset-2 shadow-lg",
        isArchived && "opacity-60",
        isLocked && "bg-muted/30"
      )}>
       {isArchived && (
         <div className="absolute inset-0 bg-slate-500/10 dark:bg-slate-800/10 z-10 flex items-center justify-center rounded-lg pointer-events-none">
            <Badge variant="outline" className="bg-background text-orange-600 border-orange-500 p-1 px-2 text-xs rotate-[-15deg] shadow-md">
                <ArchiveIcon className="h-3 w-3 mr-1"/>Archived
            </Badge>
         </div>
       )}
      <CardHeader className="p-2 bg-muted/30 rounded-t-lg">
        <div className="flex justify-between items-start">
            <div className="flex items-center space-y-0.5 shrink-0 mr-1">
                {onMoveUp && (
                    <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={(e) => handleInteraction(e, onMoveUp!)} disabled={!canMoveUp || isArchived} title="Move goal up">
                        <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                )}
                {onMoveDown && (
                     <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={(e) => handleInteraction(e, onMoveDown!)} disabled={!canMoveDown || isArchived} title="Move goal down">
                        <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>
            <div className="flex-grow min-w-0" onClick={isLocked ? undefined : onSetFocus}>
                <CardTitle className="text-sm font-semibold">
                    <div className="flex justify-between items-start">
                        <span className="whitespace-normal break-words mr-1">{goal.name}</span>
                        <Badge variant="outline" className="whitespace-nowrap text-xs px-1.5 py-0.5 shrink-0">
                            {goalTypeLabel(goal.type)}
                        </Badge>
                    </div>
                </CardTitle>
                <div className="mt-1 flex items-center gap-2">
                  {!isFocused && onSetFocus && (
                    <Button variant="link" size="sm" onClick={isLocked ? undefined : onSetFocus} className="h-auto p-0 text-xs" disabled={isLocked}>
                      <Pin className="mr-1 h-3 w-3" /> Set Focus
                    </Button>
                  )}
                  {goal.sessionTargetValue !== undefined && (
                    <div className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        Target: {formatGoalTarget(goal.type, goal.sessionTargetValue, goal.targetDirection)}
                    </div>
                  )}
                </div>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 space-y-1.5">
        {renderInputFields()}

        {showPromptCounters && (
          <FormItem>
            <FormLabel>Prompt Levels</FormLabel>
            <div className="grid grid-cols-3 gap-1.5 mt-0.5">
              {PROMPT_TYPES.map(pt => {
                const hotkey = Object.keys(PROMPT_HOTKEY_MAP).find(k => PROMPT_HOTKEY_MAP[k as keyof typeof PROMPT_HOTKEY_MAP] === pt);
                const count = Number(data[pt] || 0);
                return (
                  <PromptCounterButton
                    key={pt}
                    promptType={pt}
                    count={count}
                    hotkey={hotkey}
                    disabled={isArchived}
                    onIncrement={(e) => handleInteraction(e, () => onChange(pt, { ...data, [pt]: count + 1 }))}
                    onDecrement={(e) => handleInteraction(e, () => onChange(pt, { ...data, [pt]: Math.max(0, count - 1) }))}
                  />
                );
              })}
            </div>
          </FormItem>
        )}
      </CardContent>
    </Card>
  );
}

interface PromptCounterButtonProps {
  promptType: PromptType;
  count: number;
  hotkey?: string;
  disabled?: boolean;
  onIncrement: (e: React.SyntheticEvent<HTMLButtonElement>) => void;
  onDecrement: (e: React.SyntheticEvent<HTMLButtonElement>) => void;
}

// Tap/click adds one prompt; press and hold (touch) or right-click (mouse) removes one.
const PromptCounterButton: React.FC<PromptCounterButtonProps> = ({ promptType, count, hotkey, disabled, onIncrement, onDecrement }) => {
  const longPressHandlers = useLongPress<HTMLButtonElement>(onDecrement);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="px-2 py-1.5 h-auto text-xs justify-center w-full touch-manipulation"
      style={{
        borderColor: PROMPT_COLORS[promptType],
        color: PROMPT_COLORS[promptType],
        ...longPressStyle,
      }}
      onClick={onIncrement}
      {...longPressHandlers}
      title={`Tap or click to add a ${promptType} prompt. Press and hold, or right-click, to remove one.${hotkey ? ` Hotkey: ${hotkey}` : ''}`}
      disabled={disabled}
    >
      {PROMPT_ABBREVIATIONS[promptType]}: {count}
    </Button>
  );
};

const FormItem: React.FC<{children: React.ReactNode, className?: string}> = ({ children, className }) => (
  <div className={`space-y-0.5 ${className}`}>{children}</div>
);
const FormLabel: React.FC<{children: React.ReactNode, htmlFor?: string}> = ({ children, htmlFor }) => (
  <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{children}</Label>
);

    