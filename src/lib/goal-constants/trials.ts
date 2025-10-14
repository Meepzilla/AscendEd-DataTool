import type { GoalTemplate } from '../types';

export const TRIALS_FIELDS: Record<string, Record<string, any>> = {
  FEEDING_SWALLOWING: {
    foodOrLiquidName: '',
    textureOrConsistency: '',
    trialsAccepted: 0,
    trialsRefused: 0,
    notes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  SEQUENCED_TRIALS: {
    numberOfTrials: 5,
    trials: Array(5).fill('untouched'),
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
  DISCRETE_TRIALS: {
    numberOfTrials: 5,
    trials: Array(5).fill('untouched'),
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const TRIALS_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Discrete Trial Training - Tacting', type: 'DISCRETE_TRIALS', smartGoalPrompt: 'Student will correctly tact 10 objects from a field of 3.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: ''},
  { name: 'Discrete Trials - 5 Trials', type: 'DISCRETE_TRIALS', smartGoalPrompt: 'Student will complete 5 discrete trials for a targeted skill.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
];
