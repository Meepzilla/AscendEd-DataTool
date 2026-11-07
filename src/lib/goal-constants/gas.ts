import type { GoalTemplate } from '../types';

// Goal Attainment Scaling: a session records the level reached (-2 to +2), with 0 the expected outcome.
// No level recorded yet means no data, so gasLevel starts undefined and is never defaulted to 0.
export const GAS_FIELDS: Record<string, Record<string, any>> = {
  GOAL_ATTAINMENT_SCALE: {
    gasLevel: undefined,
    notes: '',
  },
};

export const GAS_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  // --- Communication ---
  { name: 'GAS: Initiate communication with a peer', type: 'GOAL_ATTAINMENT_SCALE', smartGoalPrompt: 'Student will initiate communication with a peer during free play or a group activity.', isDefault: true, sessionTargetValue: 0, baseline: -2, generatedSmartGoal: '' },
  { name: 'GAS: Use AAC to make a request', type: 'GOAL_ATTAINMENT_SCALE', smartGoalPrompt: 'Student will use their AAC system to make a request for a desired item or activity.', isDefault: true, sessionTargetValue: 0, baseline: -2, generatedSmartGoal: '' },
  // --- Participation ---
  { name: 'GAS: Participate in a group activity', type: 'GOAL_ATTAINMENT_SCALE', smartGoalPrompt: 'Student will participate in a classroom group activity with peers.', isDefault: true, sessionTargetValue: 0, baseline: -2, generatedSmartGoal: '' },
  // --- Independence ---
  { name: 'GAS: Complete a classroom routine independently', type: 'GOAL_ATTAINMENT_SCALE', smartGoalPrompt: 'Student will complete a classroom routine independently.', isDefault: true, sessionTargetValue: 0, baseline: -2, generatedSmartGoal: '' },
];
