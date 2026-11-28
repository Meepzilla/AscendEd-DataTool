import type { GoalTemplate, GoalType, TargetDirection } from '../types';

// Behavior data goal types:
// - BEHAVIOR_FREQUENCY: tally of occurrences, with an optional rate per hour from the observation time.
// - BEHAVIOR_DURATION: timed episodes (start/stop timer or entered by hand).
// - BEHAVIOR_ABC: incidents recorded as Antecedent -> Behavior -> Consequence, with one or more of each. An
//   incident's behavior can be the replacement skill, so replacement goals can measure the % of incidents where
//   it was used.
// - BEHAVIOR_INTERVAL: the observation is split into equal intervals, each marked + (behavior seen) or −;
//   measured as the % of scored intervals with the behavior.
// - BEHAVIOR_LATENCY: seconds from a cue (instruction, direction) to the start of the response.

/**
 * Communication goals measured with the same tools as behavior goals, without the behavior wording: a count of
 * times a skill was used, timed minutes, seconds to respond, and opportunities scored on the trial grid. Each
 * records exactly what its tool records (the same session fields), so charts, reports and merging treat a
 * goal by its tool (toolTypeOf), and only the words and the default direction differ.
 */
export const COMMUNICATION_MEASURE_TOOLS: Partial<Record<GoalType, GoalType>> = {
  COMMUNICATION_COUNT: 'BEHAVIOR_FREQUENCY',
  COMMUNICATION_DURATION: 'BEHAVIOR_DURATION',
  RESPONSE_TIME: 'BEHAVIOR_LATENCY',
  COMMUNICATION_OPPORTUNITIES: 'DISCRETE_TRIALS',
};
export const COMMUNICATION_MEASURE_TYPES = Object.keys(COMMUNICATION_MEASURE_TOOLS) as GoalType[];

/** The goal type whose tool records and measures this type: itself, except for the communication measure types. */
export function toolTypeOf(type: string): GoalType {
  return (COMMUNICATION_MEASURE_TOOLS[type as GoalType] ?? type) as GoalType;
}

/** Whether the type is a communication goal measured with a behavior tool (count, minutes or seconds). */
export const isCommunicationTimedType = (type: string) => type in COMMUNICATION_MEASURE_TOOLS && toolTypeOf(type) !== 'DISCRETE_TRIALS';

/** Whether a goal of this type can aim to increase or decrease (so its editor offers the choice). */
export const hasTargetDirection = (type: string) => type === 'CUSTOM' || type.startsWith('BEHAVIOR_') || isCommunicationTimedType(type);

export const BEHAVIOR_GOAL_TYPES: GoalType[] = ['BEHAVIOR_FREQUENCY', 'BEHAVIOR_DURATION', 'BEHAVIOR_ABC', 'BEHAVIOR_INTERVAL', 'BEHAVIOR_LATENCY'];

export const ABC_ANTECEDENTS = [
  'Demand or task given',
  'Transition',
  'Told "no" / denied access',
  'Attention diverted',
  'Unstructured time',
  'Peer interaction',
  'Noise or sensory input',
  'Change in routine',
  'Other',
] as const;

/** The first behavior is the replacement skill; the rest are problem behaviors. */
export const ABC_REPLACEMENT_BEHAVIOR = 'Used replacement skill';
export const ABC_BEHAVIORS = [
  ABC_REPLACEMENT_BEHAVIOR,
  'Aggression',
  'Self-injury',
  'Elopement',
  'Property destruction',
  'Verbal outburst',
  'Refusal / noncompliance',
  'Off-task',
  'Other',
] as const;

export const BEHAVIOR_FUNCTIONS = ['Escape', 'Attention', 'Tangible', 'Sensory'] as const;
export type BehaviorFunction = typeof BEHAVIOR_FUNCTIONS[number];

/** Consequences, each with the behavior function it most often suggests. */
export const ABC_CONSEQUENCES: readonly { label: string; fn: BehaviorFunction | null }[] = [
  { label: 'Demand removed / escaped', fn: 'Escape' },
  { label: 'Break given', fn: 'Escape' },
  { label: 'Adult attention', fn: 'Attention' },
  { label: 'Peer attention', fn: 'Attention' },
  { label: 'Redirected', fn: 'Attention' },
  { label: 'Item or activity given', fn: 'Tangible' },
  { label: 'Sensory input', fn: 'Sensory' },
  { label: 'Planned ignoring', fn: null },
  { label: 'Other', fn: null },
];

