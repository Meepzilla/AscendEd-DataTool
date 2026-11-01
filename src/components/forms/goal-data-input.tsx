
'use client';

import React from 'react';
import { fillNameBlanks } from '@/lib/goal-blanks';
import type { Goal, SessionGoalData, GoalType, TrialStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatGoalTarget, goalStatement, goalTypeLabel } from '@/lib/helpers';
import TaskAnalysisInput from './TaskAnalysisInput';
import { taskSteps } from '@/lib/task-analysis';
import { TrendingUp, ArrowUp, ArrowDown, ArchiveIcon, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useConfetti } from '@/hooks/use-confetti';
import { FrequencyInput, DurationInput, AbcInput, IntervalInput, LatencyInput } from './behavior-inputs';
import { GOAL_TYPES_WITHOUT_PROMPT_COUNTERS } from '@/lib/goal-constants';
import { applyFieldChange, clearTrials, cycleTrial, goalAccuracyText, scoreNextTrial, undoLastTrial } from '@/lib/goal-input-logic';
import GoalTextPopover from './GoalTextPopover';
import type { GoalInputContext } from './goal-inputs/shared';
import PromptLevelCounters from './goal-inputs/prompt-counters';
import { ComprehensionInputs, CorrectIncorrectInputs, ExpressionInputs, FeedingInputs, PhonologicalInputs } from './goal-inputs/counts';
import { TrialInputs } from './goal-inputs/trials';
import { FluencyInputs } from './goal-inputs/fluency';
import { ObservationInputs, PromptingInputs } from './goal-inputs/observation';
import { CommunicationFunctionsInputs, StoryElementsInputs } from './goal-inputs/communication';

