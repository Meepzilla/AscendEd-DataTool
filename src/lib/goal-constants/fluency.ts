
import type { GoalTemplate } from '../types';

export const FLUENCY_FIELDS: Record<string, Record<string, any>> = {
  FLUENCY_SYLLABLE_STUTTER: {
    totalSyllables: 0,
    stutteredSyllables: 0,
    blocks: 0,
    repetitions: 0,
    prolongations: 0,
    interjections: 0,
    secondaryBehaviors: '',
    observationNotes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const FLUENCY_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Reduce stuttering frequency in conversational speech', type: 'FLUENCY_SYLLABLE_STUTTER', smartGoalPrompt: 'Student will demonstrate increased fluency by stuttering on less than 5% of syllables during a 3-minute conversational speech sample.', isDefault: true, sessionTargetValue: 95, generatedSmartGoal: '' },
  { name: 'Use "Easy Onsets" to initiate speech', type: 'FLUENCY_SYLLABLE_STUTTER', smartGoalPrompt: 'Student will use the "easy onset" strategy to initiate speech at the beginning of sentences in 8 out of 10 opportunities.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Use "Light Articulatory Contacts" during reading', type: 'FLUENCY_SYLLABLE_STUTTER', smartGoalPrompt: 'Student will use light articulatory contacts when producing plosive sounds while reading a short passage.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Reduce use of interjections (e.g., "um", "uh")', type: 'FLUENCY_SYLLABLE_STUTTER', smartGoalPrompt: 'Student will reduce the use of interjections to fewer than 3 instances during a 2-minute speech sample.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'Reduce secondary behaviors during moments of disfluency', type: 'FLUENCY_SYLLABLE_STUTTER', smartGoalPrompt: 'Student will demonstrate a reduction in secondary behaviors (e.g., eye blinking, facial tension) during moments of stuttering across a session.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
];
