import type { GoalTemplate } from '../types';

// Story grammar (story elements): the parts of a simple story, each scored 0 (missing), 1 (partial/unclear) or 2 (clear and complete),
// or marked not assessed (STORY_PART_NOT_ASSESSED), which leaves that part out of the score.
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

/**
 * A story part that wasn't assessed this session. Stored as a number so it survives CSV export and import, and so
 * merging sessions (the best score of each part) keeps any real score over it.
 */
export const STORY_PART_NOT_ASSESSED = -1;

/** A story part's score (0-2), or null when it wasn't assessed. */
export function storyPartScore(value: unknown): number | null {
  const n = Number(value) || 0;
  return n === STORY_PART_NOT_ASSESSED ? null : Math.min(2, Math.max(0, n));
}

/** The average score (0-2) of one story part over sessions, counting only those where it was assessed; null if none. */
export function averageStoryPart(data: Record<string, any>[], key: string): number | null {
  const scores = data.map(d => storyPartScore(d[key])).filter((v): v is number => v !== null);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

// Linking (complexity) words tallied during the story, stored as `word${Word}` (e.g. wordBecause).
export const STORY_LINKING_WORDS = ['because', 'then', 'when', 'so', 'after', 'but'] as const;
export const linkingWordField = (word: string) => `word${word.charAt(0).toUpperCase()}${word.slice(1)}`;

export const STORY_ELEMENTS_FIELDS: Record<string, Record<string, any>> = {
  STORY_ELEMENTS: {
    notes: '',
    ...Object.fromEntries(STORY_PARTS.map(p => [p.key, 0])),
    ...Object.fromEntries(STORY_LINKING_WORDS.map(w => [linkingWordField(w), 0])),
  },
};

/**
 * Story grammar score for a STORY_ELEMENTS session: points out of the most possible for the parts assessed (2 each;
 * parts marked not assessed are left out), and parts included. With no part assessed, maxPoints and percent are 0.
 */
export function scoreStory(data: Record<string, any> = {}) {
  let points = 0;
  let partsIncluded = 0;
  let notAssessed = 0;
  for (const { key } of STORY_PARTS) {
    const score = storyPartScore(data[key]);
    if (score === null) { notAssessed += 1; continue; }
    points += score;
    if (score > 0) partsIncluded += 1;
  }
  const maxPoints = (STORY_PARTS.length - notAssessed) * 2;
  const linkingWords = STORY_LINKING_WORDS.reduce((sum, w) => sum + (Number(data[linkingWordField(w)]) || 0), 0);
  return { points, maxPoints, percent: maxPoints > 0 ? (points / maxPoints) * 100 : 0, partsIncluded, notAssessed, linkingWords };
}

export const STORY_ELEMENTS_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Story elements: Retell a simple story with all story parts', type: 'STORY_ELEMENTS', smartGoalPrompt: 'After listening to a model story, student will retell the story including character, setting, problem, feeling, action, ending, and end feeling.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Story elements: Tell a personal story with story grammar', type: 'STORY_ELEMENTS', smartGoalPrompt: 'Student will tell a personal story that includes a problem, feeling, action, and ending.', isDefault: true, sessionTargetValue: 70, generatedSmartGoal: '' },
  { name: 'Story elements: Use linking words in a story', type: 'STORY_ELEMENTS', smartGoalPrompt: 'Student will use linking words (e.g., because, then, when, so) to connect events while retelling or telling a story.', isDefault: true, sessionTargetValue: 70, generatedSmartGoal: '' },
  { name: 'Story elements: Retell a story with character, setting, and problem', type: 'STORY_ELEMENTS', smartGoalPrompt: 'After listening to a model story, student will retell the beginning of the story, clearly including the character, setting, and problem.', isDefault: true, sessionTargetValue: 40, generatedSmartGoal: '' },
  { name: 'Story elements: Include a problem, feeling, and action', type: 'STORY_ELEMENTS', smartGoalPrompt: 'Student will retell or tell a story that includes the problem, the character\'s feeling about the problem, and an action taken to solve it.', isDefault: true, sessionTargetValue: 60, generatedSmartGoal: '' },
  { name: 'Story elements: Retell a story without picture icons', type: 'STORY_ELEMENTS', smartGoalPrompt: 'Student will retell a model story including all story parts without the support of picture icons.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Story elements: Tell a complete personal story', type: 'STORY_ELEMENTS', smartGoalPrompt: 'Student will tell a personal story about a real event that includes all story parts and at least two linking words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  // Previously a language expression goal (correct/incorrect counts); see DEFAULT_TEMPLATE_UPDATES.
  { name: 'Retell a short story with 3 key elements', type: 'STORY_ELEMENTS', smartGoalPrompt: 'Student will retell a short story clearly including 3 key story parts (e.g., character, problem, and ending).', isDefault: true, sessionTargetValue: 40, generatedSmartGoal: '' },
];

