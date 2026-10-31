// This file aggregates goal constants from individual, domain-specific files
// for better organization and maintainability. It serves as the new single
// source of truth for goal-related constants in the application.

import type { Goal, GoalTemplate, GoalType, Student } from '../types';
import { ARTICULATION_FIELDS, ARTICULATION_TEMPLATES, ARTICULATION_TEMPLATE_RENAMES } from './articulation';
import { FLUENCY_FIELDS, FLUENCY_TEMPLATES } from './fluency';
import { LANGUAGE_FIELDS, LANGUAGE_TEMPLATES } from './language';
import { OBSERVATION_FIELDS, OBSERVATION_TEMPLATES } from './observation';
import { PHONOLOGICAL_FIELDS, PHONOLOGICAL_TEMPLATES } from './phonological';
import { TRIALS_FIELDS, TRIALS_TEMPLATES } from './trials';
import { FEEDING_TEMPLATES } from './feeding';
import { AAC_FIELDS, AAC_TEMPLATES } from './aac';
import { COGNITIVE_FIELDS, COGNITIVE_TEMPLATES } from './cognitive';
import { COMMUNICATION_FIELDS, COMMUNICATION_TEMPLATES } from './communication';
import { STORY_CHAMPS_FIELDS, STORY_CHAMPS_TEMPLATES } from './story-champs';
import { BEHAVIOR_FIELDS, BEHAVIOR_GOAL_TYPES, BEHAVIOR_TEMPLATES } from './behavior';
import { TASK_ANALYSIS_FIELDS, TASK_ANALYSIS_TEMPLATES } from './task-analysis';
// The SLP goal bank, generated from the goal bank CSV by scripts/import-goal-bank.py.
import goalBank from './goal-bank.json';
// Goal bank templates whose type changed since an earlier import (written by the importer).
import goalBankTypeUpdates from './goal-bank-type-updates.json';

export * from './communication';
export * from './story-champs';
export * from './behavior';

// Combine all field definitions from individual files.
export const GOAL_TYPE_FIELDS: Record<GoalType, Record<string, any>> = {
  ...ARTICULATION_FIELDS,
  ...FLUENCY_FIELDS,
  ...LANGUAGE_FIELDS,
  ...OBSERVATION_FIELDS,
  ...PHONOLOGICAL_FIELDS,
  ...TRIALS_FIELDS,
  ...AAC_FIELDS,
  ...COGNITIVE_FIELDS,
  ...COMMUNICATION_FIELDS,
  ...STORY_CHAMPS_FIELDS,
  ...BEHAVIOR_FIELDS,
  ...TASK_ANALYSIS_FIELDS,
} as Record<GoalType, Record<string, any>>;

// Dynamically generate the GOAL_TYPES object from the keys of GOAL_TYPE_FIELDS.
// This ensures that GOAL_TYPES is always in sync with the defined fields.
export const GOAL_TYPES = Object.keys(GOAL_TYPE_FIELDS).reduce(
  (acc, key) => {
    acc[key] = key as GoalType;
    return acc;
  },
  {} as Record<string, GoalType>
);

/**
 * Built-in templates that duplicate another built-in one (the same skill measured the same way, worded
 * differently). They are no longer added, and stored copies are archived once on each device (still
 * restorable with Show Archived; goals already assigned to students are copies and are unaffected).
 */
export const RETIRED_DEFAULT_TEMPLATES: { name: string; duplicateOf: string }[] = [
  { name: 'Follow the directions (2-step)', duplicateOf: 'Follow 2-step directions' },
  { name: 'Follow the 2-step directions', duplicateOf: 'Follow 2-step directions' },
  { name: 'Follow the directions (3-step)', duplicateOf: 'Follow 3-step directions' },
  { name: 'Follow the 3-step directions', duplicateOf: 'Follow 3-step directions' },
  { name: 'Follow the 1-step direction', duplicateOf: 'Follow a 1-step direction' },
  { name: 'Use correct subject-verb agreement', duplicateOf: 'Use correct subject-verb agreement in sentences' },
  { name: 'Identify the different word and explain the differences', duplicateOf: 'Identify the different word and explain the differences (a list)' },
  { name: 'Identify the opposite', duplicateOf: 'Identify antonyms' },
  { name: 'Use the appropriate volume based on the setting', duplicateOf: 'Use an appropriate volume based on the social situation they are in' },
  { name: 'Answer “yes or no” if the phrase or sentence uses the tense accurately (present)', duplicateOf: 'Answer “yes or no” if the phrase or sentence uses the verb tense accurately (present)' },
];
const RETIRED_NAMES = new Set(RETIRED_DEFAULT_TEMPLATES.map(r => r.name));

// Combine all default templates from individual files into a single array.
export const DEFAULT_GOAL_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  ...ARTICULATION_TEMPLATES,
  ...FLUENCY_TEMPLATES,
  ...LANGUAGE_TEMPLATES,
  ...OBSERVATION_TEMPLATES,
  ...PHONOLOGICAL_TEMPLATES,
  ...TRIALS_TEMPLATES,
  ...FEEDING_TEMPLATES,
  ...AAC_TEMPLATES,
  ...COGNITIVE_TEMPLATES,
  ...COMMUNICATION_TEMPLATES,
  ...STORY_CHAMPS_TEMPLATES,
  ...BEHAVIOR_TEMPLATES,
  ...TASK_ANALYSIS_TEMPLATES,
  ...(goalBank as Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[]),
].filter(template => !RETIRED_NAMES.has(template.name));

