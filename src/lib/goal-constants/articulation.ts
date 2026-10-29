
import type { GoalTemplate, GoalType } from '../types';

export const ARTICULATION_FIELDS: Record<string, Record<string, any>> = {
  ARTICULATION: {
    correct: 0,
    incorrect: 0,
    approximate: 0,
    targetSound: '',
    wordList: '',
    Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0,
  },
};

type ArticulationTemplate = Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>;

// English consonants, written in IPA. Symbols that are not plain letters get the familiar spelling as a
// hint. Positions are left out where the sound does not occur in English words (/ŋ/ never starts a word).
const CONSONANTS: { ipa: string; hint?: string; positions: ('initial' | 'medial' | 'final')[] }[] = [
  { ipa: 'p', positions: ['initial', 'medial', 'final'] },
  { ipa: 'b', positions: ['initial', 'medial', 'final'] },
  { ipa: 't', positions: ['initial', 'medial', 'final'] },
  { ipa: 'd', positions: ['initial', 'medial', 'final'] },
  { ipa: 'k', positions: ['initial', 'medial', 'final'] },
  { ipa: 'g', positions: ['initial', 'medial', 'final'] },
  { ipa: 'f', positions: ['initial', 'medial', 'final'] },
  { ipa: 'v', positions: ['initial', 'medial', 'final'] },
  { ipa: 'θ', hint: 'voiceless "th"', positions: ['initial', 'medial', 'final'] },
  { ipa: 'ð', hint: 'voiced "th"', positions: ['initial', 'medial', 'final'] },
  { ipa: 's', positions: ['initial', 'medial', 'final'] },
  { ipa: 'z', positions: ['initial', 'medial', 'final'] },
  { ipa: 'ʃ', hint: '"sh"', positions: ['initial', 'medial', 'final'] },
  { ipa: 'ʒ', hint: '"zh" as in "measure"', positions: ['medial', 'final'] },
  { ipa: 'tʃ', hint: '"ch"', positions: ['initial', 'medial', 'final'] },
  { ipa: 'dʒ', hint: '"j"', positions: ['initial', 'medial', 'final'] },
  { ipa: 'm', positions: ['initial', 'medial', 'final'] },
  { ipa: 'n', positions: ['initial', 'medial', 'final'] },
  { ipa: 'ŋ', hint: '"ng"', positions: ['medial', 'final'] },
  { ipa: 'l', positions: ['initial', 'medial', 'final'] },
  { ipa: 'ɹ', hint: '"r"', positions: ['initial', 'medial', 'final'] },
  { ipa: 'w', positions: ['initial', 'medial'] },
  { ipa: 'j', hint: '"y"', positions: ['initial', 'medial'] },
  { ipa: 'h', positions: ['initial', 'medial'] },
];

const soundLabel = (ipa: string, hint?: string) => `/${ipa}/${hint ? ` (${hint})` : ''}`;

const CONSONANT_TEMPLATES: ArticulationTemplate[] = CONSONANTS.flatMap(({ ipa, hint, positions }) =>
  positions.map(position => ({
    name: `Produce ${soundLabel(ipa, hint)} in ${position} word position`,
    type: 'ARTICULATION' as GoalType,
    smartGoalPrompt: `Student will produce ${soundLabel(ipa, hint)} in the ${position} position of words.`,
    isDefault: true,
    sessionTargetValue: 80,
    generatedSmartGoal: '',
  })),
);

export const ARTICULATION_TEMPLATES: ArticulationTemplate[] = [
  // Consonants by word position
  ...CONSONANT_TEMPLATES,
  { name: 'Produce vocalic /ɝ/ and /ɚ/ ("er") in words', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce vocalic /ɝ/ and /ɚ/ ("er") in words.', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Produce /sp/ blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the /sp/ blend in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /st/ blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the /st/ blend in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /sk/ blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the /sk/ blend in the initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /pl/ blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the /pl/ blend in initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /bl/ blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the /bl/ blend in initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /gɹ/ ("gr") blend in initial word position', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce the /gɹ/ ("gr") blend in initial position of words.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce /v/ in conversational speech', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /v/ in conversational speech.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'Produce /tʃ/ ("ch") in sentences', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce /tʃ/ ("ch") in sentences.', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  // Syllable Shape Goals
  { name: 'Produce CV syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce Consonant-Vowel (CV) syllable structures in isolation or in single words.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'Produce VC syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce Vowel-Consonant (VC) syllable structures in isolation or in single words.', isDefault: true, sessionTargetValue: 90, generatedSmartGoal: '' },
  { name: 'Produce CVC syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce Consonant-Vowel-Consonant (CVC) words.', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },
  { name: 'Produce CVCV syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce reduplicated Consonant-Vowel-Consonant-Vowel (CVCV) syllable structures (e.g., "dada", "wawa").', isDefault: true, sessionTargetValue: 85, generatedSmartGoal: '' },
  { name: 'Produce VCV syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce Vowel-Consonant-Vowel (VCV) words (e.g., "apple", "away").', isDefault: true, sessionTargetValue: 80, generatedSmartGoal: '' },
  { name: 'Produce CCVC syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce initial Consonant-Consonant-Vowel-Consonant (CCVC) words (e.g., "stop", "plan").', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
  { name: 'Produce CVCC syllable structures', type: 'ARTICULATION', smartGoalPrompt: 'Student will produce final Consonant-Vowel-Consonant-Consonant (CVCC) words (e.g., "lamp", "desk").', isDefault: true, sessionTargetValue: 75, generatedSmartGoal: '' },
];

/**
 * Built-in articulation templates that were renamed to IPA. Each device keeps its own copy of the default
 * templates, so these are renamed there (and on goals already assigned with the old name) instead of
 * being added again under the new name.
 */
export const ARTICULATION_TEMPLATE_RENAMES: { from: string; fromPrompt: string; to: string }[] = [
  { from: 'Produce /r/ in initial word position', fromPrompt: 'Student will produce /r/ in the initial position of words.', to: 'Produce /ɹ/ ("r") in initial word position' },
  { from: 'Produce vocalic /r/ (-er) in words', fromPrompt: 'Student will produce vocalic /r/ (-er) in words.', to: 'Produce vocalic /ɝ/ and /ɚ/ ("er") in words' },
  { from: 'Produce "sp" blend in initial word position', fromPrompt: 'Student will produce the "sp" blend in the initial position of words.', to: 'Produce /sp/ blend in initial word position' },
  { from: 'Produce "st" blend in initial word position', fromPrompt: 'Student will produce the "st" blend in the initial position of words.', to: 'Produce /st/ blend in initial word position' },
  { from: 'Produce "sk" blend in initial word position', fromPrompt: 'Student will produce the "sk" blend in the initial position of words.', to: 'Produce /sk/ blend in initial word position' },
  { from: 'Produce "pl" blend in initial word position', fromPrompt: 'Student will produce the "pl" blend in initial position of words.', to: 'Produce /pl/ blend in initial word position' },
  { from: 'Produce "bl" blend in initial word position', fromPrompt: 'Student will produce the "bl" blend in initial position of words.', to: 'Produce /bl/ blend in initial word position' },
  { from: 'Produce "gr" blend in initial word position', fromPrompt: 'Student will produce the "gr" blend in initial position of words.', to: 'Produce /gɹ/ ("gr") blend in initial word position' },
  { from: 'Produce "ch" (tʃ) in sentences', fromPrompt: 'Student will produce "ch" (tʃ) in sentences.', to: 'Produce /tʃ/ ("ch") in sentences' },
];
