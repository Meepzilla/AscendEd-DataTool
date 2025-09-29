import type { GoalTemplate } from '../types';

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

export const OBSERVATION_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Protest or reject an undesired item or activity', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will use a functional way to protest or reject.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Request for assistance', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will independently request assistance when needed.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Gain attention of a communication partner', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will use a method to gain attention before communicating.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  // Gestalt Language Processing (GLP) Goals
  { name: 'GLP: Increase inventory of mitigable gestalts', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will demonstrate use of new, mitigable gestalts during play-based activities.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'GLP: Mitigate gestalts into smaller units', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will begin to break down longer gestalts into smaller, more flexible units.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'GLP: Use language for a variety of communicative functions', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will use language for at least 3 different communicative functions (e.g., commenting, requesting, protesting).', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
];
