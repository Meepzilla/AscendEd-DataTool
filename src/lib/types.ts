
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"


export interface Student {
  id: string;
  name: string;
  goals: Goal[];
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  userId: string;
  isArchived?: boolean; // New field for archiving
}

export interface Goal {
  id:string;
  name: string;
  type: GoalType;
  dataCaptureType?: GoalType; // NEW: Specifies which data entry UI to use
  smartGoal: string;
  sessionTargetValue?: number; // Target percentage (0-100) or specific count for some qualitative goals
  targetDirection?: TargetDirection; // Defaults by goal type; see goalDirection()
  isArchived?: boolean; // New field for archiving
  // Additional fields based on goal type might be present
  [key: string]: any;
}

export const GOAL_TYPE_VALUES = [
  'ARTICULATION',
  'FLUENCY_SYLLABLE_STUTTER',
  'QUALITATIVE_OBSERVATION',
  'LANGUAGE_COMPREHENSION',
  'LANGUAGE_EXPRESSION',
  'PHONOLOGICAL_PROCESSES',
  'FEEDING_SWALLOWING',
  'SEQUENCED_TRIALS',
  'PROMPTING',
  'DISCRETE_TRIALS',
  'COGNITIVE',
  'AAC',
  'COMMUNICATION_FUNCTIONS',
  'STORY_CHAMPS',
  'BEHAVIOR_FREQUENCY',
  'BEHAVIOR_DURATION',
  'BEHAVIOR_ABC',
] as const;

export type GoalType = typeof GOAL_TYPE_VALUES[number];

/** Whether a goal aims to raise its measure (most goals) or lower it (most behavior goals). */
export type TargetDirection = 'increase' | 'decrease';

export interface GoalTemplate {
  id: string;
  name: string;
  type: GoalType;
  dataCaptureType?: GoalType; // NEW: Specifies which data entry UI to use
  smartGoalPrompt: string;
  generatedSmartGoal: string;
  sessionTargetValue?: number; // Target percentage (0-100) or specific count
  createdAt: Date; 
  isDefault: boolean;
  userId?: string;
  isArchived?: boolean;
  category?: string; // Skill area (goal bank templates)
  source?: string; // Goal bank set the template came from
  bankId?: string; // Key into public/goal-bank/details.json (purpose, activity ideas, tags)
  targetDirection?: TargetDirection;
}

export interface SessionData {
  sessionId: string; 
  studentId: string;
  studentName: string;
  date: string; 
  time: string; 
  endTime?: string; // New field for end time
  activity: string;
  notes: string;
  goals: SessionGoalData[];
  originalGoalHeaders: Goal[]; 
  userId?: string; 
}

export interface SessionGoalData {
  goalId: string;
  goalName: string; 
  goalType: GoalType; 
  data: Record<string, any>;
}


export interface ArticulationData {
  opportunities: number;
  targetSound: string;
  correct: number;
  incorrect: number;
}

export interface FluencySyllableStutterData {
  totalSyllables: number;
  stutteredSyllables: number;
  observationNotes: string;
}

export interface QualitativeObservationData {
  notes: string; 
  rating?: 1 | 2 | 3 | 4 | 5;
}

export interface LanguageComprehensionData {
  details: string;
  opportunities: number;
  questionsCorrect: number;
  questionsIncorrect: number;
}
export interface LanguageExpressionData {
  details: string;
  opportunities: number;
  successfulResponses: number;
  unsuccessfulResponses: number;
}
export interface PhonologicalProcessesData {
  targetProcess: string;
  opportunities: number;
  correctProductions: number;
  incorrectProductions: number;
}

export interface FeedingSwallowingData {
  foodOrLiquidName: string;
  textureOrConsistency: string;
  trialsAccepted: number;
  trialsRefused: number;
  notes: string;
}

export interface SequencedTrialsData {
  trialsPerAttempt: number;
  successfulAttempts: number;
  failedAttempts: number;
}

export type TrialStatus = 'untouched' | 'correct' | 'incorrect' | 'approximate';

export interface DiscreteTrialsData {
  numberOfTrials: number;
  trials: TrialStatus[];
}

export interface AacData {
  details: string;
  correct: number;
  incorrect: number;
  approximate: number;
}


export type PromptType = "Independent" | "Visual" | "Verbal" | "Gestural" | "PartialPhysical" | "Imitation";

export interface User {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  isAnonymous: boolean;
  createdAt?: Date | string;
}

// Moved from DataEntryPage for use in context
export interface StudentSessionState {
  studentId: string;
  studentName: string;
  activity: string;
  notes: string;
  goalData: Record<string, SessionGoalData['data']>;
  originalGoalHeaders: Goal[];
}


import { z } from 'zod';

export const StudentSchema = z.object({
  name: z.string().min(2, { message: "Student name must be at least 2 characters." }),
  isArchived: z.boolean().optional(),
  updatedAt: z.string().optional(),
});

export const GoalTemplateSchema = z.object({
  name: z.string().min(3, "Template name is required."),
  type: z.enum(GOAL_TYPE_VALUES), 
  dataCaptureType: z.enum(GOAL_TYPE_VALUES).optional(), // NEW
  targetDirection: z.enum(['increase', 'decrease']).optional(),
  smartGoalPrompt: z.string().min(10, "SMART goal prompt is required."),
  generatedSmartGoal: z.string().optional(),
  sessionTargetValue: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0, "Target must be 0 or greater.").max(100, "Target percentage cannot exceed 100.").optional()
  ).describe("Target percentage (0-100), or a specific rating for qualitative goals."),
  isArchived: z.boolean().optional(),
});

export const AssignedGoalEditSchema = z.object({
  name: z.string().min(3, { message: "Goal name must be at least 3 characters." }),
  smartGoal: z.string().min(10, { message: "SMART goal text must be at least 10 characters." }),
  dataCaptureType: z.enum(GOAL_TYPE_VALUES).optional(), // NEW
  targetDirection: z.enum(['increase', 'decrease']).optional(),
  sessionTargetValue: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0, "Target must be 0 or greater.").max(100, "Target percentage cannot exceed 100 for most goals.").optional()
  ).describe("Target percentage (0-100), or a specific rating for qualitative goals."),
  isArchived: z.boolean().optional(),
});


type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}
export type Toast = Omit<ToasterToast, "id">;