export interface AbcIncident {
  time: string; // ISO timestamp
  /** The choices as one line ("Transition, Peer interaction"), for display and older versions of the app. */
  antecedent: string;
  behavior: string;
  consequence: string;
  /** Each choice, when more than one can be selected (incidents recorded before that have only the line above). */
  antecedents?: string[];
  behaviors?: string[];
  consequences?: string[];
  /** The consequence's function when the incident was recorded (the consequence list can be edited). */
  fn?: BehaviorFunction | null;
  /** The functions of all the consequences selected, without repeats. */
  fns?: BehaviorFunction[];
  note?: string;
}

/** Joins an incident's choices into the one-line form stored in `antecedent`, `behavior` and `consequence`. */
export const joinAbcChoices = (choices: readonly string[]) => choices.join(', ');

const listOrSingle = (list: unknown, single: string | undefined): string[] =>
  Array.isArray(list) ? list.filter((v): v is string => typeof v === 'string' && v !== '') : single ? [single] : [];

/** An incident's antecedents, behaviors and consequences, whether recorded as lists or (earlier) as one each. */
export function incidentChoices(incident: AbcIncident) {
  return {
    antecedents: listOrSingle(incident.antecedents, incident.antecedent),
    behaviors: listOrSingle(incident.behaviors, incident.behavior),
    consequences: listOrSingle(incident.consequences, incident.consequence),
  };
}

/** Whether the student used the replacement skill (it isn't recorded with problem behaviors). */
export const isReplacementIncident = (incident: AbcIncident) =>
  incidentChoices(incident).behaviors.includes(ABC_REPLACEMENT_BEHAVIOR);

export const INTERVAL_METHODS = [
  { value: 'partial', label: 'Partial interval', hint: 'Mark + if the behavior happened at any time during the interval.' },
  { value: 'whole', label: 'Whole interval', hint: 'Mark + only if the behavior lasted the whole interval.' },
  { value: 'momentary', label: 'Momentary time sampling', hint: 'Look when each interval ends: mark + if the behavior is happening at that moment.' },
] as const;
export type IntervalMethod = typeof INTERVAL_METHODS[number]['value'];
export const INTERVAL_LENGTHS_SECONDS = [10, 15, 20, 30, 60, 120, 300];

export interface IntervalSetup {
  method: IntervalMethod;
  intervalSeconds: number;
  intervalCount: number;
}
export const DEFAULT_INTERVAL_SETUP: IntervalSetup = { method: 'partial', intervalSeconds: 60, intervalCount: 10 };
export const MAX_INTERVALS = 120;

// Times are ISO timestamps recorded as data is entered, for time-of-day and within-session reports (see
// behavior-timing.ts); null where the time isn't known (entered by hand).
export const BEHAVIOR_FIELDS: Record<string, Record<string, any>> = {
  // occurrenceTimes: when each counted occurrence was recorded.
  BEHAVIOR_FREQUENCY: { count: 0, occurrenceTimes: [], observationMinutes: '', notes: '' },
  // episodeSeconds: length of each episode, episodeStarts: when each began; runningSince: epoch ms while the timer
  // runs (so it keeps time while the device is locked or the app is in the background).
  BEHAVIOR_DURATION: { episodeSeconds: [], episodeStarts: [], runningSince: null, observationMinutes: '', totalSeconds: 0, episodeCount: 0, notes: '' },
  BEHAVIOR_ABC: { incidents: [], incidentCount: 0, notes: '' },
  // An empty setup field means "not chosen yet": the goal's last setup on this device, else the default.
  // intervals: true (+), false (−) or null (not scored), one per interval; timerStartedAt: epoch ms while the
  // timer runs; startedAt: when the first interval began (kept after saving).
  BEHAVIOR_INTERVAL: { method: '', intervalSeconds: '', intervalCount: '', intervals: [], timerStartedAt: null, startedAt: null, scoredCount: 0, percentIntervals: null, notes: '' },
  // latencies: seconds per trial, null when there was no response; trialTimes: when each cue was given;
  // cueGivenAt: epoch ms while timing a trial.
  BEHAVIOR_LATENCY: { latencies: [], trialTimes: [], cueGivenAt: null, averageSeconds: null, trialCount: 0, notes: '' },
  // The communication measure types store the same fields as their tools.
  COMMUNICATION_COUNT: { count: 0, occurrenceTimes: [], observationMinutes: '', notes: '' },
  COMMUNICATION_DURATION: { episodeSeconds: [], episodeStarts: [], runningSince: null, observationMinutes: '', totalSeconds: 0, episodeCount: 0, notes: '' },
  // Opportunities are scored on the trial grid, like discrete trials, with the prompt level counters.
  COMMUNICATION_OPPORTUNITIES: { numberOfTrials: 5, trials: Array(5).fill('untouched'), Independent: 0, Visual: 0, Verbal: 0, Gestural: 0, PartialPhysical: 0, Imitation: 0 },
  RESPONSE_TIME: { latencies: [], trialTimes: [], cueGivenAt: null, averageSeconds: null, trialCount: 0, notes: '' },
};

