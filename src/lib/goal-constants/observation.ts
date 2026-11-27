import type { GoalTemplate } from '../types';

export { OBSERVATION_FIELDS } from './fields';

export const OBSERVATION_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Protest or reject an undesired item or activity', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will use a functional way to protest or reject.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Request for assistance', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will independently request assistance when needed.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Gain attention of a communication partner', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will use a method to gain attention before communicating.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  // Functional Script & Phrase Flexibility Goals
  { name: 'Expand repertoire of functional scripts and phrases', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will demonstrate use of new functional scripts or phrases during play-based activities.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Modify familiar scripts or phrases into flexible combinations', type: 'QUALITATIVE_OBSERVATION', smartGoalPrompt: 'Student will modify familiar scripts or phrases by substituting or recombining words into flexible utterances.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
];