/** The name a built-in template was added under (its current name for templates stored before defaultKey). */
export const defaultTemplateKey = (template: Pick<GoalTemplate, 'name' | 'defaultKey'>) => template.defaultKey ?? template.name;

/**
 * Built-in templates whose goal type changed. Each device keeps its own copy of the default templates
 * (only missing ones are added on load), so `applyDefaultTemplateUpdates` updates stored copies that
 * still have the old type. Templates the user has already changed to another type are left alone, as
 * are goals already assigned to students (their past sessions were recorded with the old type).
 */
export const DEFAULT_TEMPLATE_UPDATES: { name: string; fromType: GoalType }[] = [
  { name: 'GLP: Use language for a variety of communicative functions', fromType: 'QUALITATIVE_OBSERVATION' },
  { name: 'Retell a short story with 3 key elements', fromType: 'LANGUAGE_EXPRESSION' },
  ...(goalBankTypeUpdates as { name: string; fromType: GoalType }[]),
];

export function applyDefaultTemplateUpdates<T extends GoalTemplate>(templates: T[]): { templates: T[]; changed: boolean } {
  let changed = false;
  const updated = templates.map(template => {
    const update = DEFAULT_TEMPLATE_UPDATES.find(u => u.name === defaultTemplateKey(template) && u.fromType === template.type);
    if (!template.isDefault || !update) return template;
    const current = DEFAULT_GOAL_TEMPLATES.find(t => t.name === update.name);
    if (!current) return template;
    changed = true;
    return {
      ...template,
      type: current.type,
      dataCaptureType: template.dataCaptureType && template.dataCaptureType !== update.fromType ? template.dataCaptureType : current.type,
      smartGoalPrompt: current.smartGoalPrompt,
      sessionTargetValue: current.sessionTargetValue,
      targetDirection: current.targetDirection,
    };
  });
  return { templates: updated, changed };
}

/**
 * Archives stored copies of retired built-in templates, once: they are marked `retired`, so a template the
 * user restores afterwards stays restored.
 */
export function applyDefaultTemplateRetirements<T extends GoalTemplate>(templates: T[]): { templates: T[]; changed: boolean } {
  let changed = false;
  const updated = templates.map(template => {
    if (!template.isDefault || template.retired || !RETIRED_NAMES.has(defaultTemplateKey(template))) return template;
    changed = true;
    return { ...template, isArchived: true, retired: true };
  });
  return { templates: updated, changed };
}

/**
 * Renames stored copies of built-in templates whose names changed (see ARTICULATION_TEMPLATE_RENAMES).
 * Runs before missing default templates are added, so a renamed template is not added a second time.
 * Description text is only replaced where it is still the original built-in wording.
 */
export function applyDefaultTemplateRenames<T extends GoalTemplate>(templates: T[]): { templates: T[]; changed: boolean } {
  let changed = false;
  const defaultNames = new Set(templates.filter(t => t.isDefault).map(defaultTemplateKey));
  const renamed = templates.flatMap(template => {
    const rename = template.isDefault && ARTICULATION_TEMPLATE_RENAMES.find(r => r.from === defaultTemplateKey(template));
    if (!rename) return [template];
    changed = true;
    // Already there under the new name (e.g. restored from a backup): drop the old copy.
    if (defaultNames.has(rename.to)) return [];
    const current = DEFAULT_GOAL_TEMPLATES.find(t => t.name === rename.to);
    // A template the user renamed keeps their name; only the built-in key moves to the new name.
    return [{
      ...template,
      name: template.name === rename.from ? rename.to : template.name,
      defaultKey: rename.to,
      smartGoalPrompt: template.smartGoalPrompt === rename.fromPrompt && current ? current.smartGoalPrompt : template.smartGoalPrompt,
    }];
  });
  return { templates: renamed, changed };
}

/** Renames goals assigned to students from a renamed built-in template (their sessions keep the goal id). */
export function applyAssignedGoalRenames<T extends Student>(students: T[]): { students: T[]; changed: boolean } {
  let changed = false;
  const renameGoal = (goal: Goal): Goal => {
    const rename = ARTICULATION_TEMPLATE_RENAMES.find(r => r.from === goal.name);
    if (!rename) return goal;
    changed = true;
    const current = DEFAULT_GOAL_TEMPLATES.find(t => t.name === rename.to);
    return {
      ...goal,
      name: rename.to,
      smartGoal: goal.smartGoal === rename.fromPrompt && current ? current.smartGoalPrompt : goal.smartGoal,
    };
  };
  const updated = students.map(student => ({ ...student, goals: (student.goals || []).map(renameGoal) }));
  return { students: changed ? updated : students, changed };
}

// Goal types that record prompting in their own fields, so the general prompt level counters are hidden.
// Task analysis scores a prompt level per step instead of tallying prompts.
export const GOAL_TYPES_WITHOUT_PROMPT_COUNTERS: GoalType[] = ['COMMUNICATION_FUNCTIONS', 'STORY_CHAMPS', 'TASK_ANALYSIS', ...BEHAVIOR_GOAL_TYPES];
