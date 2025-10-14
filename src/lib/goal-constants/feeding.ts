
import type { GoalTemplate } from '../types';

export const FEEDING_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  // Dysphagia/Safe Eating Goals
  { name: 'Maintain safe swallow with thin liquids', type: 'FEEDING_SWALLOWING', smartGoalPrompt: 'Student will maintain a safe swallow (no signs/symptoms of aspiration) with thin liquids.', isDefault: true, sessionTargetValue: 95, generatedSmartGoal: '' },
  { name: 'Accept varied food textures', type: 'FEEDING_SWALLOWING', smartGoalPrompt: 'Student will accept at least 3 different food textures (e.g., puree, soft solid, crunchy) during a meal.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Use utensils to self-feed', type: 'FEEDING_SWALLOWING', smartGoalPrompt: 'Student will use a spoon or fork to independently bring food to their mouth.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Take appropriate bite sizes', type: 'FEEDING_SWALLOWING', smartGoalPrompt: 'Student will take appropriately sized bites of food without overstuffing.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'Chew food thoroughly before swallowing', type: 'FEEDING_SWALLOWING', smartGoalPrompt: 'Student will chew food completely before initiating a swallow.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'Maintain lip closure while chewing', type: 'FEEDING_SWALLOWING', smartGoalPrompt: 'Student will maintain lip closure while chewing to prevent food/liquid loss.', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },
  { name: 'Independently drink from an open cup', type: 'FEEDING_SWALLOWING', smartGoalPrompt: 'Student will drink from an open cup without spilling.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Transition from bottle to sippy cup', type: 'FEEDING_SWALLOWING', smartGoalPrompt: 'Student will accept liquids from a sippy cup instead of a bottle.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
];
