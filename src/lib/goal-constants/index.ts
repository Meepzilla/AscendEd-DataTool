// This file aggregates runtime goal constants and domain helpers from individual,
// domain-specific files. Built-in seed templates, the SLP goal bank JSON (~653 KB),
// and template migration functions live in ./seed-bank.ts so they are only loaded
// when migrating/seeding stored templates.

import type { GoalTemplate, GoalType } from '../types';
import {
  AAC_FIELDS,
  ARTICULATION_FIELDS,
  COGNITIVE_FIELDS,
  FLUENCY_FIELDS,
  GAS_FIELDS,
  LANGUAGE_FIELDS,
  LANGUAGE_SAMPLE_FIELDS,
  OBSERVATION_FIELDS,
  PHONOLOGICAL_FIELDS,
  TASK_ANALYSIS_FIELDS,
  TRIALS_FIELDS,
} from './fields';
import { COMMUNICATION_FIELDS } from './communication';
import { STORY_ELEMENTS_FIELDS } from './story-elements';
import { BEHAVIOR_FIELDS, BEHAVIOR_GOAL_TYPES } from './behavior';

export * from './communication';
export * from './story-elements';
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
  ...STORY_ELEMENTS_FIELDS,
  ...BEHAVIOR_FIELDS,
  ...TASK_ANALYSIS_FIELDS,
  ...GAS_FIELDS,
  ...LANGUAGE_SAMPLE_FIELDS,
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

/** The name a built-in template was added under (its current name for templates stored before defaultKey). */
export const defaultTemplateKey = (template: Pick<GoalTemplate, 'name' | 'defaultKey'>) => template.defaultKey ?? template.name;

// Goal types that record prompting in their own fields, so the general prompt level counters are hidden.
// Task analysis scores a prompt level per step instead of tallying prompts.
export const GOAL_TYPES_WITHOUT_PROMPT_COUNTERS: GoalType[] = ['COMMUNICATION_FUNCTIONS', 'STORY_ELEMENTS', 'TASK_ANALYSIS', 'GOAL_ATTAINMENT_SCALE', ...BEHAVIOR_GOAL_TYPES, 'COMMUNICATION_COUNT', 'COMMUNICATION_DURATION', 'RESPONSE_TIME', 'LANGUAGE_SAMPLE', 'ITEM_MASTERY'];
