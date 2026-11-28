import { z } from 'zod';
import { CUSTOM_CHART_IDS, CUSTOM_MEASURE_KINDS, GOAL_TYPE_VALUES, type CustomGoalType } from './types';
import { goalMeasureInfo } from './goal-measures';
import type { MeasuredGoal } from './goal-types';

// Zod validation schemas separated from pure TypeScript types (types.ts) so non-form modules
// importing runtime constants from types.ts do not pull Zod into their client bundle.

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
  if ((ct.kind === 'accuracy' || ct.kind === 'checklist' || ct.kind === 'yesno' || ct.kind === 'prompting' || ct.kind === 'trials') && ct.defaultTarget !== undefined && ct.defaultTarget > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['defaultTarget'], message: 'Percentage target cannot exceed 100.' });
  }
});

/**
 * A target or baseline above the top of the goal type's scale (over 100%, over 5 on a 1-5 rating) can never be met
 * or charted. The form's number box stops it in the browser, but Ctrl+Enter saves without the browser's check, so
 * the schema checks it too. GAS levels are checked separately; a custom type without its definition is skipped.
 */
function checkAgainstScale(
  ctx: z.RefinementCtx, type: string, customType: CustomGoalType | undefined,
  value: number | undefined, path: string, what: string, commMeasure?: 'functions' | 'uses',
) {
  if (value === undefined || type === 'GOAL_ATTAINMENT_SCALE' || (type === 'CUSTOM' && !customType)) return;
  // commMeasure matters: a Communication Functions goal measured by total uses has no top (functions do).
  const info = goalMeasureInfo({ type, customType, commMeasure } as MeasuredGoal);
  if (info.max !== undefined && value > info.max) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: `${what} can't be more than ${info.max}${info.unit}.` });
  }
}

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
  commMeasure: z.enum(['functions', 'uses']).optional(),
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
  checkAgainstScale(ctx, effectiveType, template.customType, template.sessionTargetValue, 'sessionTargetValue', 'Target', template.commMeasure);
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
  commMeasure: z.enum(['functions', 'uses']).optional(),
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
    checkAgainstScale(ctx, goal.dataCaptureType, goal.customType, goal.sessionTargetValue, 'sessionTargetValue', 'Target', goal.commMeasure);
    checkAgainstScale(ctx, goal.dataCaptureType, goal.customType, goal.baseline, 'baseline', 'Baseline', goal.commMeasure);
  }
});
