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
import { STORY_ELEMENTS_FIELDS, STORY_ELEMENTS_TEMPLATES } from './story-elements';
import { BEHAVIOR_FIELDS, BEHAVIOR_GOAL_TYPES, BEHAVIOR_TEMPLATES } from './behavior';
import { TASK_ANALYSIS_FIELDS, TASK_ANALYSIS_TEMPLATES } from './task-analysis';
// The SLP goal bank, generated from the goal bank CSV by scripts/import-goal-bank.py.
import goalBank from './goal-bank.json';
// Goal bank templates whose type changed since an earlier import (written by the importer).
import goalBankTypeUpdates from './goal-bank-type-updates.json';
// Goal bank wording changed since an earlier import (written by the importer): earlier goal texts by hash, and
// earlier names.
import goalBankTextUpdates from './goal-bank-text-updates.json';
import goalBankRenames from './goal-bank-renames.json';
import { builtInGoalStatement } from './built-in-statements';

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
  ...STORY_ELEMENTS_TEMPLATES,
  ...BEHAVIOR_TEMPLATES,
  ...TASK_ANALYSIS_TEMPLATES,
  ...(goalBank as Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[]),
]
  .filter(template => !RETIRED_NAMES.has(template.name))
  // Built-in templates written as a short sentence get a goal statement in the goal bank's form.
  .map(template => template.generatedSmartGoal ? template : { ...template, generatedSmartGoal: builtInGoalStatement(template) });

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

