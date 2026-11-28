
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"


export interface Student {
  id: string;
  name: string;
  goals: Goal[];
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  userId: string;
  isArchived?: boolean; // New field for archiving
  /** IEP dates and required service minutes (student profile → Overview → Edit IEP Details). */
  iep?: StudentIep;
}

export type ServicePer = 'week' | 'month' | 'year';

/** The kinds of service a session's minutes can count toward (Related Service versus AAC). */
export type ServiceType = 'related' | 'aac';

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = { related: 'Related Service', aac: 'AAC' };

export const SERVICE_TYPES: ServiceType[] = ['related', 'aac'];

/** One required-minutes line on the IEP, for a single service type. */
export interface ServiceRequirement {
  type: ServiceType;
  minutes: number;
  per: ServicePer;
}

export interface StudentIep {
  /** Date of the current IEP meeting (YYYY-MM-DD). */
  iepDate?: string;
  /** Annual IEP review due (YYYY-MM-DD). */
  annualReviewDate?: string;
  /** Re-evaluation (triennial) due (YYYY-MM-DD). */
  reevaluationDate?: string;
  /** Service minutes the IEP requires, per week, month or school year. */
  serviceMinutes?: number;
  servicePer?: ServicePer;
  /** Required minutes per service type. When present, this replaces the legacy single serviceMinutes line. */
  services?: ServiceRequirement[];
}

export interface Goal {
  id:string;
  name: string;
  type: GoalType;
  dataCaptureType?: GoalType; // NEW: Specifies which data entry UI to use
  smartGoal: string;
  sessionTargetValue?: number; // Target percentage (0-100) or specific count for some qualitative goals
  /** COMMUNICATION_FUNCTIONS only: the minimum total unprompted uses (spontaneous or emerging) per session
   *  that must accompany the functions target (a goal worded "at least 5 times for at least 2 different
   *  functions"). Unset or 0 means the functions target alone decides, as before. Ignored for a 'uses' goal. */
  sessionTargetUses?: number;
  /** COMMUNICATION_FUNCTIONS only: measured by the number of different functions (unset, the default) or by the
   *  total uses across all functions ('uses'). See CommMeasure in goal-constants/communication.ts. */
  commMeasure?: 'functions' | 'uses';
  targetDirection?: TargetDirection; // Defaults by goal type; see goalDirection()
  isArchived?: boolean; // New field for archiving
  /** The template the goal was assigned from, so it is still recognized after the student's copy is renamed. */
  templateId?: string;
  /** The date the goal's criteria should be met by (YYYY-MM-DD), shown with the target on the progress report. */
  targetDate?: string;
  /** Where the student started, in the goal's measure (e.g. 40 for 40%); the start of the aim line. */
  baseline?: number;
  /** When the baseline was taken (YYYY-MM-DD); the aim line starts here (or at the first session). */
  baselineDate?: string;
  /** Mastery: the target met in this many sessions in a row (3 when not set). */
  masterySessions?: number;
  /** Goal Attainment Scaling: the five level descriptions, one per level from -2 to +2
      (index 0 is level -2, index 4 is level +2); a blank entry falls back to the generic label. */
  gasLevelDescriptions?: string[];
  /** Task analysis goals: the steps of the skill, in order (task-analysis.ts). */
  taskSteps?: string[];
  /** Item mastery goals: the targets (words, signs, sounds) tracked one by one (item-mastery.ts). */
  listItems?: string[];
  /** Language sample goals: whether utterances are counted in words or morphemes (language-sample.ts). */
  sampleUnit?: 'words' | 'morphemes';
  /** What fills each blank ("___") in the goal text, by position; empty uses the automatic value (goal-blanks.ts). */
  blankFills?: string[];
  /** CUSTOM goals: a copy of the user's custom goal type as it was when the goal was made (goal-types/custom.ts). */
  customType?: CustomGoalType;
  // Additional fields based on goal type might be present
  [key: string]: any;
}

/** How a custom goal type is measured; each method has its own inputs and measure (goal-types/custom.ts). */
export const CUSTOM_MEASURE_KINDS = ['accuracy', 'counter', 'timer', 'rating', 'checklist', 'yesno', 'prompting', 'trials', 'latency', 'utterances'] as const;
export type CustomMeasureKind = typeof CUSTOM_MEASURE_KINDS[number];

/** The extra Reports charts a custom goal type can show under its progress chart (goal-types/custom.ts). */
export const CUSTOM_CHART_IDS = ['responses', 'prompts', 'utterance-lengths', 'utterance-sample', 'step-completion', 'rating-levels', 'yesno-sessions'] as const;
export type CustomChartId = typeof CUSTOM_CHART_IDS[number];

/**
 * A goal type made by the user (Settings → Custom goal types). Goals and templates of type CUSTOM keep a copy of
 * it, so editing the type later never changes how goals already made (and their past sessions) are read.
 */
