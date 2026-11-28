import type { CustomGoalType, Goal, GoalType, TargetDirection } from '../types';
import type { GoalMeasureInfo } from '../goal-measures';

/** The goal fields measuring and formatting need; goals are measured by the type their data was entered as. */
export type MeasuredGoal = Pick<Goal, 'type' | 'targetDirection' | 'dataCaptureType' | 'sessionTargetUses' | 'commMeasure' | 'customType' | 'sampleUnit'>;

/**
 * Everything the app needs to know about a goal type in one place: how its session data starts and is finalized on
 * save, how a session is turned into one number for charts and mastery, and how that measure is worded on cards and
 * in reports. Built-in types wrap their existing functions; user-made CUSTOM types are built from their saved
 * CustomGoalType definition (custom.ts).
 */
export interface GoalTypeDefinition {
  /** 'COGNITIVE', or 'CUSTOM:<id>' for a user-made type. */
  key: string;
  /** The type's human-readable name, e.g. "Cognitive" or "Peer interaction quality". */
  label: string;
  description?: string;
  defaultDirection: TargetDirection;
  /** Whether Data Entry shows the six prompt-level counters below the type's own inputs. */
  usesPromptCounters: boolean;
  /** Whether the goal's target is a 0–100 percentage (for goal-text blank matching and target validation). */
  isPercent(goal: MeasuredGoal): boolean;
  /** A fresh copy of the empty session data for a goal of this type. */
  initialData(goal?: MeasuredGoal): Record<string, any>;
  /** Stops running timers and stores summary totals when a session is saved. */
  finalizeData(data: Record<string, any>, now?: number): Record<string, any>;
  /** Correct, incorrect and approximate responses for trial/accuracy types; null for other types. */
  responses(data: Record<string, any>): { correct: number; incorrect: number; approximate: number } | null;
  /** The result line shown under a goal's inputs in Data Entry, when applicable. */
  accuracyText?(data: Record<string, any>): string;
  /** Label, unit and chart axis bounds for the goal's measure. */
  measureInfo(goal: MeasuredGoal): GoalMeasureInfo;
  /** One session's measure, or null when nothing was recorded for the goal in that session. */
  measure(goal: MeasuredGoal, data: Record<string, any>): number | null;
  /** Plain-English explanation of how the session measure is calculated (Reports → How it's calculated). */
  formulaText(goal: MeasuredGoal): string;
  /** What the measure is called in a narrative sentence, e.g. "accuracy", "the rating". */
  narrativeNoun(goal: MeasuredGoal): string;
  /** A measure value formatted with its unit for narrative text, e.g. "72%", "4 out of 5". */
  formatValue(goal: MeasuredGoal, value: number): string;
  /** A target value formatted for badges and reports, e.g. "80%", "4 out of 5", "≤ 3 per session". */
  formatTarget(goal: MeasuredGoal, target: number, direction?: TargetDirection, usesTarget?: number): string;
}

/** Whether a goal uses a user-made custom goal type definition. */
export function isCustomGoal(goal: { type?: GoalType | string; customType?: CustomGoalType } | null | undefined): goal is { type: 'CUSTOM'; customType: CustomGoalType } {
  return !!goal && goal.type === 'CUSTOM' && !!goal.customType && typeof goal.customType === 'object';
}
