import type { BuiltInGoalType } from './types';

export interface GoalTypeScreenshot {
  /** Public path under /public/help/goal-types/ (served statically and precached offline). */
  src: string;
  /** Natural CSS layout width (images are captured at 2x DPI). */
  width: number;
  /** Natural CSS layout height (images are captured at 2x DPI). */
  height: number;
}

/**
 * Data Entry screenshots for every built-in goal type, shown beside each type in Help → Goal types.
 * Typed as Record<BuiltInGoalType, ...> so adding a new built-in GoalType requires adding its screenshot here.
 */
export const GOAL_TYPE_SCREENSHOTS: Record<BuiltInGoalType, GoalTypeScreenshot> = {
  AAC: { src: '/help/goal-types/aac.webp', width: 330, height: 323 },
  ARTICULATION: { src: '/help/goal-types/articulation.webp', width: 330, height: 323 },
  ITEM_MASTERY: { src: '/help/goal-types/item-mastery.webp', width: 330, height: 494 },
  LANGUAGE_SAMPLE: { src: '/help/goal-types/language-sample.webp', width: 330, height: 486 },
  BEHAVIOR_ABC: { src: '/help/goal-types/behavior-abc.webp', width: 330, height: 800 },
  BEHAVIOR_DURATION: { src: '/help/goal-types/behavior-duration.webp', width: 330, height: 466 },
  BEHAVIOR_FREQUENCY: { src: '/help/goal-types/behavior-frequency.webp', width: 330, height: 365 },
  BEHAVIOR_INTERVAL: { src: '/help/goal-types/behavior-interval.webp', width: 330, height: 424 },
  BEHAVIOR_LATENCY: { src: '/help/goal-types/behavior-latency.webp', width: 330, height: 403 },
  COGNITIVE: { src: '/help/goal-types/cognitive.webp', width: 330, height: 307 },
  COMMUNICATION_COUNT: { src: '/help/goal-types/communication-count.webp', width: 330, height: 365 },
  COMMUNICATION_DURATION: { src: '/help/goal-types/communication-duration.webp', width: 330, height: 466 },
  COMMUNICATION_FUNCTIONS: { src: '/help/goal-types/communication-functions.webp', width: 330, height: 633 },
  COMMUNICATION_OPPORTUNITIES: { src: '/help/goal-types/communication-opportunities.webp', width: 330, height: 334 },
  DISCRETE_TRIALS: { src: '/help/goal-types/discrete-trials.webp', width: 330, height: 373 },
  FEEDING_SWALLOWING: { src: '/help/goal-types/feeding-swallowing.webp', width: 330, height: 412 },
  FLUENCY_SYLLABLE_STUTTER: { src: '/help/goal-types/fluency-syllable-stutter.webp', width: 330, height: 560 },
  GOAL_ATTAINMENT_SCALE: { src: '/help/goal-types/goal-attainment-scale.webp', width: 330, height: 402 },
  LANGUAGE_COMPREHENSION: { src: '/help/goal-types/language-comprehension.webp', width: 330, height: 334 },
  LANGUAGE_EXPRESSION: { src: '/help/goal-types/language-expression.webp', width: 330, height: 334 },
  PHONOLOGICAL_PROCESSES: { src: '/help/goal-types/phonological-processes.webp', width: 330, height: 334 },
  PROMPTING: { src: '/help/goal-types/prompting.webp', width: 330, height: 257 },
  QUALITATIVE_OBSERVATION: { src: '/help/goal-types/qualitative-observation.webp', width: 330, height: 307 },
  RESPONSE_TIME: { src: '/help/goal-types/response-time.webp', width: 330, height: 403 },
  SEQUENCED_TRIALS: { src: '/help/goal-types/sequenced-trials.webp', width: 330, height: 334 },
  STORY_ELEMENTS: { src: '/help/goal-types/story-elements.webp', width: 330, height: 582 },
  TASK_ANALYSIS: { src: '/help/goal-types/task-analysis.webp', width: 330, height: 504 },
};
