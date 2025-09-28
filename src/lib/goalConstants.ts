
import type { GoalTemplate, GoalType } from './types';

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
  DISCRETE_TRIALS: 'DISCRETE_TRIALS',
};

// Defines the default data structure (fields and initial values) for each goal type
// when a new session entry is initiated. Prompt counts are included where relevant.
export const GOAL_TYPE_FIELDS: Record<GoalType, Record<string, any>> = {
  [GOAL_TYPES.ARTICULATION]: {
    correct: 0,
    incorrect: 0,
    approximate: 0,
    targetSound: '',
    wordList: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  [GOAL_TYPES.FLUENCY_SYLLABLE_STUTTER]: {
    totalSyllables: 0,
    stutteredSyllables: 0,
    observationNotes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  [GOAL_TYPES.QUALITATIVE_OBSERVATION]: {
    notes: '',
    rating: 3,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  [GOAL_TYPES.LANGUAGE_COMPREHENSION]: {
    questionsCorrect: 0,
    questionsIncorrect: 0,
    approximate: 0,
    details: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  [GOAL_TYPES.LANGUAGE_EXPRESSION]: {
    successfulResponses: 0,
    unsuccessfulResponses: 0,
    approximate: 0,
    details: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  [GOAL_TYPES.PHONOLOGICAL_PROCESSES]: {
    targetProcess: '',
    correctProductions: 0,
    incorrectProductions: 0,
    approximate: 0,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  [GOAL_TYPES.FEEDING_SWALLOWING]: {
    foodOrLiquidName: '',
    textureOrConsistency: '',
    trialsAccepted: 0,
    trialsRefused: 0,
    notes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  [GOAL_TYPES.SEQUENCED_TRIALS]: {
    trialsPerAttempt: 5,
    successfulAttempts: 0,
    failedAttempts: 0,
    approximate: 0,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  [GOAL_TYPES.PROMPTING]: {
    notes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  [GOAL_TYPES.DISCRETE_TRIALS]: {
    numberOfTrials: 5,
    trials: Array(5).fill('untouched'),
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

// Defines an array of default goal templates that are pre-loaded into the application.
// These serve as starting points for users to assign or modify.
export const DEFAULT_GOAL_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  // Articulation Goals - Expanded for word positions
  { name: 'Produce /p/ in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /p/ in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /p/ in medial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /p/ in the medial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /p/ in final word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /p/ in the final position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /b/ in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /b/ in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /b/ in medial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /b/ in the medial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /b/ in final word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /b/ in the final position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /t/ in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /t/ in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /t/ in medial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /t/ in the medial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /t/ in final word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /t/ in the final position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /d/ in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /d/ in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /d/ in medial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /d/ in the medial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /d/ in final word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /d/ in the final position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /k/ in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /k/ in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /k/ in medial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /k/ in the medial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /k/ in final word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /k/ in the final position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /g/ in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /g/ in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /g/ in medial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /g/ in the medial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /g/ in final word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /g/ in the final position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /f/ in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /f/ in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /f/ in medial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /f/ in the medial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /f/ in final word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /f/ in the final position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /v/ in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /v/ in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /s/ in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /s/ in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /s/ in medial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /s/ in the medial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /s/ in final word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /s/ in the final position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /l/ in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /l/ in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /l/ in medial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /l/ in the medial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /l/ in final word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /l/ in the final position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /r/ in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /r/ in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce vocalic /r/ (-er) in words', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce vocalic /r/ (-er) in words.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Produce "sp" blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the "sp" blend in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce "st" blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the "st" blend in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce "sk" blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the "sk" blend in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce "pl" blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the "pl" blend in initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce "bl" blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the "bl" blend in initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce "gr" blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the "gr" blend in initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /d/ in sentences', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /d/ in sentences.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /v/ in conversational speech', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /v/ in conversational speech.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'Produce "ch" (tʃ) in sentences', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce "ch" (tʃ) in sentences.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },

  // Syllable Shape Goals
  { name: 'Produce CV syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce Consonant-Vowel (CV) syllable structures in isolation or in single words.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'Produce VC syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce Vowel-Consonant (VC) syllable structures in isolation or in single words.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'Produce CVC syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce Consonant-Vowel-Consonant (CVC) words.', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },
  { name: 'Produce CVCV syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce reduplicated Consonant-Vowel-Consonant-Vowel (CVCV) syllable structures (e.g., "dada", "wawa").', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },
  { name: 'Produce VCV syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce Vowel-Consonant-Vowel (VCV) words (e.g., "apple", "away").', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce CCVC syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce initial Consonant-Consonant-Vowel-Consonant (CCVC) words (e.g., "stop", "plan").', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Produce CVCC syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce final Consonant-Vowel-Consonant-Consonant (CVCC) words (e.g., "lamp", "desk").', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },

  // Phonological Processes Goals (10)
  { name: 'Eliminate Final Consonant Deletion in CVC words', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will eliminate final consonant deletion in CVC words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Reduce Fronting of /k, g/', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce fronting of /k, g/ sounds.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce Stopping of Fricatives (/s/, /f/)', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce stopping of /s/ and /f/ sounds.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Eliminate Cluster Reduction for s-blends', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will eliminate cluster reduction for initial s-blends.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Eliminate Cluster Reduction for l-blends', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will eliminate cluster reduction for initial l-blends.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Reduce Gliding of /l/ to /w/', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce gliding of the /l/ sound.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce Gliding of /r/ to /w/', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce gliding of the /r/ sound.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce Deaffrication of "ch" to "sh"', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce deaffrication, correctly producing "ch".', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce Weak Syllable Deletion in 3-syllable words', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce weak syllable deletion in 3-syllable words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Reduce Prevocalic Voicing', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce prevocalic voicing (e.g., saying "den" for "ten").', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },

  // Language Comprehension Goals (10)
  { name: 'Follow 1-step directions with spatial concepts', type: 'LANGUAGE_COMPREHENSION', smartGoalPrompt: 'Student will follow 1-step directions with spatial concepts (in, on, under).', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'Follow 2-step related directions', type: 'LANGUAGE_COMPREHENSION', smartGoalPrompt: 'Student will follow 2-step related directions (e.g., "get the ball and throw it").', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Answer "Who" and "What" questions from a story', type: 'LANGUAGE_COMPREHENSION', smartGoalPrompt: 'Student will answer "who" and "what" questions after a short story.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Answer "Where" and "When" questions', type: 'LANGUAGE_COMPREHENSION', smartGoalPrompt: 'Student will answer "where" and "when" questions about events.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Identify objects by function', type: 'LANGUAGE_COMPREHENSION', smartGoalPrompt: 'Student will identify objects by their function from a field of 3.', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },
  { name: 'Understand basic temporal concepts (before/after)', type: 'LANGUAGE_COMPREHENSION', smartGoalPrompt: 'Student will demonstrate understanding of "before" and "after".', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Identify main idea of a paragraph', type: 'LANGUAGE_COMPREHENSION', smartGoalPrompt: 'Student will identify the main idea of a short paragraph.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Make inferences from text', type: 'LANGUAGE_COMPREHENSION', smartGoalPrompt: 'Student will make a logical inference when presented with a short story.', isDefault: true, sessionTargetValue: 70, generatedSmartGoal: '' },
  { name: 'Understand pronouns (he/she/they)', type: 'LANGUAGE_COMPREHENSION', smartGoalPrompt: 'Student will identify the correct referent for pronouns he, she, and they.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'Compare and contrast two objects', type: 'LANGUAGE_COMPREHENSION', smartGoalPrompt: 'Student will name one similarity and one difference between two objects.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },

  // Language Expression & Communicative Functions Goals (15)
  { name: "Use regular past tense '-ed' verbs", type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: "Student will use regular past tense '-ed' verbs in sentences.", isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Use subjective pronouns (he, she, they) accurately', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will use subjective pronouns accurately in sentences.', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },
  { name: 'Formulate 3-4 word sentences', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will formulate grammatically correct 3-4 word sentences.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Name 5 items in common categories', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will name at least 5 items when given a category.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: "Use possessive /'s/ correctly", type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: "Student will use possessive /'s/ correctly.", isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Retell a short story with 3 key elements', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will retell a story including 3 key elements.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Use negation in sentences (not, no, don\'t)', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will use negation correctly in sentences.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Ask "Wh-" questions to gain information', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will ask a "Wh-" question to gain information.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Request for a desired item or activity', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will spontaneously request for a desired item.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Protest or reject an undesired item or activity', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will use a functional way to protest or reject.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Make a comment during a shared activity', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will make a spontaneous, relevant comment during an activity.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Request for assistance', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will independently request assistance when needed.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Gain attention of a communication partner', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will use a method to gain attention before communicating.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Describe object using 2-3 attributes', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will describe an object using 2-3 critical attributes (e.g., color, size, shape).', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Use regular plural -s', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will use regular plural -s in phrases or sentences.', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },

  // Gestalt Language Processing (GLP) Goals (6)
  { name: 'GLP: Increase inventory of mitigable gestalts', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will demonstrate use of new, mitigable gestalts during play-based activities.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'GLP: Mitigate gestalts into smaller units', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will begin to break down longer gestalts into smaller, more flexible units.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'GLP: Combine single words into two-word phrases', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will combine two single words into a functional two-word phrase.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'GLP: Spontaneously use a self-generated phrase', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will spontaneously use a novel (self-generated) phrase to communicate a need or want.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'GLP: Use language for a variety of communicative functions', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will use language for at least 3 different communicative functions (e.g., commenting, requesting, protesting).', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'GLP: Use grammar in self-generated sentences', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will begin to use grammatical markers (e.g., plurals, verb tenses) in self-generated sentences.', isDefault: true, sessionTargetValue: 70, generatedSmartGoal: '' },

  // New goal for sequenced trials
  { name: 'Discrete Trial Training - Tacting', type: 'SEQUENCED_TRIALS', smartGoalPrompt: 'Student will correctly tact 10 objects from a field of 3.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: ''},
  // New Goal for Discrete Trials
  { name: 'Discrete Trials - 5 Trials', type: 'DISCRETE_TRIALS', smartGoalPrompt: 'Student will complete 5 discrete trials for a targeted skill.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
];
