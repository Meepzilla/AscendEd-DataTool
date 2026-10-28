import type { GoalTemplate } from '../types';

// Communicative functions tallied by the COMMUNICATION_FUNCTIONS goal type. Each function has a
// spontaneous and a prompted count, stored as `${key}Spontaneous` / `${key}Prompted`.
export const COMMUNICATION_FUNCTIONS = [
  { key: 'requestingItems', label: 'Requesting items/actions' },
  { key: 'requestingHelp', label: 'Requesting help' },
  { key: 'protesting', label: 'Protesting/Rejecting' },
  { key: 'commenting', label: 'Commenting' },
  { key: 'greeting', label: 'Greeting/Farewell' },
  { key: 'gainingAttention', label: 'Gaining attention' },
  { key: 'answering', label: 'Answering questions' },
  { key: 'askingQuestions', label: 'Asking questions' },
  { key: 'expressingFeelings', label: 'Expressing feelings' },
  { key: 'directingOthers', label: 'Directing others' },
] as const;

export const COMMUNICATION_FIELDS: Record<string, Record<string, any>> = {
  COMMUNICATION_FUNCTIONS: {
    notes: '',
    ...Object.fromEntries(COMMUNICATION_FUNCTIONS.flatMap(f => [[`${f.key}Spontaneous`, 0], [`${f.key}Prompted`, 0]])),
  },
};

/**
 * Totals for a COMMUNICATION_FUNCTIONS session. Progress is measured by `functionsUsedSpontaneously`:
 * the number of different functions the student used at least once without a prompt.
 */
export function summarizeCommunicationFunctions(data: Record<string, any> = {}) {
  let spontaneous = 0;
  let prompted = 0;
  let functionsUsedSpontaneously = 0;
  let functionsUsed = 0;
  for (const { key } of COMMUNICATION_FUNCTIONS) {
    const s = Number(data[`${key}Spontaneous`]) || 0;
    const p = Number(data[`${key}Prompted`]) || 0;
    spontaneous += s;
    prompted += p;
    if (s > 0) functionsUsedSpontaneously += 1;
    if (s + p > 0) functionsUsed += 1;
  }
  return { spontaneous, prompted, functionsUsedSpontaneously, functionsUsed, functionCount: COMMUNICATION_FUNCTIONS.length };
}

// sessionTargetValue for this type is a number of different functions, not a percentage.
export const COMMUNICATION_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Use a variety of communicative functions', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will spontaneously use at least 4 different communicative functions (e.g., requesting, commenting, protesting, greeting) during a session.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Expand communicative functions beyond requesting', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will spontaneously use at least 2 communicative functions other than requesting (e.g., commenting, greeting, answering questions) during a session.', isDefault: true, sessionTargetValue: 3, generatedSmartGoal: '' },
  { name: 'Use social communicative functions', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will spontaneously greet, gain attention, and comment with a communication partner during a structured or play-based activity.', isDefault: true, sessionTargetValue: 3, generatedSmartGoal: '' },
];
