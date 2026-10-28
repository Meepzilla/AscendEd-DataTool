import type { GoalTemplate } from '../types';

// Story Champs simple story parts, each scored 0 (missing), 1 (partial/unclear) or 2 (clear and complete).
export const STORY_PARTS = [
  { key: 'character', label: 'Character' },
  { key: 'setting', label: 'Setting' },
  { key: 'problem', label: 'Problem' },
  { key: 'feeling', label: 'Feeling' },
  { key: 'action', label: 'Action' },
  { key: 'ending', label: 'Ending' },
  { key: 'endFeeling', label: 'End Feeling' },
] as const;

export const STORY_PART_SCORE_LABELS = ['Missing', 'Partial', 'Complete'] as const;
export const STORY_MAX_SCORE = STORY_PARTS.length * 2;

// Linking (complexity) words tallied during the story, stored as `word${Word}` (e.g. wordBecause).
export const STORY_LINKING_WORDS = ['because', 'then', 'when', 'so', 'after', 'but'] as const;
export const linkingWordField = (word: string) => `word${word.charAt(0).toUpperCase()}${word.slice(1)}`;

export const STORY_CHAMPS_FIELDS: Record<string, Record<string, any>> = {
  STORY_CHAMPS: {
    notes: '',
    ...Object.fromEntries(STORY_PARTS.map(p => [p.key, 0])),
    ...Object.fromEntries(STORY_LINKING_WORDS.map(w => [linkingWordField(w), 0])),
  },
};

/** Story grammar score for a STORY_CHAMPS session: points out of STORY_MAX_SCORE, and parts included. */
export function scoreStory(data: Record<string, any> = {}) {
  let points = 0;
  let partsIncluded = 0;
  for (const { key } of STORY_PARTS) {
    const score = Math.min(2, Math.max(0, Number(data[key]) || 0));
    points += score;
    if (score > 0) partsIncluded += 1;
  }
  const linkingWords = STORY_LINKING_WORDS.reduce((sum, w) => sum + (Number(data[linkingWordField(w)]) || 0), 0);
  return { points, maxPoints: STORY_MAX_SCORE, percent: (points / STORY_MAX_SCORE) * 100, partsIncluded, linkingWords };
}

export const STORY_CHAMPS_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Story Champs: Retell a simple story with all story parts', type: 'STORY_CHAMPS', smartGoalPrompt: 'After listening to a Story Champs model story, student will retell the story including character, setting, problem, feeling, action, ending, and end feeling.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Story Champs: Tell a personal story with story grammar', type: 'STORY_CHAMPS', smartGoalPrompt: 'Student will tell a personal story that includes a problem, feeling, action, and ending.', isDefault: true, sessionTargetValue: 70, generatedSmartGoal: '' },
  { name: 'Story Champs: Use linking words in a story', type: 'STORY_CHAMPS', smartGoalPrompt: 'Student will use linking words (e.g., because, then, when, so) to connect events while retelling or telling a story.', isDefault: true, sessionTargetValue: 70, generatedSmartGoal: '' },
];
