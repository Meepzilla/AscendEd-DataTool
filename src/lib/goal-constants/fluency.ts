import type { GoalTemplate } from '../types';

export const FLUENCY_FIELDS: Record<string, Record<string, any>> = {
  FLUENCY_SYLLABLE_STUTTER: {
    totalSyllables: 0,
    stutteredSyllables: 0,
    observationNotes: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

export const FLUENCY_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  // This can be expanded with more fluency-related goals later.
];
