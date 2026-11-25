// Initial session field definitions for goal types whose built-in seed templates live in separate
// domain files. Keeping these small runtime field maps separate from the *_TEMPLATES arrays lets
// Webpack keep ~45 KB of built-in template text inside the async seed-bank chunk instead of
// bundling it into every page's First Load JS.

export const ARTICULATION_FIELDS: Record<string, Record<string, any>> = {
  ARTICULATION: {
    correct: 0,
    incorrect: 0,
    approximate: 0,
    targetSound: '',
    wordList: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const FLUENCY_FIELDS: Record<string, Record<string, any>> = {
  FLUENCY_SYLLABLE_STUTTER: {
    totalSyllables: 0,
    stutteredSyllables: 0,
    blocks: 0,
    repetitions: 0,
    prolongations: 0,
    interjections: 0,
    secondaryBehaviors: '',
    observationNotes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const LANGUAGE_FIELDS: Record<string, Record<string, any>> = {
  LANGUAGE_COMPREHENSION: {
    questionsCorrect: 0,
    questionsIncorrect: 0,
    approximate: 0,
    details: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  LANGUAGE_EXPRESSION: {
    successfulResponses: 0,
    unsuccessfulResponses: 0,
    approximate: 0,
    details: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const OBSERVATION_FIELDS: Record<string, Record<string, any>> = {
  QUALITATIVE_OBSERVATION: {
    notes: '',
    rating: 3,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  PROMPTING: {
    notes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const PHONOLOGICAL_FIELDS: Record<string, Record<string, any>> = {
  PHONOLOGICAL_PROCESSES: {
    targetProcess: '',
    correctProductions: 0,
    incorrectProductions: 0,
    approximate: 0,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const TRIALS_FIELDS: Record<string, Record<string, any>> = {
  FEEDING_SWALLOWING: {
    foodOrLiquidName: '',
    textureOrConsistency: '',
    trialsAccepted: 0,
    trialsRefused: 0,
    notes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  // Entered on the trial grid like discrete trials (sessions from before kept counts in the fields below).
  SEQUENCED_TRIALS: {
    numberOfTrials: 5,
    trials: Array(5).fill('untouched'),
    successfulAttempts: 0,
    failedAttempts: 0,
    approximate: 0,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  DISCRETE_TRIALS: {
    numberOfTrials: 5,
    trials: Array(5).fill('untouched'),
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const AAC_FIELDS: Record<string, Record<string, any>> = {
  AAC: {
    correct: 0,
    incorrect: 0,
    approximate: 0,
    details: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const COGNITIVE_FIELDS: Record<string, Record<string, any>> = {
  COGNITIVE: {
    notes: '',
    rating: 3,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

// Task analysis: steps are set on each student's goal (Edit Goal → Task Steps); a session stores each step's
// score (task-analysis.ts).
export const TASK_ANALYSIS_FIELDS: Record<string, Record<string, any>> = {
  TASK_ANALYSIS: { steps: [], notes: '' },
};

// Goal Attainment Scaling: a session records the level reached (-2 to +2), with 0 the expected outcome.
// No level recorded yet means no data, so gasLevel starts undefined and is never defaulted to 0.
export const GAS_FIELDS: Record<string, Record<string, any>> = {
  GOAL_ATTAINMENT_SCALE: {
    gasLevel: undefined,
    notes: '',
  },
};

// Language sample goals measure the mean length of utterance (MLU); item mastery goals track a list of targets one
// by one. The session data is described in language-sample.ts and item-mastery.ts; the unit and the items are set
// on each student's goal (Edit Goal).
export const LANGUAGE_SAMPLE_FIELDS: Record<string, Record<string, any>> = {
  LANGUAGE_SAMPLE: { utterances: [], notes: '' },
  ITEM_MASTERY: { items: [], notes: '' },
};