export interface CustomGoalType {
  id: string;
  /** Bumped on every edit; a goal whose copy has an older version can be updated to the latest. */
  version: number;
  name: string;
  description?: string;
  color: string;
  kind: CustomMeasureKind;
  accuracy?: { correctLabel: string; incorrectLabel: string; approximate: boolean };
  counter?: { label: string; perMinute: boolean };
  timer?: { label: string };
  /** Prompt levels (like the Prompting type): what each tallied response is. */
  prompting?: { label: string };
  /** Trial grid (like Discrete Trials): how many trials each session starts with. */
  trials?: { count: number };
  /** Response time (like the Response Time type): what the student responds to. */
  latency?: { label: string };
  /** Utterance length (like Language Sample): whether utterances are counted in words or morphemes. */
  utterances?: { unit: 'words' | 'morphemes' };
  /** Reports: the progress chart's style and which extra charts to show. Unset: a line and every extra chart that fits. */
  charts?: { style: 'line' | 'bar'; show: CustomChartId[] };
  rating?: { min: number; max: number; levelLabels: string[] };
  checklist?: { steps: string[] };
  yesno?: { question: string };
  defaultTarget?: number;
  direction: TargetDirection;
  extras: { promptLevel: boolean; notes: boolean };
  isArchived?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const BUILT_IN_GOAL_TYPE_VALUES = [
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
  'STORY_ELEMENTS',
  'BEHAVIOR_FREQUENCY',
  'BEHAVIOR_DURATION',
  'BEHAVIOR_ABC',
  'BEHAVIOR_INTERVAL',
  'BEHAVIOR_LATENCY',
  'TASK_ANALYSIS',
  'GOAL_ATTAINMENT_SCALE',
  'COMMUNICATION_COUNT',
  'COMMUNICATION_DURATION',
  'RESPONSE_TIME',
  'COMMUNICATION_OPPORTUNITIES',
  'LANGUAGE_SAMPLE',
  'ITEM_MASTERY',
] as const;

export const GOAL_TYPE_VALUES = [
  ...BUILT_IN_GOAL_TYPE_VALUES,
  // A user-made goal type: the goal's customType says how it is entered and measured. Not offered in the
  // built-in type lists (GOAL_TYPES comes from GOAL_TYPE_FIELDS, which has no CUSTOM entry).
  'CUSTOM',
] as const;

export type BuiltInGoalType = typeof BUILT_IN_GOAL_TYPE_VALUES[number];
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
  /** COMMUNICATION_FUNCTIONS only: the minimum total unprompted uses (spontaneous or emerging) per session, alongside the functions target. */
  sessionTargetUses?: number;
  /** COMMUNICATION_FUNCTIONS only: measured by different functions (default) or total uses; copied to a student's goal. */
  commMeasure?: 'functions' | 'uses';
  createdAt: Date;
  isDefault: boolean;
  userId?: string;
  isArchived?: boolean;
  category?: string; // Skill area (goal bank templates)
  source?: string; // Goal bank set the template came from
  bankId?: string; // Key into public/goal-bank/details.json (purpose, activity ideas, tags)
  targetDirection?: TargetDirection;
  retired?: boolean; // Built-in duplicate archived once by the app (see RETIRED_DEFAULT_TEMPLATES)
  /** Where the student started, in the goal's measure; templates that set one pass it to the assigned goal (goalFromTemplate). GAS templates start at -2. */
  baseline?: number;
  /** GAS templates: the five level descriptions, index 0 = level -2; copied to the assigned goal (goalFromTemplate). */
  gasLevelDescriptions?: string[];
  taskSteps?: string[]; // Task analysis templates: the steps copied to a student's goal
  listItems?: string[]; // Item mastery templates: the items copied to a student's goal
  sampleUnit?: 'words' | 'morphemes'; // Language sample templates: the unit copied to a student's goal
  defaultKey?: string; // Built-in templates: the name they were added under, kept if the user renames them
  deleted?: boolean; // Built-in templates: deleted by the user. Kept so they aren't added back; restorable in Settings (builtin-goals.ts)
  /** CUSTOM templates: a copy of the user's custom goal type, copied to the assigned goal (goalFromTemplate). */
  customType?: CustomGoalType;
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
  /** A session that didn't take place (no goal data), with the reason (attendance.ts). */
  missed?: { reason: import('./attendance').MissedReason; note?: string };
  /** Explicit per-type minutes for the session; absent means the whole session counts as Related Service. */
  serviceMinutes?: Partial<Record<ServiceType, number>>;
  userId?: string;
}

export interface SessionGoalData {
  goalId: string;
  goalName: string; 
  goalType: GoalType; 
  data: Record<string, any>;
}

/** Either a replacement goal data object or a functional updater derived from the latest stored goal data. */
export type GoalDataUpdater =
  | SessionGoalData['data']
  | ((current: SessionGoalData['data']) => SessionGoalData['data']);


export type TrialStatus = 'untouched' | 'correct' | 'incorrect' | 'approximate';

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
  /** The session's minutes split across service types; undefined counts the whole session as Related Service. */
  serviceMinutes?: Partial<Record<ServiceType, number>>;
  goalData: Record<string, SessionGoalData['data']>;
  originalGoalHeaders: Goal[];
}


type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}
export type Toast = Omit<ToasterToast, "id">;
