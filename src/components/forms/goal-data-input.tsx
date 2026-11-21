
'use client';

import React from 'react';
import { fillNameBlanks } from '@/lib/goal-blanks';
import type { Goal, GoalDataUpdater, SessionGoalData, GoalType, StudentIep, TrialStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatGoalTarget, goalStatement, goalTypeLabel } from '@/lib/helpers';
import TaskAnalysisInput from './TaskAnalysisInput';
import LanguageSampleInput from './LanguageSampleInput';
import ItemMasteryInput from './ItemMasteryInput';
import { listItems } from '@/lib/item-mastery';
import { sampleUnit } from '@/lib/language-sample';
import { taskSteps } from '@/lib/task-analysis';
import { TrendingUp, ArrowUp, ArrowDown, ArchiveIcon, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useConfetti } from '@/hooks/use-confetti';
import { FrequencyInput, DurationInput, AbcInput, IntervalInput, LatencyInput } from './behavior-inputs';
import { toolTypeOf } from '@/lib/goal-constants';
import { usesPromptCounters } from '@/lib/goal-measures';
import { applyFieldChange, clearTrials, cycleTrial, goalAccuracyText, scoreNextTrial, undoLastTrial } from '@/lib/goal-input-logic';
import GoalTextPopover from './GoalTextPopover';
import type { GoalInputContext } from './goal-inputs/shared';
import PromptLevelCounters from './goal-inputs/prompt-counters';
import { ComprehensionInputs, CorrectIncorrectInputs, ExpressionInputs, FeedingInputs, PhonologicalInputs } from './goal-inputs/counts';
import { TrialInputs } from './goal-inputs/trials';
import { FluencyInputs } from './goal-inputs/fluency';
import { ObservationInputs, PromptingInputs } from './goal-inputs/observation';
import { GasInputs } from './goal-inputs/gas';
import { CommunicationFunctionsInputs, StoryElementsInputs } from './goal-inputs/communication';
import { CustomGoalInputs } from './goal-inputs/custom';

// A goal's card in Data Entry: its name, target and move arrows, the inputs for its type (in goal-inputs/, or the
// behavior and task analysis inputs), and the prompt level counters. The calculations are in lib/goal-input-logic.

interface GoalDataInputComponentProps {
  goal: Goal;
  data: SessionGoalData['data'];
  onChange: (updatedFieldName: string, newData: GoalDataUpdater) => void;
  isFocused?: boolean;
  onSetFocus?: () => void;
  id: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isArchived?: boolean;
  isLocked?: boolean;
  /** Fills in "STUDENT" / "the student" and placeholders such as [student] in the goal text. */
  studentName?: string;
  /** The student's IEP dates and minutes, for placeholders such as [annual review]. */
  studentIep?: StudentIep;
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
  studentIep,
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
    // A function updates from the latest stored goal data (safe across rapid taps);
    // an object is the goal's whole data; otherwise one field and those that follow it.
    if (typeof value === 'function') {
      onChange(field, value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      onChange(field, value);
    } else {
      onChange(field, current => applyFieldChange(captureType, current, field, value));
    }
  };

  const adjustCount = (field: string, delta: number) => {
    onChange(field, current => applyFieldChange(captureType, current, field, Math.max(0, (Number(current[field]) || 0) + delta)));
  };

  const calculateAccuracy = () => goalAccuracyText(goal, data);

