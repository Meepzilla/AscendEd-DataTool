
import type { GoalTemplate, GoalType, PromptType } from './types';

export const APP_NAME = "AscendEd";
export const APP_SUBTITLE = "Student Goal Data Capture";

export const PROMPT_TYPES: PromptType[] = ["Independent", "Verbal", "Gestural", "PartialPhysical", "FullPhysical"];

export const PROMPT_HOTKEY_MAP: Record<string, PromptType> = {
  'V': 'Verbal',
  'G': 'Gestural',
  'P': 'PartialPhysical',
  'F': 'FullPhysical',
  'I': 'Independent',
};

export const GOAL_TYPES: Record<string, GoalType> = {
  ARTICULATION: 'ARTICULATION',
  FLUENCY_SYLLABLE_STUTTER: 'FLUENCY_SYLLABLE_STUTTER',
  QUALITATIVE_OBSERVATION: 'QUALITATIVE_OBSERVATION',
  LANGUAGE_COMPREHENSION: 'LANGUAGE_COMPREHENSION',
  LANGUAGE_EXPRESSION: 'LANGUAGE_EXPRESSION',
  PHONOLOGICAL_PROCESSES: 'PHONOLOGICAL_PROCESSES',
};

// Defines the default data structure for each goal type during session entry
// Prompt counts (e.g., Verbal: 0) will be added dynamically if not present.
export const GOAL_TYPE_FIELDS: Record<GoalType, Record<string, any>> = {
  [GOAL_TYPES.ARTICULATION]: {
    correct: 0,
    incorrect: 0,
    targetSound: '',
    wordList: ''
    // Prompt counts are added dynamically
  },
  [GOAL_TYPES.FLUENCY_SYLLABLE_STUTTER]: {
    totalSyllables: 0,
    stutteredSyllables: 0,
    observationNotes: '',
  },
  [GOAL_TYPES.QUALITATIVE_OBSERVATION]: {
    notes: '', // Renamed from observationText
    rating: 3,
  },
  [GOAL_TYPES.LANGUAGE_COMPREHENSION]: {
    questionsAttempted: 0,
    questionsCorrect: 0,
    questionsIncorrect: 0,
    details: '',
    // Prompt counts are added dynamically
  },
  [GOAL_TYPES.LANGUAGE_EXPRESSION]: {
    opportunities: 0,
    successfulResponses: 0,
    unsuccessfulResponses: 0,
    details: '',
    // Prompt counts are added dynamically
  },
  [GOAL_TYPES.PHONOLOGICAL_PROCESSES]: {
    targetProcess: '',
    opportunities: 0,
    correctProductions: 0,
    incorrectProductions: 0,
    // Prompt counts are added dynamically
  },
};

export const PROMPT_COLORS: Record<PromptType, string> = {
  Verbal: '#3B82F6', // blue-500
  Gestural: '#10B981', // emerald-500
  PartialPhysical: '#F59E0B', // amber-500
  FullPhysical: '#EF4444', // red-500
  Independent: '#8B5CF6', // violet-500
};

export const PROMPT_ABBREVIATIONS: Record<PromptType, string> = {
  Verbal: 'V',
  Gestural: 'G',
  PartialPhysical: 'PP',
  FullPhysical: 'FP',
  Independent: 'Ind',
};

export const DEFAULT_GOAL_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  {
    name: 'Produce /s/ in Isolation',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to produce the /s/ sound in isolation.',
    generatedSmartGoal: '',
    isDefault: true,
  },
  {
    name: 'Identify Objects by Function',
    type: GOAL_TYPES.LANGUAGE_COMPREHENSION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to identify common objects by their function when named by the clinician.',
    generatedSmartGoal: '',
    isDefault: true,
  },
  {
    name: 'Reduce Syllable Repetitions',
    type: GOAL_TYPES.FLUENCY_SYLLABLE_STUTTER as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to reduce instances of syllable repetitions during conversational speech.',
    generatedSmartGoal: '',
    isDefault: true,
  },
];

export const MAX_STUDENTS_DATA_ENTRY = 4;
