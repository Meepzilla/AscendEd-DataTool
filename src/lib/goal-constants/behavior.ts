import type { GoalTemplate, GoalType, TargetDirection } from '../types';

// Behavior data goal types:
// - BEHAVIOR_FREQUENCY: tally of occurrences, with an optional rate per hour from the observation time.
// - BEHAVIOR_DURATION: timed episodes (start/stop timer or entered by hand).
// - BEHAVIOR_ABC: incidents recorded as Antecedent -> Behavior -> Consequence. An incident's behavior can be
//   the replacement skill, so replacement goals can measure the % of incidents where it was used.

export const BEHAVIOR_GOAL_TYPES: GoalType[] = ['BEHAVIOR_FREQUENCY', 'BEHAVIOR_DURATION', 'BEHAVIOR_ABC'];

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

/** Consequences, each with the behavior function it most often suggests. */
export const ABC_CONSEQUENCES = [
  { label: 'Demand removed / escaped', fn: 'Escape' },
  { label: 'Break given', fn: 'Escape' },
  { label: 'Adult attention', fn: 'Attention' },
  { label: 'Peer attention', fn: 'Attention' },
  { label: 'Redirected', fn: 'Attention' },
  { label: 'Item or activity given', fn: 'Tangible' },
  { label: 'Sensory input', fn: 'Sensory' },
  { label: 'Planned ignoring', fn: null },
  { label: 'Other', fn: null },
] as const;

export interface AbcIncident {
  time: string; // ISO timestamp
  antecedent: string;
  behavior: string;
  consequence: string;
  note?: string;
}

export const BEHAVIOR_FIELDS: Record<string, Record<string, any>> = {
  BEHAVIOR_FREQUENCY: { count: 0, observationMinutes: '', notes: '' },
  // episodeSeconds: length of each episode; runningSince: epoch ms while the timer runs (so it keeps time while the
  // device is locked or the app is in the background).
  BEHAVIOR_DURATION: { episodeSeconds: [], runningSince: null, observationMinutes: '', totalSeconds: 0, episodeCount: 0, notes: '' },
  BEHAVIOR_ABC: { incidents: [], incidentCount: 0, notes: '' },
};

/** Behavior goals usually aim to reduce something; other goal types aim to increase. */
export function goalDirection(goal: { type: string; targetDirection?: TargetDirection }): TargetDirection {
  return goal.targetDirection ?? (BEHAVIOR_GOAL_TYPES.includes(goal.type as GoalType) ? 'decrease' : 'increase');
}

export function summarizeFrequency(data: Record<string, any> = {}) {
  const count = Number(data.count) || 0;
  const minutes = Number(data.observationMinutes) || 0;
  return { count, minutes, ratePerHour: minutes > 0 ? (count / minutes) * 60 : null };
}

export function summarizeDuration(data: Record<string, any> = {}, now = Date.now()) {
  const episodes: number[] = Array.isArray(data.episodeSeconds) ? data.episodeSeconds.map(Number) : [];
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
  const replacementCount = incidents.filter(i => i.behavior === ABC_REPLACEMENT_BEHAVIOR).length;
  const problemCount = incidents.length - replacementCount;
  const tally = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((acc, v) => {
    if (v) acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  const problemIncidents = incidents.filter(i => i.behavior !== ABC_REPLACEMENT_BEHAVIOR);
  return {
    incidents,
    incidentCount: incidents.length,
    problemCount,
    replacementCount,
    replacementPercent: incidents.length > 0 ? (replacementCount / incidents.length) * 100 : null,
    antecedents: tally(problemIncidents.map(i => i.antecedent)),
    functions: tally(problemIncidents.map(i => ABC_CONSEQUENCES.find(c => c.label === i.consequence)?.fn || '')),
  };
}

/**
 * The value a behavior goal is measured by: occurrences (frequency), total minutes (duration), and for ABC
 * either problem-behavior incidents (decrease goals) or % of incidents with the replacement skill (increase).
 */
export function behaviorMeasure(type: string, data: Record<string, any>, direction: TargetDirection): number | null {
  if (type === 'BEHAVIOR_FREQUENCY') return summarizeFrequency(data).count;
  if (type === 'BEHAVIOR_DURATION') return summarizeDuration(data).totalMinutes;
  if (type === 'BEHAVIOR_ABC') {
    const abc = summarizeAbc(data);
    return direction === 'decrease' ? abc.problemCount : abc.replacementPercent;
  }
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

/** Called when a session is saved: stops a running duration timer and stores summary totals. */
export function finalizeBehaviorData(type: string, data: Record<string, any>, now = Date.now()): Record<string, any> {
  if (type === 'BEHAVIOR_DURATION') {
    const episodes: number[] = Array.isArray(data.episodeSeconds) ? [...data.episodeSeconds] : [];
    if (data.runningSince) episodes.push(Math.max(0, Math.round((now - Number(data.runningSince)) / 1000)));
    const summary = summarizeDuration({ ...data, episodeSeconds: episodes, runningSince: null });
    return { ...data, episodeSeconds: episodes, runningSince: null, totalSeconds: summary.totalSeconds, episodeCount: summary.episodeCount };
  }
  if (type === 'BEHAVIOR_ABC') {
    return { ...data, incidentCount: Array.isArray(data.incidents) ? data.incidents.length : 0 };
  }
  return data;
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
];