/** A short hash of a text (32-bit FNV-1a over its code points), the same as fnv1a in scripts/import-goal-bank.py. */
export function textHash(text: string): string {
  let hash = 0x811c9dc5;
  for (const ch of text) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const BANK_TEXT_UPDATES = goalBankTextUpdates as Record<string, string[]>;
// Other built-in templates whose wording changed: the hashes of their earlier description and goal statement.
const BUILT_IN_TEXT_UPDATES: Record<string, string[]> = {
  'Produce /pl/ blend in initial word position': ['cf5aa184'],
  'Produce /bl/ blend in initial word position': ['50bab1c6'],
  'Produce /gɹ/ ("gr") blend in initial word position': ['706a49a8'],
  'Complete the handwashing routine (task analysis)': ['6cca3bf2'],
  'Complete the arrival routine (task analysis)': ['8f7c27c6'],
  'Use a communication device to make a request (task analysis)': ['9a1f487b'],
};

/**
 * Brings stored copies of built-in templates up to the current goal statement, where the stored one is still
 * the earlier built-in wording: a goal bank template whose text was tidied (see tidy_text in the importer), or an
 * original built-in template that had no goal statement. Text the user has edited is left alone, as are goals
 * already assigned to students.
 */
export function applyDefaultTemplateTextUpdates<T extends GoalTemplate>(templates: T[]): { templates: T[]; changed: boolean } {
  let changed = false;
  const updated = templates.map(template => {
    if (!template.isDefault) return template;
    const current = template.bankId
      ? DEFAULT_GOAL_TEMPLATES.find(t => t.bankId === template.bankId)
      : DEFAULT_GOAL_TEMPLATES.find(t => t.name === defaultTemplateKey(template));
    if (!current) return template;
    const earlier = template.bankId ? BANK_TEXT_UPDATES[template.bankId] : BUILT_IN_TEXT_UPDATES[current.name];
    // A field is updated when it is still an earlier built-in wording (or, for a goal statement, empty).
    const outdated = (field: 'generatedSmartGoal' | 'smartGoalPrompt') => {
      const value = template[field] ?? '';
      if (value === current[field]) return false;
      return earlier?.includes(textHash(value)) || (field === 'generatedSmartGoal' && value === '' && !template.bankId);
    };
    const statement = outdated('generatedSmartGoal');
    const description = outdated('smartGoalPrompt');
    if (!statement && !description) return template;
    changed = true;
    return {
      ...template,
      ...(statement ? { generatedSmartGoal: current.generatedSmartGoal } : {}),
      ...(description ? { smartGoalPrompt: current.smartGoalPrompt } : {}),
    };
  });
  return { templates: updated, changed };
}

/**
 * Goals assigned from a built-in template that had no goal statement were given a placeholder ("SMART goal for
 * <name>"). They get the template's goal statement now; any other goal text is the user's and is left alone.
 */
export function applyAssignedGoalStatements<T extends Student>(students: T[], templates: GoalTemplate[]): { students: T[]; changed: boolean } {
  let changed = false;
  const updated = students.map(student => {
    let studentChanged = false;
    const goals = (student.goals || []).map(goal => {
      if (!goal.smartGoal?.startsWith('SMART goal for ')) return goal;
      const placeholderName = goal.smartGoal.slice('SMART goal for '.length);
      const template = templates.find(t => t.id === goal.templateId)
        ?? templates.find(t => t.isDefault && (defaultTemplateKey(t) === placeholderName || t.name === placeholderName));
      if (!template?.generatedSmartGoal) return goal;
      studentChanged = true;
      return { ...goal, smartGoal: template.generatedSmartGoal };
    });
    if (!studentChanged) return student;
    changed = true;
    return { ...student, goals };
  });
  return { students: changed ? updated : students, changed };
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

interface TemplateRename { to: string; isOriginalText: (text: string) => boolean }

// Story element templates once had another program's name in front ("<Name>: Retell…") and in their text
// ("a <Name> model story"). Stored copies are recognized by the rest of the name and renamed.
const STORY_NAME_PREFIX = 'Story elements: ';
const withoutProgramName = (text: string) => text.replace(/\ba [A-Z][a-z]+ [A-Z][a-z]+ model story\b/g, 'a model story');

/** The new name for a built-in template (or a goal copied from one) whose name changed, or null. */
// Goal bank names tidied by the importer ("HIS/HER" → "their", "[X]" → "___"); their description is unchanged.
const BANK_RENAMES = new Map((goalBankRenames as { from: string; to: string }[]).map(r => [r.from, r.to]));

// Built-in names put in sentence case like the rest ("Reduce Fronting of /k, g/" → "Reduce fronting of /k/ and /g/").
const BUILT_IN_RENAMES = new Map<string, string>([
  ['Use "Easy Onsets" to initiate speech', 'Use easy onsets to begin speech'],
  ['Use "Light Articulatory Contacts" during reading', 'Use light articulatory contacts during reading'],
  ['Eliminate Final Consonant Deletion in CVC words', 'Eliminate final consonant deletion in CVC words'],
  ['Reduce Fronting of /k, g/', 'Reduce fronting of /k/ and /g/'],
  ['Reduce Stopping of Fricatives (/s/, /f/)', 'Reduce stopping of fricatives (/s/, /f/)'],
  ['Eliminate Cluster Reduction for s-blends', 'Eliminate cluster reduction in s-blends'],
  ['Eliminate Cluster Reduction for l-blends', 'Eliminate cluster reduction in l-blends'],
  ['Reduce Gliding of /l/ to /w/', 'Reduce gliding of /l/ to /w/'],
  ['Reduce Gliding of /r/ to /w/', 'Reduce gliding of /r/ to /w/'],
  ['Reduce Deaffrication of "ch" to "sh"', 'Reduce deaffrication of /tʃ/ ("ch") to /ʃ/ ("sh")'],
  ['Reduce Weak Syllable Deletion in 3-syllable words', 'Reduce weak syllable deletion in 3-syllable words'],
  ['Reduce Prevocalic Voicing', 'Reduce prevocalic voicing'],
  ['Discrete Trial Training - Tacting', 'Tact objects (discrete trial training)'],
  ['Discrete Trials - 5 Trials', 'Respond to a targeted skill (5 discrete trials)'],
]);

function templateRename(name: string, type: string | undefined): TemplateRename | null {
  const bank = BANK_RENAMES.get(name) ?? BUILT_IN_RENAMES.get(name);
  if (bank) return { to: bank, isOriginalText: () => false };
  const articulation = ARTICULATION_TEMPLATE_RENAMES.find(r => r.from === name);
  if (articulation) return { to: articulation.to, isOriginalText: text => text === articulation.fromPrompt };
  if (type !== 'STORY_ELEMENTS' || name.startsWith(STORY_NAME_PREFIX)) return null;
  const rest = /^[^:]+: (.+)$/.exec(name)?.[1];
  const current = rest && STORY_ELEMENTS_TEMPLATES.find(t => t.name === STORY_NAME_PREFIX + rest);
  if (!current) return null;
  return { to: current.name, isOriginalText: text => text !== current.smartGoalPrompt && withoutProgramName(text) === current.smartGoalPrompt };
}

/**
 * Renames stored copies of built-in templates whose names changed (see templateRename).
 * Runs before missing default templates are added, so a renamed template is not added a second time.
 * Description text is only replaced where it is still the original built-in wording.
 */
export function applyDefaultTemplateRenames<T extends GoalTemplate>(templates: T[]): { templates: T[]; changed: boolean } {
  let changed = false;
  const defaultNames = new Set(templates.filter(t => t.isDefault).map(defaultTemplateKey));
  const renamed = templates.flatMap(template => {
    const key = defaultTemplateKey(template);
    const rename = template.isDefault ? templateRename(key, template.type) : null;
    if (!rename) return [template];
    changed = true;
    // Already there under the new name (e.g. restored from a backup): drop the old copy.
    if (defaultNames.has(rename.to)) return [];
    const current = DEFAULT_GOAL_TEMPLATES.find(t => t.name === rename.to);
    // A template the user renamed keeps their name; only the built-in key moves to the new name.
    return [{
      ...template,
      name: template.name === key ? rename.to : template.name,
      defaultKey: rename.to,
      smartGoalPrompt: rename.isOriginalText(template.smartGoalPrompt) && current ? current.smartGoalPrompt : template.smartGoalPrompt,
    }];
  });
  return { templates: renamed, changed };
}

/** Renames goals assigned to students from a renamed built-in template (their sessions keep the goal id). */
export function applyAssignedGoalRenames<T extends Student>(students: T[]): { students: T[]; changed: boolean } {
  let changed = false;
  const renameGoal = (goal: Goal): Goal => {
    const rename = templateRename(goal.name, goal.type);
    if (!rename) return goal;
    changed = true;
    const current = DEFAULT_GOAL_TEMPLATES.find(t => t.name === rename.to);
    return {
      ...goal,
      name: rename.to,
      smartGoal: rename.isOriginalText(goal.smartGoal) && current ? current.smartGoalPrompt : goal.smartGoal,
    };
  };
  const updated = students.map(student => ({ ...student, goals: (student.goals || []).map(renameGoal) }));
  return { students: changed ? updated : students, changed };
}

// Goal types that record prompting in their own fields, so the general prompt level counters are hidden.
// Task analysis scores a prompt level per step instead of tallying prompts.
export const GOAL_TYPES_WITHOUT_PROMPT_COUNTERS: GoalType[] = ['COMMUNICATION_FUNCTIONS', 'STORY_ELEMENTS', 'TASK_ANALYSIS', ...BEHAVIOR_GOAL_TYPES];