/** A list of recorded times padded (with null, "time unknown") or cut to match its values. */
export function alignTimes(times: unknown, length: number): (string | null)[] {
  const list: (string | null)[] = Array.isArray(times) ? times.slice(0, length) : [];
  while (list.length < length) list.push(null);
  return list;
}

/**
 * The type a goal's data is entered and measured as: its data capture type when one is set (a goal can be
 * entered with another type's inputs), otherwise its own type.
 */
export function captureTypeOf(goal: { type: string; dataCaptureType?: string }): GoalType {
  return (goal.dataCaptureType || goal.type) as GoalType;
}

/** Behavior goals usually aim to reduce something; other goal types aim to increase. */
export function goalDirection(goal: { type: string; dataCaptureType?: string; targetDirection?: TargetDirection; customType?: { direction?: TargetDirection } }): TargetDirection {
  const type = captureTypeOf(goal);
  // A chosen direction counts only where the method offers one: one left over from an earlier method (a behavior
  // goal switched to Discrete Trials) would otherwise turn "at least 80%" into "at most 80%".
  if (goal.targetDirection && hasTargetDirection(type)) return goal.targetDirection;
  if (type === 'CUSTOM' && goal.customType?.direction) return goal.customType.direction;
  // A quicker response is the aim; other communication measures (times used, minutes) aim up.
  if (type === 'RESPONSE_TIME') return 'decrease';
  return BEHAVIOR_GOAL_TYPES.includes(type) ? 'decrease' : 'increase';
}

export function summarizeFrequency(data: Record<string, any> = {}) {
  const count = Number(data.count) || 0;
  const minutes = Number(data.observationMinutes) || 0;
  return { count, minutes, ratePerHour: minutes > 0 ? (count / minutes) * 60 : null };
}

export function summarizeDuration(data: Record<string, any> = {}, now = Date.now()) {
  // An episode that isn't a number (damaged data) is left out, so it can't turn the whole summary into NaN.
  const episodes: number[] = Array.isArray(data.episodeSeconds) ? data.episodeSeconds.map(Number).filter(Number.isFinite) : [];
  const runningSeconds = data.runningSince ? Math.max(0, Math.round((now - Number(data.runningSince)) / 1000)) : 0;
  const totalSeconds = episodes.reduce((sum, s) => sum + s, 0) + runningSeconds;
  const minutes = Number(data.observationMinutes) || 0;
  return {
    episodes,
    running: !!data.runningSince,
    runningSeconds,
    totalSeconds,
    totalMinutes: totalSeconds / 60,
    episodeCount: episodes.length + (data.runningSince ? 1 : 0),
    longestSeconds: Math.max(0, runningSeconds, ...episodes),
    percentOfObservation: minutes > 0 ? Math.min(100, (totalSeconds / (minutes * 60)) * 100) : null,
  };
}

