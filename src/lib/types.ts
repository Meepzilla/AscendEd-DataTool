
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
   *  functions"). Unset or 0 means the functions target alone decides, as before. */
  sessionTargetUses?: number;
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


import { z } from 'zod';

export const StudentSchema = z.object({
  name: z.string().min(2, { message: "Student name must be at least 2 characters." }),
  isArchived: z.boolean().optional(),
  updatedAt: z.string().optional(),
});

const emptyToUndefinedNumber = (val: unknown) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string' && val.trim() === '') return undefined;
  return Number(val);
};

export const CustomGoalTypeSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  name: z.string().trim().min(2, 'Type name must be at least 2 characters.').max(60, 'Type name is too long.'),
  description: z.string().max(240).optional(),
  color: z.string().min(3),
  kind: z.enum(CUSTOM_MEASURE_KINDS),
  accuracy: z.object({
    correctLabel: z.string().trim().min(1, 'Label is required.').max(30),
    incorrectLabel: z.string().trim().min(1, 'Label is required.').max(30),
    approximate: z.boolean(),
  }).optional(),
  counter: z.object({
    label: z.string().trim().min(1, 'Label is required.').max(40),
    perMinute: z.boolean(),
  }).optional(),
  timer: z.object({
    label: z.string().trim().min(1, 'Label is required.').max(40),
  }).optional(),
  rating: z.object({
    min: z.number().int().min(0).max(9),
    max: z.number().int().min(1).max(10),
    levelLabels: z.array(z.string().max(30)).max(11),
  }).optional(),
  checklist: z.object({
    steps: z.array(z.string().trim().min(1, 'Step text is required.').max(120)).min(1, 'Add at least 1 step.').max(40, 'At most 40 steps.'),
  }).optional(),
  yesno: z.object({
    question: z.string().trim().min(1, 'Question is required.').max(120),
  }).optional(),
  prompting: z.object({
    label: z.string().trim().min(1, 'Label is required.').max(40),
  }).optional(),
  trials: z.object({
    count: z.number().int('Use a whole number.').min(1, 'At least 1 trial.').max(100, 'At most 100 trials.'),
  }).optional(),
  latency: z.object({
    label: z.string().trim().min(1, 'Label is required.').max(40),
  }).optional(),
  utterances: z.object({
    unit: z.enum(['words', 'morphemes']),
  }).optional(),
  charts: z.object({
    style: z.enum(['line', 'bar']),
    show: z.array(z.enum(CUSTOM_CHART_IDS)).max(CUSTOM_CHART_IDS.length),
  }).optional(),
  defaultTarget: z.preprocess(emptyToUndefinedNumber, z.number().min(0).max(1000).optional()),
  direction: z.enum(['increase', 'decrease']),
  extras: z.object({ promptLevel: z.boolean(), notes: z.boolean() }),
  isArchived: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
}).superRefine((ct, ctx) => {
  if (ct.kind === 'rating') {
    const r = ct.rating;
    if (!r || r.max <= r.min || r.max - r.min > 9) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rating'], message: 'Rating scale must have between 2 and 10 levels.' });
    } else if (ct.defaultTarget !== undefined && (ct.defaultTarget < r.min || ct.defaultTarget > r.max)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['defaultTarget'], message: `Target must be between ${r.min} and ${r.max}.` });
    }
  }
  if (ct.kind === 'checklist' && (!ct.checklist || ct.checklist.steps.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['checklist'], message: 'Add at least 1 step.' });
  }
  if ((ct.kind === 'accuracy' || ct.kind === 'checklist' || ct.kind === 'yesno') && ct.defaultTarget !== undefined && ct.defaultTarget > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['defaultTarget'], message: 'Percentage target cannot exceed 100.' });
  }
});

export const GoalTemplateSchema = z.object({
  name: z.string().min(3, "Template name is required."),
  type: z.enum(GOAL_TYPE_VALUES), 
  dataCaptureType: z.enum(GOAL_TYPE_VALUES).optional(), // NEW
  customType: CustomGoalTypeSchema.optional(),
  targetDirection: z.enum(['increase', 'decrease']).optional(),
  smartGoalPrompt: z.string().min(10, "SMART goal prompt is required."),
  generatedSmartGoal: z.string().optional(),
  gasLevelDescriptions: z.array(z.string()).max(5, 'At most 5 level descriptions.').optional(),
  sessionTargetValue: z.preprocess(
    emptyToUndefinedNumber,
    z.number().min(-2, "Target must be -2 or greater.").max(1000, "Target cannot exceed 1000.").optional()
  ).describe("Target percentage (0-100), or a specific rating for qualitative goals."),
  sessionTargetUses: z.preprocess(
    emptyToUndefinedNumber,
    z.number().min(0, "Minimum uses must be 0 or greater.").max(1000, "Minimum uses cannot exceed 1000.").optional()
  ).describe("Communication Functions only: the minimum total spontaneous uses per session, alongside the functions target."),
  isArchived: z.boolean().optional(),
}).superRefine((template, ctx) => {
  const effectiveType = template.dataCaptureType || template.type;
  if (effectiveType === 'GOAL_ATTAINMENT_SCALE') {
    if (template.sessionTargetValue !== undefined && (template.sessionTargetValue < -2 || template.sessionTargetValue > 2)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sessionTargetValue'], message: 'A GAS target is a level from -2 to +2 (0 is the expected outcome).' });
    }
  } else if (template.sessionTargetValue !== undefined && template.sessionTargetValue < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sessionTargetValue'], message: 'Target must be 0 or greater.' });
  }
});

