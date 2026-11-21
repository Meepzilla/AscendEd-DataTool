import type { GoalTemplate } from '../types';

// Language sample goals measure the mean length of utterance (MLU); item mastery goals track a list of targets one
// by one. The session data is described in language-sample.ts and item-mastery.ts; the unit and the items are set
// on each student's goal (Edit Goal).
export const LANGUAGE_SAMPLE_FIELDS: Record<string, Record<string, any>> = {
  LANGUAGE_SAMPLE: { utterances: [], notes: '' },
  ITEM_MASTERY: { items: [], notes: '' },
};

const BY_SLP = 'as measured by SLP language sample analysis';
const OBSERVED = 'as measured by SLP or teacher observation and data collection';

export const LANGUAGE_SAMPLE_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  {
    name: 'Increase mean length of utterance in words (language sample)',
    type: 'LANGUAGE_SAMPLE', isDefault: true, sessionTargetValue: 3, sampleUnit: 'words',
    smartGoalPrompt: `By [date], the student will produce utterances with a mean length of utterance (MLU) of at least 3 words during play or conversation across 3 consecutive sessions, ${BY_SLP}.`,
    generatedSmartGoal: `By [date], the student will produce utterances with a mean length of utterance (MLU) of at least 3 words during play or conversation across 3 consecutive sessions, ${BY_SLP}.`,
  },
  {
    name: 'Increase mean length of utterance in morphemes (language sample)',
    type: 'LANGUAGE_SAMPLE', isDefault: true, sessionTargetValue: 4, sampleUnit: 'morphemes',
    smartGoalPrompt: `By [date], the student will produce utterances with a mean length of utterance (MLU) of at least 4 morphemes during play or conversation across 3 consecutive sessions, ${BY_SLP}.`,
    generatedSmartGoal: `By [date], the student will produce utterances with a mean length of utterance (MLU) of at least 4 morphemes during play or conversation across 3 consecutive sessions, ${BY_SLP}.`,
  },
  {
    name: 'Use core vocabulary words (item mastery)',
    type: 'ITEM_MASTERY', isDefault: true, sessionTargetValue: 80,
    listItems: ['want', 'more', 'go', 'stop', 'help', 'all done', 'my', 'turn', 'open', 'like'],
    smartGoalPrompt: `By [date], the student will use each of the listed core vocabulary words, by speech, sign or AAC, with 80% accuracy across 3 consecutive sessions, ${OBSERVED}.`,
    generatedSmartGoal: `By [date], the student will use each of the listed core vocabulary words, by speech, sign or AAC, with 80% accuracy across 3 consecutive sessions, ${OBSERVED}.`,
  },
  {
    name: 'Read sight words (item mastery)',
    type: 'ITEM_MASTERY', isDefault: true, sessionTargetValue: 80,
    listItems: ['the', 'and', 'a', 'to', 'said', 'in', 'he', 'I', 'of', 'it', 'was', 'you', 'they', 'on', 'she', 'is', 'for', 'at', 'his', 'but'],
    smartGoalPrompt: 'By [date], the student will read each of the listed sight words with 80% accuracy across 3 consecutive sessions, as measured by teacher or staff observation and data collection.',
    generatedSmartGoal: 'By [date], the student will read each of the listed sight words with 80% accuracy across 3 consecutive sessions, as measured by teacher or staff observation and data collection.',
  },
  {
    name: 'Name target vocabulary words (item mastery)',
    type: 'ITEM_MASTERY', isDefault: true, sessionTargetValue: 80,
    listItems: [],
    smartGoalPrompt: `By [date], the student will name each of the listed target vocabulary words when shown a picture with 80% accuracy across 3 consecutive sessions, ${OBSERVED}.`,
    generatedSmartGoal: `By [date], the student will name each of the listed target vocabulary words when shown a picture with 80% accuracy across 3 consecutive sessions, ${OBSERVED}.`,
  },
];
