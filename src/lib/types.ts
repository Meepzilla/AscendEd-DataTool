
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
  data: Record<string, any>; // Goal-specific data based on GOAL_TYPE_FIELDS
}

// Example structure for GOAL_TYPE_FIELDS (defined in constants.ts)
export interface ArticulationData {
  targetSound: string;
  position: 'initial' | 'medial' | 'final' | 'all';
  correct: number;
  incorrect: number;
  promptLevel?: PromptType;
}

export interface FluencySyllableStutterData {
  totalSyllables: number;
  stutteredSyllables: number;
  stutterTypes: string[]; // e.g., "repetition", "block"
}

export interface QualitativeObservationData {
  observationText: string;
  rating?: 1 | 2 | 3 | 4 | 5;
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