export const AssignedGoalEditSchema = z.object({
  name: z.string().min(3, { message: "Goal name must be at least 3 characters." }),
  smartGoal: z.string().min(10, { message: "SMART goal text must be at least 10 characters." }),
  dataCaptureType: z.enum(GOAL_TYPE_VALUES).optional(), // NEW
  customType: CustomGoalTypeSchema.optional(),
  targetDirection: z.enum(['increase', 'decrease']).optional(),
  sessionTargetValue: z.preprocess(
    emptyToUndefinedNumber,
    z.number().min(-2, "Target must be -2 or greater.").max(1000, "Target cannot exceed 1000 for most goals.").optional()
  ).describe("Target percentage (0-100), or a specific rating for qualitative goals."),
  sessionTargetUses: z.preprocess(
    emptyToUndefinedNumber,
    z.number().min(0, "Minimum uses must be 0 or greater.").max(1000, "Minimum uses cannot exceed 1000.").optional()
  ).describe("Communication Functions only: the minimum total spontaneous uses per session, alongside the functions target."),
  targetDate: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.').optional()
  ),
  baseline: z.preprocess(
    emptyToUndefinedNumber,
    z.number().min(-2, 'Baseline must be -2 or greater.').optional()
  ),
  /** Goal Attainment Scaling: the five level descriptions, one per level from -2 to +2 (index 0 is level -2). */
  gasLevelDescriptions: z.array(z.string()).max(5, 'At most 5 level descriptions.').optional(),
  baselineDate: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.').optional()
  ),
  taskSteps: z.preprocess(
    (val) => (typeof val === 'string' ? val.split('\n').map(s => s.trim()).filter(Boolean) : val),
    z.array(z.string()).max(40, 'At most 40 steps.').optional()
  ),
  listItems: z.preprocess(
    (val) => (typeof val === 'string' ? val.split('\n').map(s => s.trim()).filter(Boolean) : val),
    z.array(z.string().max(100, 'Keep each item under 100 characters.')).max(100, 'At most 100 items.').optional()
  ),
  sampleUnit: z.enum(['words', 'morphemes']).optional(),
  masterySessions: z.preprocess(
    emptyToUndefinedNumber,
    z.number().int('Use a whole number.').min(1, 'At least 1 session.').max(20, 'At most 20 sessions.').optional()
  ),
  blankFills: z.array(z.string()).optional(),
  isArchived: z.boolean().optional(),
}).superRefine((goal, ctx) => {
  // Type-specific ranges (when the type is known, as in Edit Goal): a GAS target and baseline are levels from -2 to
  // +2, and only GAS goals start below 0 (other baselines are percentages, counts or ratings).
  if (!goal.dataCaptureType) {
    if (goal.sessionTargetValue !== undefined && goal.sessionTargetValue < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sessionTargetValue'], message: 'Target must be 0 or greater.' });
    }
    if (!goal.customType && goal.sessionTargetValue !== undefined && goal.sessionTargetValue > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sessionTargetValue'], message: 'Target percentage cannot exceed 100 for most goals.' });
    }
    return;
  }
  if (goal.dataCaptureType === 'GOAL_ATTAINMENT_SCALE') {
    if (goal.sessionTargetValue !== undefined && (goal.sessionTargetValue < -2 || goal.sessionTargetValue > 2)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sessionTargetValue'], message: 'A GAS target is a level from -2 to +2 (0 is the expected outcome).' });
    }
    if (goal.baseline !== undefined && goal.baseline > 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baseline'], message: 'A GAS baseline is a level from -2 to +2.' });
    }
  } else {
    if (goal.sessionTargetValue !== undefined && goal.sessionTargetValue < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sessionTargetValue'], message: 'Target must be 0 or greater.' });
    }
    if (goal.baseline !== undefined && goal.baseline < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baseline'], message: 'Baseline must be 0 or greater.' });
    }
  }
});


type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}
export type Toast = Omit<ToasterToast, "id">;
