import type { GoalTemplate } from '../types';

export { PHONOLOGICAL_FIELDS } from './fields';

export const PHONOLOGICAL_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Eliminate final consonant deletion in CVC words', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will eliminate final consonant deletion in CVC words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Reduce fronting of /k/ and /g/', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce fronting of /k, g/ sounds.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce stopping of fricatives (/s/, /f/)', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce stopping of /s/ and /f/ sounds.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Eliminate cluster reduction in s-blends', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will eliminate cluster reduction for initial s-blends.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Eliminate cluster reduction in l-blends', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will eliminate cluster reduction for initial l-blends.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Reduce gliding of /l/ to /w/', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce gliding of the /l/ sound.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce gliding of /r/ to /w/', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce gliding of the /r/ sound.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce deaffrication of /tʃ/ ("ch") to /ʃ/ ("sh")', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce deaffrication, correctly producing "ch".', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce weak syllable deletion in 3-syllable words', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce weak syllable deletion in 3-syllable words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Reduce prevocalic voicing', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce prevocalic voicing (e.g., saying "den" for "ten").', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
];
