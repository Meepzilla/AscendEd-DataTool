// This file aggregates goal constants from individual, domain-specific files
// for better organization and maintainability. It serves as the new single
// source of truth for goal-related constants in the application.

import type { GoalTemplate, GoalType } from '../types';
import { ARTICULATION_FIELDS, ARTICULATION_TEMPLATES } from './articulation';
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

export * from './communication';
export * from './story-champs';

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
];

// Goal types that record prompting in their own fields, so the general prompt level counters are hidden.
export const GOAL_TYPES_WITHOUT_PROMPT_COUNTERS: GoalType[] = ['COMMUNICATION_FUNCTIONS', 'STORY_CHAMPS'];
