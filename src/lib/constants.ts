
import type { GoalTemplate, GoalType, PromptType } from './types';

// -- Application Core Constants --
export const APP_NAME = "AscendEd";
export const APP_SUBTITLE = "Student Goal Data Capture";

// -- Prompting Constants --
// Defines the ordered list of prompt types used in the application.
export const PROMPT_TYPES: PromptType[] = ["Independent", "Visual", "Verbal", "Gestural", "PartialPhysical", "FullPhysical"];

// Maps keyboard hotkeys to their corresponding prompt types for data entry.
export const PROMPT_HOTKEY_MAP: Record<string, PromptType> = {
  'D': 'Visual', // New hotkey for Visual prompt
  'V': 'Verbal',
  'G': 'Gestural',
  'P': 'PartialPhysical',
  'F': 'FullPhysical',
  'I': 'Independent',
};

// Defines the various types of goals supported by the application.
// Each key and value are identical for easy lookup.
export const GOAL_TYPES: Record<string, GoalType> = {
  ARTICULATION: 'ARTICULATION',
  FLUENCY_SYLLABLE_STUTTER: 'FLUENCY_SYLLABLE_STUTTER',
  QUALITATIVE_OBSERVATION: 'QUALITATIVE_OBSERVATION',
  LANGUAGE_COMPREHENSION: 'LANGUAGE_COMPREHENSION',
  LANGUAGE_EXPRESSION: 'LANGUAGE_EXPRESSION',
  PHONOLOGICAL_PROCESSES: 'PHONOLOGICAL_PROCESSES',
  FEEDING_SWALLOWING: 'FEEDING_SWALLOWING',
  SEQUENCED_TRIALS: 'SEQUENCED_TRIALS',
  PROMPTING: 'PROMPTING',
};

// Defines the default data structure (fields and initial values) for each goal type
// when a new session entry is initiated. Prompt counts are included where relevant.
export const GOAL_TYPE_FIELDS: Record<GoalType, Record<string, any>> = {
  [GOAL_TYPES.ARTICULATION]: {
    correct: 0,
    incorrect: 0,
    targetSound: '',
    wordList: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, FullPhysical: 0,
  },
  [GOAL_TYPES.FLUENCY_SYLLABLE_STUTTER]: {
    totalSyllables: 0,
    stutteredSyllables: 0,
    observationNotes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, FullPhysical: 0,
  },
  [GOAL_TYPES.QUALITATIVE_OBSERVATION]: {
    notes: '',
    rating: 3,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, FullPhysical: 0,
  },
  [GOAL_TYPES.LANGUAGE_COMPREHENSION]: {
    questionsCorrect: 0,
    questionsIncorrect: 0,
    details: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, FullPhysical: 0,
  },
  [GOAL_TYPES.LANGUAGE_EXPRESSION]: {
    opportunities: 0,
    successfulResponses: 0,
    unsuccessfulResponses: 0,
    details: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, FullPhysical: 0,
  },
  [GOAL_TYPES.PHONOLOGICAL_PROCESSES]: {
    targetProcess: '',
    opportunities: 0,
    correctProductions: 0,
    incorrectProductions: 0,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, FullPhysical: 0,
  },
  [GOAL_TYPES.FEEDING_SWALLOWING]: {
    foodOrLiquidName: '',
    textureOrConsistency: '',
    trialsAccepted: 0,
    trialsRefused: 0,
    notes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, FullPhysical: 0,
  },
  [GOAL_TYPES.SEQUENCED_TRIALS]: {
    trialsPerAttempt: 5,
    successfulAttempts: 0,
    failedAttempts: 0,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, FullPhysical: 0,
  },
  [GOAL_TYPES.PROMPTING]: {
    notes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, FullPhysical: 0,
  },
};

// Defines a color palette for different prompt types, used in charts or UI for visual distinction.
export const PROMPT_COLORS: Record<PromptType, string> = {
  Independent: '#8B5CF6', // violet-500
  Visual: '#2DD4BF', // teal-400 (New color)
  Verbal: '#3B82F6', // blue-500
  Gestural: '#10B981', // emerald-500
  PartialPhysical: '#F59E0B', // amber-500
  FullPhysical: '#EF4444', // red-500
};

// Defines short abbreviations for prompt types, useful for compact UI displays.
export const PROMPT_ABBREVIATIONS: Record<PromptType, string> = {
  Independent: 'Ind',
  Visual: 'Vis', // New abbreviation
  Verbal: 'V',
  Gestural: 'G',
  PartialPhysical: 'PP',
  FullPhysical: 'FP',
};

