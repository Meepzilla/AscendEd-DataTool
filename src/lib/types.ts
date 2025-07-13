
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
  id:string;
  name: string;
  type: GoalType;
  smartGoal: string;
  sessionTargetValue?: number; // Target percentage (0-100) or specific count for some qualitative goals
  isArchived?: boolean; // New field for archiving
  // Additional fields based on goal type might be present
  [key: string]: any;
}

export type GoalType =
  | 'ARTICULATION'
  | 'FLUENCY_SYLLABLE_STUTTER'
  | 'QUALITATIVE_OBSERVATION'
  | 'LANGUAGE_COMPREHENSION'
  | 'LANGUAGE_EXPRESSION'
  | 'PHONOLOGICAL_PROCESSES'
  | 'FEEDING_SWALLOWING'
  | 'SEQUENCED_TRIALS'
  | 'PROMPTING';

export interface GoalTemplate {
  id: string;
  name: string;
  type: GoalType;
  smartGoalPrompt: string;
  generatedSmartGoal: string;
  sessionTargetValue?: number; // Target percentage (0-100) or specific count
  createdAt: Timestamp | Date; 
  isDefault: boolean;
  userId?: string;
}

export interface SessionData {
  sessionId: string; 
  studentId: string;
  studentName: string;
  date: string; 
  time: string; 
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


export type PromptType = "Independent" | "Visual" | "Verbal" | "Gestural" | "PartialPhysical" | "FullPhysical";

export interface User {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  isAnonymous: boolean;
  createdAt?: Timestamp | Date | string; // Added from Firestore user doc
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
});

export const SignInSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export const SignUpSchema = z.object({
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters." }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});


export const GoalTemplateSchema = z.object({
  name: z.string().min(3, "Template name is required."),
  type: z.string(), 
  smartGoalPrompt: z.string().min(10, "SMART goal prompt is required."),
  generatedSmartGoal: z.string().optional(),
  sessionTargetValue: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0, "Target must be 0 or greater.").max(100, "Target percentage cannot exceed 100.").optional()
  ).describe("Target percentage (0-100), or a specific rating for qualitative goals."),
});

export const AssignedGoalEditSchema = z.object({
  name: z.string().min(3, { message: "Goal name must be at least 3 characters." }),
  smartGoal: z.string().min(10, { message: "SMART goal text must be at least 10 characters." }),
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