export function summarizeAbc(data: Record<string, any> = {}) {
  const incidents: AbcIncident[] = Array.isArray(data.incidents) ? data.incidents : [];
  const replacementCount = incidents.filter(isReplacementIncident).length;
  const problemCount = incidents.length - replacementCount;
  const tally = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((acc, v) => {
    if (v) acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  // Each choice is counted, so an incident with two antecedents adds one to each.
  const problemIncidents = incidents.filter(i => !isReplacementIncident(i));
  return {
    incidents,
    incidentCount: incidents.length,
    problemCount,
    replacementCount,
    replacementPercent: incidents.length > 0 ? (replacementCount / incidents.length) * 100 : null,
    antecedents: tally(problemIncidents.flatMap(i => incidentChoices(i).antecedents)),
    behaviors: tally(problemIncidents.flatMap(i => incidentChoices(i).behaviors)),
    functions: tally(problemIncidents.flatMap(incidentFunctions)),
  };
}

/** The entries of a tally (most first) that share the highest count: every choice tied for most common. */
export function topTied(tally: [string, number][]): [string, number][] {
  return tally.filter(([, n]) => n === tally[0]?.[1]);
}

/** "a", "a and b", "a, b and c" */
export function joinWithAnd(items: string[]): string {
  return items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The functions an incident suggests, without repeats: those stored with it, or for older incidents the one
 * stored with its single consequence, or the default list's.
 */
export function incidentFunctions(incident: AbcIncident): BehaviorFunction[] {
  if (Array.isArray(incident.fns)) return incident.fns;
  if (incident.fn !== undefined) return incident.fn ? [incident.fn] : [];
  const fn = ABC_CONSEQUENCES.find(c => c.label === incident.consequence)?.fn;
  return fn ? [fn] : [];
}

/** The interval setup in use: the session's own choices, else `fallback` (the goal's last setup), else the default. */
export function intervalSetup(data: Record<string, any> = {}, fallback: Partial<IntervalSetup> = {}): IntervalSetup {
  const method = INTERVAL_METHODS.some(m => m.value === data.method) ? data.method
    : INTERVAL_METHODS.some(m => m.value === fallback.method) ? fallback.method! : DEFAULT_INTERVAL_SETUP.method;
  const positive = (...values: unknown[]) => values.map(Number).find(v => Number.isFinite(v) && v > 0);
  return {
    method,
    intervalSeconds: positive(data.intervalSeconds, fallback.intervalSeconds) ?? DEFAULT_INTERVAL_SETUP.intervalSeconds,
    intervalCount: Math.min(MAX_INTERVALS, Math.round(positive(data.intervalCount, fallback.intervalCount) ?? DEFAULT_INTERVAL_SETUP.intervalCount)),
  };
}

export function summarizeIntervals(data: Record<string, any> = {}, now = Date.now(), fallback: Partial<IntervalSetup> = {}) {
  const setup = intervalSetup(data, fallback);
  const intervals: (boolean | null)[] = (Array.isArray(data.intervals) ? data.intervals : [])
    .slice(0, setup.intervalCount)
    .map((v: unknown) => (v === true || v === false ? v : null));
  const occurred = intervals.filter(v => v === true).length;
  const scored = intervals.filter(v => v !== null).length;
  const elapsedSeconds = data.timerStartedAt ? Math.max(0, (now - Number(data.timerStartedAt)) / 1000) : null;
  const running = elapsedSeconds !== null && elapsedSeconds < setup.intervalSeconds * setup.intervalCount;
  return {
    ...setup,
    intervals,
    occurred,
    scored,
    percent: scored > 0 ? (occurred / scored) * 100 : null,
    timerStarted: elapsedSeconds !== null,
    running,
    /** Index of the interval the timer is in, while it runs. */
    currentInterval: running ? Math.floor(elapsedSeconds! / setup.intervalSeconds) : null,
    secondsLeftInInterval: running ? Math.ceil(setup.intervalSeconds - (elapsedSeconds! % setup.intervalSeconds)) : null,
  };
}

const roundTenth = (n: number) => Math.round(n * 10) / 10;

/** The middle value (the average of the two middle values for an even count), or null for none. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarizeLatency(data: Record<string, any> = {}, now = Date.now()) {
  const latencies: (number | null)[] = (Array.isArray(data.latencies) ? data.latencies : [])
    .map((v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v)))
    .map((v: number | null) => (v === null || !Number.isFinite(v) ? null : v));
  const responded = latencies.filter((v): v is number => v !== null).sort((a, b) => a - b);
  return {
    latencies,
    trialCount: latencies.length,
    respondedCount: responded.length,
    noResponseCount: latencies.length - responded.length,
    averageSeconds: responded.length ? responded.reduce((sum, v) => sum + v, 0) / responded.length : null,
    medianSeconds: median(responded),
    shortestSeconds: responded.length ? responded[0] : null,
    longestSeconds: responded.length ? responded[responded.length - 1] : null,
    timing: !!data.cueGivenAt,
    timingSeconds: data.cueGivenAt ? Math.max(0, (now - Number(data.cueGivenAt)) / 1000) : 0,
  };
}

/**
 * The value a behavior goal is measured by: occurrences (frequency), total minutes (duration), % of intervals
 * with the behavior (interval), average seconds to respond (latency), and for ABC either problem-behavior
 * incidents (decrease goals) or % of incidents with the replacement skill (increase).
 */
export function behaviorMeasure(rawType: string, data: Record<string, any>, direction: TargetDirection): number | null {
  const type = toolTypeOf(rawType);
  if (type === 'BEHAVIOR_FREQUENCY') return summarizeFrequency(data).count;
  if (type === 'BEHAVIOR_DURATION') return summarizeDuration(data).totalMinutes;
  if (type === 'BEHAVIOR_ABC') {
    const abc = summarizeAbc(data);
    return direction === 'decrease' ? abc.problemCount : abc.replacementPercent;
  }
  if (type === 'BEHAVIOR_INTERVAL') return summarizeIntervals(data).percent;
  if (type === 'BEHAVIOR_LATENCY') return summarizeLatency(data).averageSeconds;
  return null;
}

/** Progress toward a target (0-100). Decrease goals are fully met at or below the target. */
export function progressTowardTarget(value: number, target: number, direction: TargetDirection): number {
  if (direction === 'decrease') {
    if (value <= target) return 100;
    return target > 0 ? Math.max(0, Math.min(100, (target / value) * 100)) : 0;
  }
  return target > 0 ? Math.max(0, Math.min(100, (value / target) * 100)) : 0;
}

/** Called when a session is saved: stops running timers and stores summary totals. */
export function finalizeBehaviorData(rawType: string, data: Record<string, any>, now = Date.now()): Record<string, any> {
  const type = toolTypeOf(rawType);
  if (type === 'BEHAVIOR_DURATION' || (type === 'CUSTOM' && (Array.isArray(data.episodeSeconds) || data.runningSince))) {
    const episodes: number[] = Array.isArray(data.episodeSeconds) ? [...data.episodeSeconds] : [];
    const starts = alignTimes(data.episodeStarts, episodes.length);
    const since = Number(data.runningSince);
    if (data.runningSince && Number.isFinite(since) && since > 0) {
      episodes.push(Math.max(0, Math.round((now - since) / 1000)));
      starts.push(new Date(since).toISOString());
    }
    const summary = summarizeDuration({ ...data, episodeSeconds: episodes, runningSince: null });
    return { ...data, episodeSeconds: episodes, episodeStarts: starts, runningSince: null, totalSeconds: summary.totalSeconds, episodeCount: summary.episodeCount };
  }
  if (type === 'BEHAVIOR_ABC') {
    return { ...data, incidentCount: Array.isArray(data.incidents) ? data.incidents.length : 0 };
  }
  if (type === 'BEHAVIOR_INTERVAL') {
    // Stores the setup actually used, so the session reads the same if the defaults change.
    const summary = summarizeIntervals(data, now);
    return {
      ...data,
      method: summary.method,
      intervalSeconds: summary.intervalSeconds,
      intervalCount: summary.intervalCount,
      intervals: summary.intervals,
      timerStartedAt: null,
      scoredCount: summary.scored,
      percentIntervals: summary.percent === null ? null : roundTenth(summary.percent),
    };
  }
  if (type === 'BEHAVIOR_LATENCY') {
    // A trial still being timed has no response yet, so it is left out.
    const summary = summarizeLatency({ ...data, cueGivenAt: null });
    return {
      ...data,
      cueGivenAt: null,
      latencies: summary.latencies,
      trialCount: summary.trialCount,
      averageSeconds: summary.averageSeconds === null ? null : roundTenth(summary.averageSeconds),
    };
  }
  return data;
}

/** Seconds with one decimal under a minute ("4.2 s"), otherwise m:ss. */
export function formatLatency(seconds: number): string {
  return seconds < 60 ? `${roundTenth(seconds).toFixed(1)} s` : formatSeconds(seconds);
}

export function formatSeconds(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mmss = `${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
  return h ? `${h}:${mmss}` : mmss;
}

type Template = Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>;
const t = (name: string, type: GoalType, targetDirection: TargetDirection, sessionTargetValue: number, smartGoalPrompt: string): Template =>
  ({ name, type, targetDirection, sessionTargetValue, smartGoalPrompt, generatedSmartGoal: '', isDefault: true, category: 'Behavior' });

export const BEHAVIOR_TEMPLATES: Template[] = [
  t('Behavior: Decrease elopement', 'BEHAVIOR_FREQUENCY', 'decrease', 1, 'Student will leave the assigned area without permission no more than 1 time per session.'),
  t('Behavior: Decrease physical aggression', 'BEHAVIOR_FREQUENCY', 'decrease', 0, 'Student will engage in 0 incidents of physical aggression (hitting, kicking, pushing) per session.'),
  t('Behavior: Decrease verbal outbursts', 'BEHAVIOR_FREQUENCY', 'decrease', 2, 'Student will have no more than 2 verbal outbursts (yelling, profanity) per session.'),
  t('Behavior: Decrease self-injurious behavior', 'BEHAVIOR_FREQUENCY', 'decrease', 0, 'Student will engage in 0 incidents of self-injurious behavior per session.'),
  t('Behavior: Decrease task refusals', 'BEHAVIOR_FREQUENCY', 'decrease', 2, 'Student will refuse or avoid assigned tasks no more than 2 times per session.'),
  t('Behavior: Increase hand raising to participate', 'BEHAVIOR_FREQUENCY', 'increase', 5, 'Student will raise a hand and wait to be called on at least 5 times per session.'),
  t('Behavior: Increase requests for a break', 'BEHAVIOR_FREQUENCY', 'increase', 3, 'Student will appropriately request a break when needed at least 3 times per session.'),
  t('Behavior: Decrease tantrum duration', 'BEHAVIOR_DURATION', 'decrease', 5, 'Student will reduce the total time spent in tantrum behavior to 5 minutes or less per session.'),
  t('Behavior: Decrease time off-task', 'BEHAVIOR_DURATION', 'decrease', 5, 'Student will spend no more than 5 minutes off-task during a 30-minute work period.'),
  t('Behavior: Increase time on-task', 'BEHAVIOR_DURATION', 'increase', 15, 'Student will remain on-task for a total of at least 15 minutes during independent work.'),
  t('Behavior: Increase time remaining in seat', 'BEHAVIOR_DURATION', 'increase', 10, 'Student will remain seated during instruction for a total of at least 10 minutes.'),
  t('Behavior: ABC data to identify behavior function', 'BEHAVIOR_ABC', 'decrease', 2, 'Record antecedents and consequences of problem behavior to identify its likely function; target no more than 2 incidents per session.'),
  t('Behavior: Use a replacement skill instead of problem behavior', 'BEHAVIOR_ABC', 'increase', 80, 'When a triggering situation occurs, student will use the taught replacement skill instead of problem behavior in 80% of incidents.'),
  t('Behavior: Increase on-task behavior (interval)', 'BEHAVIOR_INTERVAL', 'increase', 80, 'Student will be on-task in at least 80% of intervals during independent work, measured by momentary time sampling.'),
  t('Behavior: Decrease disruptive behavior (interval)', 'BEHAVIOR_INTERVAL', 'decrease', 20, 'Student will engage in disruptive behavior (calling out, noises, leaving seat) in no more than 20% of intervals during instruction, measured by partial interval recording.'),
  t('Behavior: Increase appropriate play with peers (interval)', 'BEHAVIOR_INTERVAL', 'increase', 70, 'Student will play appropriately with peers for the whole interval in at least 70% of intervals during recess or centers, measured by whole interval recording.'),
  t('Behavior: Begin tasks promptly after directions', 'BEHAVIOR_LATENCY', 'decrease', 30, 'Student will begin an assigned task within an average of 30 seconds of the direction being given.'),
  t('Behavior: Follow transition directions promptly', 'BEHAVIOR_LATENCY', 'decrease', 20, 'Student will begin moving to the next activity within an average of 20 seconds of a transition direction.'),
  t('Behavior: Respond to name promptly', 'BEHAVIOR_LATENCY', 'decrease', 5, 'Student will respond (look, answer, or come) within an average of 5 seconds of hearing their name.'),
];