// Defines an array of default goal templates that are pre-loaded into the application.
// These serve as starting points for users to assign or modify.
export const DEFAULT_GOAL_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  // Existing Articulation Goals
  {
    name: 'Produce /s/ in Isolation',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to produce the /s/ sound in isolation.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /p/ in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /p/ sound in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /b/ in medial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /b/ sound in the medial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /t/ in final word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /t/ sound in the final position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /k/ in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /k/ sound in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /g/ in final word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /g/ sound in the final position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /f/ in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /f/ sound in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /l/ in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /l/ sound in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /r/ in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /r/ sound in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce "sh" (ʃ) in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the "sh" (ʃ) sound in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce "ch" (tʃ) in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the "ch" (tʃ) sound in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /m/ in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /m/ sound in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /s/ in final word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /s/ sound in the final position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /l/ in medial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /l/ sound in the medial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /r/ in medial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /r/ sound in the medial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce voiced "th" (ð) in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the voiced "th" (ð) sound in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce "sp" blend in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the "sp" consonant blend in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /v/ in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /v/ sound in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /z/ in final word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /z/ sound in the final position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /n/ in final word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /n/ sound in the final position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /j/ (as in "yes") in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /j/ sound (as in "yes") in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /h/ in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the /h/ sound in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce "ng" (ŋ) in final word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the "ng" (ŋ) sound in the final position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce "sk" blend in final word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the "sk" consonant blend in the final position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce "tr" blend in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the "tr" consonant blend in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /s/ in sentences',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to produce /s/ in sentences with 80% accuracy.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /l/ in phrases',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to produce /l/ in phrases with 80% accuracy.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce vocalic /r/ (e.g., -er, -ar, -or) in words',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to produce vocalic /r/ sounds in words with 75% accuracy.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 75,
  },
  {
    name: 'Produce "st" blend in final word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the "st" consonant blend in the final position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce "pl" blend in initial word position',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce the "pl" consonant blend in the initial position of words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Produce /k/ in conversational speech',
    type: GOAL_TYPES.ARTICULATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to accurately produce /k/ in conversational speech with minimal prompting.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 90,
  },

  // Phonological Processes Goals
  {
    name: 'Eliminate Final Consonant Deletion in CVC words',
    type: GOAL_TYPES.PHONOLOGICAL_PROCESSES as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to eliminate final consonant deletion in CVC words.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Reduce Fronting of /k, g/ to /t, d/',
    type: GOAL_TYPES.PHONOLOGICAL_PROCESSES as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to reduce the phonological process of fronting for /k/ and /g/ sounds.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 75,
  },
  {
    name: 'Reduce Stopping of Fricatives (e.g., /s/ to /t/)',
    type: GOAL_TYPES.PHONOLOGICAL_PROCESSES as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to reduce stopping of fricative sounds like /s/ and /f/.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 75,
  },
  {
    name: 'Eliminate Cluster Reduction for s-blends',
    type: GOAL_TYPES.PHONOLOGICAL_PROCESSES as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to eliminate cluster reduction for initial s-blends (e.g., "spoon" not "poon").',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Reduce Gliding of /l/ to /w/ or /j/',
    type: GOAL_TYPES.PHONOLOGICAL_PROCESSES as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to reduce gliding of the /l/ sound.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 75,
  },

  // Language Comprehension Goals
  {
    name: 'Follow 1-step directions with spatial concepts',
    type: GOAL_TYPES.LANGUAGE_COMPREHENSION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to follow 1-step directions involving spatial concepts (e.g., in, on, under).',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 90,
  },
  {
    name: 'Answer "Who" and "What" questions after a short story',
    type: GOAL_TYPES.LANGUAGE_COMPREHENSION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to answer "who" and "what" questions accurately after listening to a short story.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Identify objects by function (e.g., "Show me what you write with")',
    type: GOAL_TYPES.LANGUAGE_COMPREHENSION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to identify common objects by their function when named by the clinician.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 85,
  },
  {
    name: 'Understand basic temporal concepts (before, after)',
    type: GOAL_TYPES.LANGUAGE_COMPREHENSION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to demonstrate understanding of basic temporal concepts like "before" and "after".',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Identify main idea of a paragraph',
    type: GOAL_TYPES.LANGUAGE_COMPREHENSION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to identify the main idea of a short, age-appropriate paragraph.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 75,
  },

  // Language Expression Goals
  {
    name: "Use regular past tense '-ed' verbs correctly in sentences",
    type: GOAL_TYPES.LANGUAGE_EXPRESSION as GoalType,
    smartGoalPrompt: "Generate a SMART goal for a student to use regular past tense '-ed' verbs correctly in sentences.",
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Use subjective pronouns (he, she, they) accurately',
    type: GOAL_TYPES.LANGUAGE_EXPRESSION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to use subjective pronouns (he, she, they) accurately in sentences.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 85,
  },
  {
    name: 'Formulate grammatically correct 3-4 word sentences',
    type: GOAL_TYPES.LANGUAGE_EXPRESSION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to formulate grammatically correct 3-4 word sentences to express needs or ideas.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Name 5 items in common categories (e.g., animals, food, clothes)',
    type: GOAL_TYPES.LANGUAGE_EXPRESSION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to name at least 5 items when given a common category.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 90,
  },
  {
    name: 'Use possessive /s/ correctly (e.g., "Mommy\'s shoe")',
    type: GOAL_TYPES.LANGUAGE_EXPRESSION as GoalType,
    smartGoalPrompt: "Generate a SMART goal for a student to use possessive /'s/ correctly in phrases or sentences.",
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  {
    name: 'Retell a short story including 3 key elements',
    type: GOAL_TYPES.LANGUAGE_EXPRESSION as GoalType,
    smartGoalPrompt: "Generate a SMART goal for a student to retell a familiar short story including at least 3 key story grammar elements (character, setting, problem, action, resolution).",
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 75,
  },

  // Fluency Goals
  {
    name: 'Reduce instances of syllable repetitions during reading',
    type: GOAL_TYPES.FLUENCY_SYLLABLE_STUTTER as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to reduce instances of syllable repetitions while reading a short passage aloud.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 90,
  },
  {
    name: 'Use easy onsets for initiating speech in structured tasks',
    type: GOAL_TYPES.FLUENCY_SYLLABLE_STUTTER as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to use easy onset strategy to initiate speech in structured tasks (e.g., sentence repetition, picture description) with 90% success over 10 trials.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 90,
  },
  {
    name: 'Maintain fluent speech during 2-minute monologue',
    type: GOAL_TYPES.FLUENCY_SYLLABLE_STUTTER as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to maintain fluent speech (less than 3% disfluencies) during a 2-minute monologue on a familiar topic.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 97,
  },

  // Pragmatics/Social Language Goals (Qualitative Observation)
  {
    name: 'Maintain topic for 3 conversational turns with peers',
    type: GOAL_TYPES.QUALITATIVE_OBSERVATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to maintain the topic of conversation for at least 3 conversational turns with a peer, with minimal redirection.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 4,
  },
  {
    name: 'Initiate greetings and farewells appropriately',
    type: GOAL_TYPES.QUALITATIVE_OBSERVATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to independently initiate appropriate greetings and farewells in structured social settings.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 4,
  },
  {
    name: 'Make appropriate eye contact during conversation',
    type: GOAL_TYPES.QUALITATIVE_OBSERVATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to make appropriate eye contact during conversational exchanges.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 3,
  },
  {
    name: 'Ask relevant follow-up questions in conversation',
    type: GOAL_TYPES.QUALITATIVE_OBSERVATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to ask at least one relevant follow-up question during a conversation to show engagement.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 4,
  },
  {
    name: 'Use appropriate vocal loudness in classroom setting',
    type: GOAL_TYPES.QUALITATIVE_OBSERVATION as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to use appropriate vocal loudness (not too loud, not too soft) during classroom discussions, as rated by the clinician.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 4,
  },
  // Feeding and Swallowing Goals
  {
    name: 'Increase Acceptance of New Food Textures',
    type: GOAL_TYPES.FEEDING_SWALLOWING as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to increase acceptance of new food textures, starting with purees and moving to soft solids.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 75,
  },
  {
    name: 'Safely Manage Thin Liquids',
    type: GOAL_TYPES.FEEDING_SWALLOWING as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to safely manage thin liquids without signs of aspiration, using compensatory strategies as needed.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 95,
  },
  {
    name: 'Demonstrate Proper Chewing for Soft Solids',
    type: GOAL_TYPES.FEEDING_SWALLOWING as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to demonstrate a rotary chewing pattern for soft solid foods across 10 trials.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  // New Sequenced Trials Goal
  {
    name: 'Complete 3-step sequences',
    type: GOAL_TYPES.SEQUENCED_TRIALS as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to complete 3-step sequences or tasks across multiple attempts.',
    generatedSmartGoal: '',
    isDefault: true,
    sessionTargetValue: 80,
  },
  // New Prompting Goal
  {
    name: 'Reduce Total Prompts for Task Completion',
    type: GOAL_TYPES.PROMPTING as GoalType,
    smartGoalPrompt: 'Generate a SMART goal for a student to complete a familiar task (e.g., writing their name) while requiring fewer than 5 total prompts.',
    generatedSmartGoal: '',
    isDefault: true,
  },
];

// Defines the maximum number of student slots allowed on the data entry page.
export const MAX_STUDENTS_DATA_ENTRY = 5;

    
