import type { GoalTemplate } from '../types';

export const PHONOLOGICAL_FIELDS: Record<string, Record<string, any>> = {
  PHONOLOGICAL_PROCESSES: {
    targetProcess: '',
    correctProductions: 0,
    incorrectProductions: 0,
    approximate: 0,
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const PHONOLOGICAL_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Eliminate Final Consonant Deletion in CVC words', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will eliminate final consonant deletion in CVC words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Reduce Fronting of /k, g/', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce fronting of /k, g/ sounds.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce Stopping of Fricatives (/s/, /f/)', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce stopping of /s/ and /f/ sounds.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Eliminate Cluster Reduction for s-blends', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will eliminate cluster reduction for initial s-blends.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Eliminate Cluster Reduction for l-blends', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will eliminate cluster reduction for initial l-blends.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Reduce Gliding of /l/ to /w/', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce gliding of the /l/ sound.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce Gliding of /r/ to /w/', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce gliding of the /r/ sound.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce Deaffrication of "ch" to "sh"', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce deaffrication, correctly producing "ch".', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Reduce Weak Syllable Deletion in 3-syllable words', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce weak syllable deletion in 3-syllable words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Reduce Prevocalic Voicing', type: 'PHONOLOGICAL_PROCESSES', smartGoalPrompt: 'Student will reduce prevocalic voicing (e.g., saying "den" for "ten").', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
];
