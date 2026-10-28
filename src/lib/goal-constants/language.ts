import type { GoalTemplate } from '../types';

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

export const LANGUAGE_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  // Language Comprehension Goals
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

  // Language Expression & Communicative Functions Goals
  { name: "Use regular past tense '-ed' verbs", type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: "Student will use regular past tense '-ed' verbs in sentences.", isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Use subjective pronouns (he, she, they) accurately', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will use subjective pronouns accurately in sentences.', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },
  { name: 'Formulate 3-4 word sentences', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will formulate grammatically correct 3-4 word sentences.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Name 5 items in common categories', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will name at least 5 items when given a category.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: "Use possessive /'s/ correctly", type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: "Student will use possessive /'s/ correctly.", isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Use negation in sentences (not, no, don\'t)', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will use negation correctly in sentences.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Ask "Wh-" questions to gain information', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will ask a "Wh-" question to gain information.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Request for a desired item or activity', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will spontaneously request for a desired item.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Make a comment during a shared activity', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will make a spontaneous, relevant comment during an activity.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Describe object using 2-3 attributes', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will describe an object using 2-3 critical attributes (e.g., color, size, shape).', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Use regular plural -s', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will use regular plural -s in phrases or sentences.', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },

  // Gestalt Language Processing (GLP) Goals
  { name: 'GLP: Combine single words into two-word phrases', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will combine two single words into a functional two-word phrase.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'GLP: Spontaneously use a self-generated phrase', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will spontaneously use a novel (self-generated) phrase to communicate a need or want.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'GLP: Use grammar in self-generated sentences', type: 'LANGUAGE_EXPRESSION', smartGoalPrompt: 'Student will begin to use grammatical markers (e.g., plurals, verb tenses) in self-generated sentences.', isDefault: true, sessionTargetValue: 70, generatedSmartGoal: '' },
];
