import type { GoalTemplate } from '../types';

// Communicative functions tallied by the COMMUNICATION_FUNCTIONS goal type. Each function has a
// spontaneous, emerging (unprompted alternative/emerging form), and prompted count, stored as
// `${key}Spontaneous` / `${key}Emerging` / `${key}Prompted`.
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
    ...Object.fromEntries(COMMUNICATION_FUNCTIONS.flatMap(f => [
      [`${f.key}Spontaneous`, 0],
      [`${f.key}Emerging`, 0],
      [`${f.key}Prompted`, 0],
    ])),
  },
};

/**
 * Totals for a COMMUNICATION_FUNCTIONS session. Progress is measured by `functionsUsedUnprompted`:
 * the number of different functions the student used without a prompt — either spontaneously in their
 * target form (`Spontaneous`) or in an emerging/alternative form such as a gesture, vocalization, or
 * approximation (`Emerging`). `functionsUsedEmergingOnly` counts functions used in an emerging form
 * without a spontaneous use in that session, so `functionsUsedSpontaneously + functionsUsedEmergingOnly`
 * always equals `functionsUsedUnprompted`.
 */
export function summarizeCommunicationFunctions(data: Record<string, any> = {}) {
  let spontaneous = 0;
  let emerging = 0;
  let prompted = 0;
  let functionsUsedSpontaneously = 0;
  let functionsUsedEmerging = 0;
  let functionsUsedEmergingOnly = 0;
  let functionsUsedUnprompted = 0;
  let functionsUsed = 0;
  for (const { key } of COMMUNICATION_FUNCTIONS) {
    const s = Math.max(0, Number(data[`${key}Spontaneous`]) || 0);
    const e = Math.max(0, Number(data[`${key}Emerging`]) || 0);
    const p = Math.max(0, Number(data[`${key}Prompted`]) || 0);
    spontaneous += s;
    emerging += e;
    prompted += p;
    if (s > 0) functionsUsedSpontaneously += 1;
    if (e > 0) functionsUsedEmerging += 1;
    if (s === 0 && e > 0) functionsUsedEmergingOnly += 1;
    if (s + e > 0) functionsUsedUnprompted += 1;
    if (s + e + p > 0) functionsUsed += 1;
  }
  const unprompted = spontaneous + emerging;
  const total = unprompted + prompted;
  return {
    spontaneous,
    emerging,
    prompted,
    unprompted,
    total,
    functionsUsedSpontaneously,
    functionsUsedEmerging,
    functionsUsedEmergingOnly,
    functionsUsedUnprompted,
    functionsUsed,
    functionCount: COMMUNICATION_FUNCTIONS.length,
  };
}

// sessionTargetValue for this type is a number of different functions, not a percentage.
export const COMMUNICATION_TEMPLATES: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>[] = [
  { name: 'Use a variety of communicative functions', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will spontaneously use at least 4 different communicative functions (e.g., requesting, commenting, protesting, greeting) during a session.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  { name: 'Expand communicative functions beyond requesting', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will spontaneously use at least 2 communicative functions other than requesting (e.g., commenting, greeting, answering questions) during a session.', isDefault: true, sessionTargetValue: 3, generatedSmartGoal: '' },
  { name: 'Use social communicative functions', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will spontaneously greet, gain attention, and comment with a communication partner during a structured or play-based activity.', isDefault: true, sessionTargetValue: 3, generatedSmartGoal: '' },
  { name: 'Comment and share attention during play', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will spontaneously gain a partner\'s attention and comment on an object or event during a shared play activity.', isDefault: true, sessionTargetValue: 2, generatedSmartGoal: '' },
  { name: 'Ask and answer questions in conversation', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will spontaneously both ask and answer questions during a conversational exchange with an adult or peer.', isDefault: true, sessionTargetValue: 2, generatedSmartGoal: '' },
  { name: 'Express feelings and protest appropriately', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will spontaneously express a feeling and protest or reject in an appropriate way (e.g., "I don\'t like that," "no thank you") during daily routines.', isDefault: true, sessionTargetValue: 2, generatedSmartGoal: '' },
  { name: 'Use communicative functions with peers', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will spontaneously use at least 3 different communicative functions (e.g., greeting, requesting, directing others) with peers during a structured group activity.', isDefault: true, sessionTargetValue: 3, generatedSmartGoal: '' },
  { name: 'AAC: Use device for a variety of communicative functions', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will use their AAC system to spontaneously communicate for at least 4 different functions (e.g., requesting, protesting, commenting, greeting) during a session.', isDefault: true, sessionTargetValue: 4, generatedSmartGoal: '' },
  // Previously a qualitative observation (rated 1-5); see DEFAULT_TEMPLATE_UPDATES.
  { name: 'GLP: Use language for a variety of communicative functions', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'Student will use language (including gestalts) for at least 3 different communicative functions (e.g., commenting, requesting, protesting) during play-based activities.', isDefault: true, sessionTargetValue: 3, generatedSmartGoal: '' },
];
