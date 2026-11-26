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

/**
 * A communicative function offered in Data Entry. The list can be edited in Settings → Communication Functions
 * (comm-functions.ts): functions can be added, reordered and hidden. Hidden ones stay in the list so past sessions
 * keep their names; data is stored by `key`, which never changes.
 */
export interface CommFunction { key: string; label: string; hidden?: boolean }

export const DEFAULT_COMM_FUNCTIONS: CommFunction[] = COMMUNICATION_FUNCTIONS.map(f => ({ key: f.key, label: f.label }));

// The saved list is read through a loader that comm-functions.ts registers (it reads the device's storage, which
// this module can't import without a cycle). Until then, and when it fails, the defaults apply.
let commFunctionLoader: (() => CommFunction[]) | null = null;
export function registerCommFunctionLoader(loader: () => CommFunction[]) { commFunctionLoader = loader; }

/** Every function in the saved list (hidden ones included), or the defaults. */
export function allCommFunctions(): CommFunction[] {
  try {
    const list = commFunctionLoader?.();
    return list && list.length ? list : DEFAULT_COMM_FUNCTIONS;
  } catch {
    return DEFAULT_COMM_FUNCTIONS;
  }
}

/** The functions offered in Data Entry, in order. */
export function activeCommFunctions(): CommFunction[] {
  const active = allCommFunctions().filter(f => !f.hidden);
  return active.length ? active : DEFAULT_COMM_FUNCTIONS;
}

const TALLY_SUFFIXES = ['Spontaneous', 'Emerging', 'Prompted'] as const;
/** A function key as the list stores it: a letter, then letters, digits or "_" (never "__proto__" and the like). */
const SAFE_FUNCTION_KEY = /^[A-Za-z][A-Za-z0-9_]{0,59}$/;

/**
 * Keys the plain-key pattern alone would admit that must never be used as data keys: writing or
 * merging under any of these can shadow or mutate Object.prototype behaviour. `__proto__` already
 * fails the pattern (leading underscore); `constructor` and `prototype` are plain letter keys, so
 * they are denied here, in the one guard every reader goes through (review finding D1).
 */
const UNSAFE_FUNCTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Whether a key is safe to use as a function key (and in field names made from it). */
export function isSafeCommFunctionKey(key: string): boolean {
  return SAFE_FUNCTION_KEY.test(key) && !UNSAFE_FUNCTION_KEYS.has(key);
}

/**
 * The function keys a session's data has tallies for (any function ever recorded, listed or not). Data comes from
 * storage, backups and imports, so only fields of the form "<key><Spontaneous|Emerging|Prompted>" with a key that
 * passes isSafeCommFunctionKey count; anything else is ignored.
 */
export function commFunctionKeysIn(data: Record<string, any> = {}): string[] {
  const keys = new Set<string>();
  for (const field of Object.keys(data)) {
    if (field.length > 80) continue;
    const suffix = TALLY_SUFFIXES.find(sfx => field.endsWith(sfx));
    if (!suffix) continue;
    const key = field.slice(0, field.length - suffix.length);
    if (!isSafeCommFunctionKey(key) || !(Number(data[field]) > 0)) continue;
    keys.add(key);
  }
  return [...keys];
}

/** A function's name: from the saved list (hidden ones too), the defaults, or its key spelled out. */
export function commFunctionLabel(key: string): string {
  const found = allCommFunctions().find(f => f.key === key) ?? DEFAULT_COMM_FUNCTIONS.find(f => f.key === key);
  if (found) return found.label;
  return key.replace(/^c_/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

/** The functions to show for some sessions' data: the active list, then any other function those sessions used. */
export function commFunctionsFor(datas: Record<string, any>[]): CommFunction[] {
  const active = activeCommFunctions();
  const shown = new Set(active.map(f => f.key));
  const extra: CommFunction[] = [];
  for (const d of datas) {
    for (const key of commFunctionKeysIn(d)) {
      if (shown.has(key)) continue;
      shown.add(key);
      extra.push({ key, label: commFunctionLabel(key), hidden: true });
    }
  }
  return [...active, ...extra];
}

/** One function's uses in one session. */
export interface CommFunctionUses { spontaneous: number; emerging: number; prompted: number }

/** A function used in at least one of the sessions, with its uses in each session (in the order given). */
export interface CommFunctionBySession extends CommFunction {
  sessions: CommFunctionUses[];
  /** Uses across all the sessions. */
  total: CommFunctionUses;
}

/**
 * Which functions were used in each session, for the "Functions by session" table on Reports: one row per function
 * used in any of the sessions (the active list's order, then others those sessions used), with its spontaneous,
 * emerging and prompted uses per session. Functions no session used are left out.
 */
export function commFunctionsBySession(datas: Record<string, any>[]): CommFunctionBySession[] {
  const count = (d: Record<string, any>, field: string) => Math.max(0, Number(d[field]) || 0);
  return commFunctionsFor(datas)
    .map(f => {
      const sessions = datas.map(d => ({
        spontaneous: count(d, `${f.key}Spontaneous`),
        emerging: count(d, `${f.key}Emerging`),
        prompted: count(d, `${f.key}Prompted`),
      }));
      const total = sessions.reduce(
        (t, s) => ({ spontaneous: t.spontaneous + s.spontaneous, emerging: t.emerging + s.emerging, prompted: t.prompted + s.prompted }),
        { spontaneous: 0, emerging: 0, prompted: 0 },
      );
      return { ...f, sessions, total };
    })
    .filter(f => f.total.spontaneous + f.total.emerging + f.total.prompted > 0);
}

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
  // Every function with tallies in this session (including ones added in Settings, or since hidden), plus the defaults.
  const keys = new Set<string>([...COMMUNICATION_FUNCTIONS.map(f => f.key), ...commFunctionKeysIn(data)]);
  for (const key of keys) {
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
    functionCount: activeCommFunctions().length,
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
