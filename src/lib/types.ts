
import type { Timestamp } from 'firebase/firestore';
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"


export interface Student {
  id: string;
  name: string;
  goals: Goal[];
  createdAt: string; // ISO string
  userId: string;
}

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  smartGoal: string;
  sessionTargetValue?: number; // Target value for a single session
  // Additional fields based on goal type might be present
  [key: string]: any;
}

export type GoalType =
  | 'ARTICULATION'
  | 'FLUENCY_SYLLABLE_STUTTER'
  | 'QUALITATIVE_OBSERVATION'
  | 'LANGUAGE_COMPREHENSION'
  | 'LANGUAGE_EXPRESSION'
  | 'PHONOLOGICAL_PROCESSES';

export interface GoalTemplate {
  id: string;
  name: string;
  type: GoalType;
  smartGoalPrompt: string;
  generatedSmartGoal: string;
  sessionTargetValue?: number; // Target value for a single session
  createdAt: Timestamp | Date; // Allow Date for local mode, Timestamp for Firebase
  isDefault: boolean;
  userId?: string;
}

export interface SessionData {
  sessionId: string; // UUID
  studentId: string;
  studentName: string;
  date: string; // ISO string or formatted date string
  time: string; // Formatted time string
  activity: string;
  notes: string;
  goals: SessionGoalData[];
  originalGoalHeaders: Goal[]; // Snapshot of student's goals at time of session
  userId?: string; // Added userId to SessionData
}

export interface SessionGoalData {
  goalId: string;
  goalName: string; // For convenience
  goalType: GoalType; // For convenience
  // Data object can contain specific fields for the goal type
  // AND/OR prompt counts like Verbal: 1, Gestural: 2, etc.
  data: Record<string, any>;
}

// Example structures for what might be IN data, but prompt counts are dynamic
export interface ArticulationData {
  targetSound: string;
  // position: 'initial' | 'medial' | 'final' | 'all'; // Not currently used, but example
  correct: number;
  incorrect: number;
  // promptLevel is no longer here, counts like Verbal: 1 are in data directly
}

export interface FluencySyllableStutterData {
  totalSyllables: number;
  stutteredSyllables: number;
  observationNotes: string;
}

export interface QualitativeObservationData {
  notes: string; // Renamed from observationText for consistency
  rating?: 1 | 2 | 3 | 4 | 5;
}

export interface LanguageComprehensionData {
  details: string;
  questionsAttempted: number;
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


export type PromptType = "Verbal" | "Gestural" | "PartialPhysical" | "FullPhysical" | "Independent";

export interface User {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  isAnonymous: boolean;
}

// For react-hook-form schemas
import { z } from 'zod';

export const StudentSchema = z.object({
  name: z.string().min(2, { message: "Student name must be at least 2 characters." }),
});

export const GoalTemplateSchema = z.object({
  name: z.string().min(3, "Template name is required."),
  type: z.string(), // Should validate against GoalType values
  smartGoalPrompt: z.string().min(10, "SMART goal prompt is required."),
  generatedSmartGoal: z.string().optional(),
  sessionTargetValue: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().positive("Target must be a positive number if provided.").optional()
  ),
  // isDefault is handled internally, not part of the form for user creation/edit
});

// For useToast hook
type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}
export type Toast = Omit<ToasterToast, "id">;
