
import type { GoalTemplate } from '../types';

export { TRIALS_FIELDS } from './fields';

export const TRIALS_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Tact objects (discrete trial training)', type: 'DISCRETE_TRIALS', smartGoalPrompt: 'Student will correctly tact 10 objects from a field of 3.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: ''},
  { name: 'Respond to a targeted skill (5 discrete trials)', type: 'DISCRETE_TRIALS', smartGoalPrompt: 'Student will complete 5 discrete trials for a targeted skill.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
];