// A goal's card in Data Entry: its name, target and move arrows, the inputs for its type (in goal-inputs/, or the
// behavior and task analysis inputs), and the prompt level counters. The calculations are in lib/goal-input-logic.

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
  /** Fills in "STUDENT" / "the student" in the goal text. */
  studentName?: string;
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
  studentName,
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

  const captureType = goal.dataCaptureType || goal.type;

  const handleChange = (field: string, value: any) => {
    // An object is the goal's whole data (several fields at once); otherwise one field and those that follow it.
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      onChange(field, value);
    } else {
      onChange(field, applyFieldChange(captureType, data, field, value));
    }
  };

  const calculateAccuracy = () => goalAccuracyText(captureType, data);

  const handleTrialClick = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => handleChange('trials', cycleTrial(data, index)));
  };
  const handleFillNextTrial = (status: TrialStatus, e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => {
      const trials = scoreNextTrial(data, status);
      if (trials) handleChange('trials', trials);
      else toast({ title: "All Trials Filled", description: "All available trials have been recorded.", variant: "default" });
    });
  };
  const handleClearTrials = (e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => handleChange('trials', clearTrials(data)));
  };
  const handleUndoLastTrial = (e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => {
      const trials = undoLastTrial(data);
      if (trials) handleChange('trials', trials);
      else toast({ title: "Nothing to Undo", description: "No trials have been marked yet.", variant: "default" });
    });
  };

  const ctx: GoalInputContext = {
    goal, data, captureType, isArchived, isLocked, isFocused, handleChange, handleInteraction, calculateAccuracy,
    handleTrialClick, handleFillNextTrial, handleClearTrials, handleUndoLastTrial,
  };

  const renderInputFields = () => {
    switch (captureType) {
      case 'AAC':
      case 'ARTICULATION':
        return <CorrectIncorrectInputs ctx={ctx} />;
      case 'SEQUENCED_TRIALS':
      case 'DISCRETE_TRIALS':
        return <TrialInputs ctx={ctx} />;
      case 'FEEDING_SWALLOWING':
        return <FeedingInputs ctx={ctx} />;
      case 'FLUENCY_SYLLABLE_STUTTER':
        return <FluencyInputs ctx={ctx} />;
      case 'QUALITATIVE_OBSERVATION':
      case 'COGNITIVE':
        return <ObservationInputs ctx={ctx} />;
      case 'PROMPTING':
        return <PromptingInputs ctx={ctx} />;
      case 'LANGUAGE_COMPREHENSION':
        return <ComprehensionInputs ctx={ctx} />;
      case 'LANGUAGE_EXPRESSION':
        return <ExpressionInputs ctx={ctx} />;
      case 'PHONOLOGICAL_PROCESSES':
        return <PhonologicalInputs ctx={ctx} />;
      case 'COMMUNICATION_FUNCTIONS':
        return <CommunicationFunctionsInputs ctx={ctx} />;
      case 'STORY_ELEMENTS':
        return <StoryElementsInputs ctx={ctx} />;
      case 'TASK_ANALYSIS':
        return (
          <TaskAnalysisInput
            steps={taskSteps(goal)}
            data={data}
            update={next => handleChange('steps', next)}
            interact={handleInteraction}
            disabled={isArchived}
            isLocked={isLocked}
            goalId={goal.id}
          />
        );
      case 'BEHAVIOR_FREQUENCY':
      case 'BEHAVIOR_DURATION':
      case 'BEHAVIOR_ABC':
      case 'BEHAVIOR_INTERVAL':
      case 'BEHAVIOR_LATENCY': {
        const behaviorProps = {
          data,
          // Several fields at once: handleChange treats an object as the goal's whole data.
          update: (fields: Record<string, any>) => handleChange(Object.keys(fields)[0], { ...data, ...fields }),
          interact: handleInteraction,
          disabled: isArchived,
          isLocked,
          goalId: goal.id,
        };
        if (captureType === 'BEHAVIOR_FREQUENCY') return <FrequencyInput {...behaviorProps} />;
        if (captureType === 'BEHAVIOR_DURATION') return <DurationInput {...behaviorProps} />;
        if (captureType === 'BEHAVIOR_INTERVAL') return <IntervalInput {...behaviorProps} />;
        if (captureType === 'BEHAVIOR_LATENCY') return <LatencyInput {...behaviorProps} />;
        return <AbcInput {...behaviorProps} />;
      }
      default:
        return <p className="text-muted-foreground text-xs">No specific data fields for this goal type.</p>;
    }
  };

  const showPromptCounters = !GOAL_TYPES_WITHOUT_PROMPT_COUNTERS.includes(captureType as GoalType);


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
                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={(e) => handleInteraction(e, onMoveUp!)} disabled={!canMoveUp || isArchived} title="Move goal up">
                        <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                )}
                {onMoveDown && (
                     <Button type="button" variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={(e) => handleInteraction(e, onMoveDown!)} disabled={!canMoveDown || isArchived} title="Move goal down">
                        <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>
            <div className="flex-grow min-w-0" onClick={isLocked ? undefined : onSetFocus}>
                <CardTitle className="text-sm font-semibold">
                    <div className="flex justify-between items-start">
                        <GoalTextPopover name={fillNameBlanks(goal)} smartGoal={goalStatement(goal, studentName)} className="whitespace-normal break-words mr-1" />
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5 shrink-0 max-w-[45%] text-center leading-tight">
                            {goalTypeLabel(goal.type)}
                        </Badge>
                    </div>
                </CardTitle>
                <div className="mt-1 flex items-center gap-2">
                  {!isFocused && onSetFocus && (
                    <Button type="button" variant="link" size="sm" onClick={isLocked ? undefined : onSetFocus} className="h-auto p-0 text-xs" disabled={isLocked}>
                      <Pin className="mr-1 h-3 w-3" /> Set Focus
                    </Button>
                  )}
                  {goal.sessionTargetValue !== undefined && (
                    <div className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        Target: {formatGoalTarget(goal.dataCaptureType || goal.type, goal.sessionTargetValue, goal.targetDirection)}
                    </div>
                  )}
                </div>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 space-y-1.5">
        {renderInputFields()}

        {showPromptCounters && (
          <PromptLevelCounters captureType={captureType as GoalType} data={data} onChange={onChange} isArchived={isArchived} interact={handleInteraction} />
        )}
      </CardContent>
    </Card>
  );
}