  const handleTrialClick = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => onChange('trials', current => applyFieldChange(captureType, current, 'trials', cycleTrial(current, index))));
  };
  const handleFillNextTrial = (status: TrialStatus, e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => {
      if (!scoreNextTrial(data, status)) {
        toast({ title: "All Trials Filled", description: "All available trials have been recorded.", variant: "default" });
        return;
      }
      onChange('trials', current => {
        const trials = scoreNextTrial(current, status);
        return trials ? applyFieldChange(captureType, current, 'trials', trials) : current;
      });
    });
  };
  const handleClearTrials = (e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => onChange('trials', current => applyFieldChange(captureType, current, 'trials', clearTrials(current))));
  };
  const handleUndoLastTrial = (e: React.MouseEvent<HTMLButtonElement>) => {
    handleInteraction(e, () => {
      if (!undoLastTrial(data)) {
        toast({ title: "Nothing to Undo", description: "No trials have been marked yet.", variant: "default" });
        return;
      }
      onChange('trials', current => {
        const trials = undoLastTrial(current);
        return trials ? applyFieldChange(captureType, current, 'trials', trials) : current;
      });
    });
  };

  const ctx: GoalInputContext = {
    goal, data, captureType, isArchived, isLocked, isFocused, handleChange, adjustCount, handleInteraction, calculateAccuracy,
    handleTrialClick, handleFillNextTrial, handleClearTrials, handleUndoLastTrial,
  };

  const renderInputFields = () => {
    if (captureType === 'CUSTOM') {
      return <CustomGoalInputs ctx={ctx} />;
    }
    switch (captureType) {
      case 'AAC':
      case 'ARTICULATION':
        return <CorrectIncorrectInputs ctx={ctx} />;
      case 'SEQUENCED_TRIALS':
      case 'DISCRETE_TRIALS':
      case 'COMMUNICATION_OPPORTUNITIES':
        return <TrialInputs ctx={ctx} />;
      case 'FEEDING_SWALLOWING':
        return <FeedingInputs ctx={ctx} />;
      case 'FLUENCY_SYLLABLE_STUTTER':
        return <FluencyInputs ctx={ctx} />;
      case 'GOAL_ATTAINMENT_SCALE':
        return <GasInputs ctx={ctx} />;
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
            update={next => onChange('steps', next)}
            interact={handleInteraction}
            disabled={isArchived}
            isLocked={isLocked}
            goalId={goal.id}
          />
        );
      case 'LANGUAGE_SAMPLE':
        return (
          <LanguageSampleInput
            unit={sampleUnit(goal)}
            data={data}
            update={next => onChange('utterances', next)}
            interact={handleInteraction}
            disabled={isArchived}
            isLocked={isLocked}
            goalId={goal.id}
          />
        );
      case 'ITEM_MASTERY':
        return (
          <ItemMasteryInput
            items={listItems(goal)}
            data={data}
            update={next => onChange('items', next)}
            interact={handleInteraction}
            disabled={isArchived}
            isLocked={isLocked}
            goalId={goal.id}
          />
        );
      case 'COMMUNICATION_COUNT':
      case 'COMMUNICATION_DURATION':
      case 'RESPONSE_TIME':
      case 'BEHAVIOR_FREQUENCY':
      case 'BEHAVIOR_DURATION':
      case 'BEHAVIOR_ABC':
      case 'BEHAVIOR_INTERVAL':
      case 'BEHAVIOR_LATENCY': {
        const tool = toolTypeOf(captureType);
        const behaviorProps = {
          data,
          update: (fields: Record<string, any> | ((current: Record<string, any>) => Record<string, any>)) => {
            if (typeof fields === 'function') {
              onChange('behavior', current => {
                const patch = fields(current);
                return patch === current ? current : { ...current, ...patch };
              });
            } else {
              onChange(Object.keys(fields)[0] ?? 'behavior', current => ({ ...current, ...fields }));
            }
          },
          interact: handleInteraction,
          disabled: isArchived,
          isLocked,
          goalId: goal.id,
          // Communication goals use the same tools, with their own words.
          communication: tool !== captureType,
        };
        if (tool === 'BEHAVIOR_FREQUENCY') return <FrequencyInput {...behaviorProps} />;
        if (tool === 'BEHAVIOR_DURATION') return <DurationInput {...behaviorProps} />;
        if (captureType === 'BEHAVIOR_INTERVAL') return <IntervalInput {...behaviorProps} />;
        if (tool === 'BEHAVIOR_LATENCY') return <LatencyInput {...behaviorProps} />;
        return <AbcInput {...behaviorProps} />;
      }
      default:
        return <p className="text-muted-foreground text-xs">No specific data fields for this goal type.</p>;
    }
  };

  const showPromptCounters = usesPromptCounters(goal);


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
                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5 min-h-11 min-w-11 p-0" onClick={(e) => handleInteraction(e, onMoveUp!)} disabled={!canMoveUp || isArchived} title="Move goal up" aria-label="Move goal up">
                        <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                )}
                {onMoveDown && (
                     <Button type="button" variant="ghost" size="icon" className="h-5 w-5 min-h-11 min-w-11 p-0" onClick={(e) => handleInteraction(e, onMoveDown!)} disabled={!canMoveDown || isArchived} title="Move goal down" aria-label="Move goal down">
                        <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>
            <div className="flex-grow min-w-0" onClick={isLocked ? undefined : onSetFocus}>
                <CardTitle className="text-sm font-semibold">
                    <div className="flex justify-between items-start">
                        <GoalTextPopover name={fillNameBlanks(goal)} smartGoal={goalStatement(goal, studentName, studentIep)} className="whitespace-normal break-words mr-1" />
                        <Badge
                          variant="outline"
                          className="text-xs px-1.5 py-0.5 shrink-0 max-w-[45%] text-center leading-tight inline-flex items-center gap-1"
                          style={captureType === 'CUSTOM' && goal.customType?.color ? { borderColor: goal.customType.color } : undefined}
                        >
                            {captureType === 'CUSTOM' && goal.customType?.color && (
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: goal.customType.color }} aria-hidden />
                            )}
                            {/* The type data is recorded as (set in Edit Goal), the same as the inputs below. */}
                            {goalTypeLabel(goal)}
                        </Badge>
                    </div>
                </CardTitle>
                <div className="mt-1 flex items-center gap-2">
                  {!isFocused && onSetFocus && (
                    <Button type="button" variant="link" size="sm" onClick={isLocked ? undefined : onSetFocus} className="h-auto min-h-11 p-0 text-xs" disabled={isLocked}>
                      <Pin className="mr-1 h-3 w-3" /> Set Focus
                    </Button>
                  )}
                  {goal.sessionTargetValue !== undefined && (
                    <div className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        Target: {formatGoalTarget(goal, goal.sessionTargetValue, goal.targetDirection, goal.sessionTargetUses)}
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
