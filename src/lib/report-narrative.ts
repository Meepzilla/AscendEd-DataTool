import type { Goal, SessionData, Student } from './types';
import {
  BEHAVIOR_GOAL_TYPES, INTERVAL_METHODS, captureTypeOf, goalDirection, summarizeAbc, summarizeCommunicationFunctions,
  median, summarizeDuration, summarizeFrequency, summarizeIntervals, summarizeLatency,
  COMMUNICATION_FUNCTIONS, STORY_PARTS, STORY_LINKING_WORDS, linkingWordField, type AbcIncident,
} from './goal-constants';
import { goalMeasure, goalMeasureInfo, goalNotes, goalResponses, meetsTarget, promptTotals, usesPromptCounters, withoutRunningTimers } from './goal-measures';
import { compareSessionsOldestFirst, formatDate, formatGoalTarget, goalTypeLabel, plural } from './helpers';
import { timePatterns, TIMING_MEASURE_LABELS, WEEKDAY_NAMES } from './behavior-timing';
import type { TaskStepScore } from './task-analysis';
import { AIM_RULE_SESSIONS, aimLine, aimStatus, aimValueAt, masterySessions, type AimLine, type AimStatus } from './aim-line';

// A written summary of a student's data for a date range, built from fixed sentence patterns (no AI).
// Each goal is analysed once (analyzeGoal): average, range, latest value, how often and how many sessions in
// a row the target was met, and the trend (a straight line fitted through all sessions). The narrative has
// an overview of all goals, then a paragraph per goal (detailed) or one line per goal (brief), with details
// that fit the goal type and, optionally, a suggested next step. The student is referred to by first name.

export type NarrativeStyle = 'detailed' | 'brief';

export interface NarrativeOptions {
  style?: NarrativeStyle;
  /** Add a data-based suggestion per goal (e.g. raise the target after it was met several times in a row). */
  nextSteps?: boolean;
}

const PROMPT_NAMES: Record<string, string> = {
  Visual: 'visual', Verbal: 'verbal', Gestural: 'gestural', PartialPhysical: 'partial physical', Imitation: 'imitation',
};

const round = (n: number, digits = 1) => Number(n.toFixed(digits));
const pct = (n: number) => `${Math.round(n)}%`;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const avg = (values: number[]) => (values.length ? sum(values) / values.length : 0);

/** What the goal's measure is called in a sentence, e.g. "accuracy", "the number of occurrences". */
function measureName(goal: Goal): string {
  switch (captureTypeOf(goal)) {
    case 'FLUENCY_SYLLABLE_STUTTER': return 'the percentage of fluent syllables';
    case 'STORY_ELEMENTS': return 'the story score';
    case 'COMMUNICATION_FUNCTIONS': return 'the number of functions used spontaneously';
    case 'QUALITATIVE_OBSERVATION':
    case 'COGNITIVE': return 'the rating';
    case 'PROMPTING': return 'the percentage of independent responses';
    case 'TASK_ANALYSIS': return 'the percentage of steps done independently';
    case 'BEHAVIOR_FREQUENCY': return 'the number of occurrences';
    case 'BEHAVIOR_DURATION': return 'the total duration';
    case 'BEHAVIOR_INTERVAL': return 'the percentage of intervals with the behavior';
    case 'BEHAVIOR_LATENCY': return 'the average time to respond';
    case 'BEHAVIOR_ABC': return goalDirection(goal) === 'decrease' ? 'the number of problem behavior incidents' : 'the percentage of incidents with the replacement skill';
    default: return 'accuracy';
  }
}

/** A value with the goal's unit, e.g. "72%", "3.5 min", "4 out of 5"; counts are plain numbers. */
function formatValue(goal: Goal, value: number): string {
  const v = round(value);
  switch (captureTypeOf(goal)) {
    case 'BEHAVIOR_FREQUENCY':
    case 'COMMUNICATION_FUNCTIONS': return String(v);
    case 'BEHAVIOR_DURATION': return `${v} min`;
    case 'BEHAVIOR_LATENCY': return `${v} seconds`;
    case 'QUALITATIVE_OBSERVATION':
    case 'COGNITIVE': return `${v} out of 5`;
    // To 0.1 like the goal cards (and the target check), so 79.6% isn't shown as a met 80%.
    case 'BEHAVIOR_ABC': return goalDirection(goal) === 'decrease' ? String(v) : `${v}%`;
    default: return `${v}%`;
  }
}

/** How much change over the period counts as a real trend: 5 points on a percent scale, otherwise 10%. */
function trendThreshold(goal: Goal, values: number[]): number {
  const info = goalMeasureInfo(goal);
  if (info.unit === '%') return 5;
  if (info.max) return info.max * 0.1;
  return Math.max(0.5, avg(values) * 0.1);
}

// Mastery (the target met in a number of sessions in a row, 3 unless the goal sets it) is masterySessions(goal).
// Fewer sessions than this are too few to call a trend.
const MIN_TREND_SESSIONS = 3;

type TrendKind = 'improving' | 'declining' | 'stable' | 'too few';
type GoalStatus = 'met' | 'improving' | 'declining' | 'stable' | 'too few' | 'no data';

interface GoalAnalysis {
  goal: Goal;
  number: number; // 1-based position in the narrative
  recorded: { session: SessionData; data: Record<string, any>; value: number }[];
  values: number[];
  average: number;
  low: number;
  high: number;
  latest: { date: string; value: number } | null;
  target?: number;
  metCount: number;
  latestMet: boolean | null;
  /** Sessions in a row, ending with the latest, that met the target. */
  streak: number;
  trend: { kind: TrendKind; from: number; to: number };
  status: GoalStatus;
  /** Latency data with trials but no measure (no response in any trial). */
  unmeasured: Record<string, any>[];
  /** Dates of the sessions in `unmeasured`. */
  unmeasuredDates: string[];
  /** The most recent session is one of those (so `latest` is the most recent session with a measure). */
  latestUnanswered: boolean;
  /** Sessions in a row that count as mastery for this goal. */
  mastery: number;
  /** The aim line (baseline to target by the target date) and where the student is against it. */
  aim: AimLine | null;
  aimStatus: AimStatus | null;
}

/**
 * The trend as a straight line fitted through every session (least squares), so one unusual session
 * moves it less than comparing halves would. Reported as the line's value at the first and last session.
 */
function fitTrend(goal: Goal, values: number[]): GoalAnalysis['trend'] {
  const n = values.length;
  if (n < MIN_TREND_SESSIONS) return { kind: 'too few', from: values[0] ?? 0, to: values[n - 1] ?? 0 };
  const meanX = (n - 1) / 2;
  const meanY = avg(values);
  let num = 0, den = 0;
  values.forEach((y, x) => { num += (x - meanX) * (y - meanY); den += (x - meanX) ** 2; });
  const slope = den ? num / den : 0;
  // The line's ends are kept within the values actually recorded, so it never reports e.g. -2 occurrences
  // or 108% (a steep line through few sessions can overshoot).
  const clamp = (v: number) => Math.min(Math.max(...values), Math.max(Math.min(...values), v));
  const from = clamp(meanY - slope * meanX);
  const to = clamp(meanY + slope * meanX);
  if (Math.abs(to - from) < trendThreshold(goal, values)) return { kind: 'stable', from, to };
  const better = goalDirection(goal) === 'decrease' ? to < from : to > from;
  return { kind: better ? 'improving' : 'declining', from, to };
}

function analyzeGoal(goal: Goal, number: number, sessions: SessionData[]): GoalAnalysis {
  const withData = sessions
    .map(session => {
      const data = session.goals?.find(g => g.goalId === goal.id)?.data;
      return { session, data: data ? withoutRunningTimers(data) : undefined };
    })
    .filter((r): r is { session: SessionData; data: Record<string, any> } => !!r.data)
    .map(r => ({ ...r, value: goalMeasure(goal, r.data) }));
  const recorded = withData.filter((r): r is typeof r & { value: number } => r.value !== null);
  // Latency sessions where the student never responded have no time to average, but they are data (and a
  // target can't have been met in them).
  const unmeasuredRows = captureTypeOf(goal) === 'BEHAVIOR_LATENCY'
    ? withData.filter(r => r.value === null && summarizeLatency(r.data).trialCount > 0)
    : [];
  const unmeasured = unmeasuredRows.map(r => r.data);
  const lastRow = [...recorded, ...unmeasuredRows].sort((x, y) => compareSessionsOldestFirst(x.session, y.session)).pop();
  const latestUnanswered = !!lastRow && lastRow.value === null;
  const values = recorded.map(r => r.value);
  const target = goal.sessionTargetValue;
  const met = values.map(v => target !== undefined && meetsTarget(goal, v, target));
  let streak = 0;
  for (let i = met.length - 1; i >= 0 && met[i]; i--) streak++;
  if (latestUnanswered) streak = 0;
  const trend = fitTrend(goal, values);
  const last = recorded[recorded.length - 1];
  const mastery = masterySessions(goal);
  const status: GoalStatus = recorded.length === 0 ? 'no data'
    : target !== undefined && streak >= mastery ? 'met'
    : trend.kind;
  // Without a baseline date the aim line starts at this goal's first recorded session, as on the Reports chart.
  const aim = aimLine(goal, recorded[0]?.session.date);
  const points = recorded.map(r => ({ date: r.session.date, value: r.value }));
  return {
    mastery, aim, aimStatus: aimStatus(goal, aim, points),
    goal, number, recorded, values, target, streak, trend, status, unmeasured,
    unmeasuredDates: unmeasuredRows.map(r => r.session.date),
    latestUnanswered,
    average: avg(values),
    low: values.length ? Math.min(...values) : 0,
    high: values.length ? Math.max(...values) : 0,
    latest: last ? { date: last.session.date, value: last.value } : null,
    metCount: met.filter(Boolean).length,
    latestMet: target === undefined || !last ? null : latestUnanswered ? false : met[met.length - 1],
  };
}

/** Where the student is against the aim line (from the baseline to the target by the target date). */
function aimSentence(name: string, a: GoalAnalysis): string | null {
  if (!a.aim || !a.aimStatus || !a.latest) return null;
  const expected = aimValueAt(a.aim, a.latest.date);
  const line = `the aim line (from a baseline of ${formatValue(a.goal, a.aim.start.value)} to ${formatValue(a.goal, a.aim.end.value)} by ${formatDate(new Date(a.aim.end.time))})`;
  return a.aimStatus === 'behind'
    ? `The last ${AIM_RULE_SESSIONS} sessions were ${goalDirection(a.goal) === 'decrease' ? 'above' : 'below'} ${line}, which expected about ${formatValue(a.goal, expected)} by now.`
    : `${name} is on track with ${line}, which expected about ${formatValue(a.goal, expected)} by the most recent session.`;
}

function trendSentence(name: string, a: GoalAnalysis): string {
  const { kind, from, to } = a.trend;
  const span = `from about ${formatValue(a.goal, from)} at the start of the period to about ${formatValue(a.goal, to)} at the end`;
  if (kind === 'too few') return '';
  if (kind === 'stable') return `${name}'s performance stayed fairly steady over the period (about ${formatValue(a.goal, avg([from, to]))}).`;
  return `Across all sessions, the trend went ${span}, ${kind === 'improving' ? 'showing progress toward the goal' : 'moving away from the goal'}.`;
}

/**
 * A data-based suggestion for the goal, worded as something to consider. Goals without a target are
 * described against the goal's direction only, never "the target".
 */
function nextStep(a: GoalAnalysis): string | null {
  const hasTarget = a.target !== undefined;
  // For a decrease goal (less behavior is better) a harder target is a lower one, and "short of it" is above it.
  const decrease = goalDirection(a.goal) === 'decrease';
  if (a.status === 'no data') return 'Collect data on this goal to monitor progress.';
  if (a.status === 'met') {
    // A target already at the end of the scale (0 incidents, 100%, a rating of 5) can't be made harder.
    const max = goalMeasureInfo(a.goal).max;
    const atLimit = a.target !== undefined && (decrease ? a.target <= 0 : max !== undefined && a.target >= max);
    return atLimit
      ? `The target was met in ${a.streak} sessions in a row; consider moving to the next step for this skill or reducing support.`
      : `The target was met in ${a.streak} sessions in a row; consider ${decrease ? 'lowering' : 'raising'} the target or moving to the next step for this skill.`;
  }
  if (a.status === 'too few') return 'More sessions are needed before a trend can be judged.';
  // A goal whose latest session met the target isn't told it is moving away from it, whatever the trend.
  if (a.status === 'declining' && a.latestMet) {
    return 'The target was met in the most recent session, but the overall trend is moving away from the goal; keep monitoring.';
  }
  if (a.status === 'declining') {
    return `Performance is moving away from the goal; consider reviewing supports or activities${hasTarget ? ', or the target' : ''}.`;
  }
  if (a.status === 'stable' && hasTarget && a.latestMet === false && a.values.length >= 5) {
    return `Progress has levelled off ${decrease ? 'above' : 'below'} the target; consider adjusting the approach or the level of support.`;
  }
  if (a.aimStatus === 'behind') return `The last ${AIM_RULE_SESSIONS} sessions were ${decrease ? 'above' : 'below'} the aim line; consider changing the instruction or support for this goal.`;
  if (a.latestMet) return `The target was met in the most recent session; keep monitoring until it is met in ${plural(a.mastery, 'session')} in a row.`;
  if (a.status === 'improving') return `Progress is moving ${hasTarget ? 'toward the target' : 'in the right direction'}; continue the current approach and keep monitoring.`;
  return null;
}

/** Task analysis: the steps done independently in the latest session, and the step that most often needed help. */
function taskAnalysisSentence(name: string, data: Record<string, any>[]): string | null {
  const sessions = data.map(d => (Array.isArray(d.steps) ? d.steps as TaskStepScore[] : []).filter(s => s && s.level)).filter(s => s.length);
  if (!sessions.length) return null;
  const latest = sessions[sessions.length - 1];
  const independent = latest.filter(s => s.level === 'Independent').length;
  const needed = new Map<string, number>();
  sessions.forEach(steps => steps.filter(s => s.level !== 'Independent').forEach(s => needed.set(s.label, (needed.get(s.label) ?? 0) + 1)));
  const hardest = [...needed.entries()].sort((a, b) => b[1] - a[1])[0];
  const latestText = `In the most recent session, ${name} did ${independent} of ${plural(latest.length, 'step')} independently.`;
  return hardest
    ? `${latestText} The step that most often needed support was "${hardest[0]}" (${plural(hardest[1], 'session')}).`
    : latestText;
}

/** Extra sentences that fit the goal's type, over the sessions with data. */
function detailSentences(name: string, goal: Goal, data: Record<string, any>[]): string[] {
  const type = captureTypeOf(goal);
  const lines: string[] = [];
  const total = (field: string) => sum(data.map(d => Number(d[field]) || 0));

  if (type === 'TASK_ANALYSIS') {
    const line = taskAnalysisSentence(name, data);
    if (line) lines.push(line);
  }

  const responses = data.map(d => goalResponses(type, d)).filter((r): r is NonNullable<typeof r> => !!r);
  if (responses.length) {
    const c = sum(responses.map(r => r.correct));
    const i = sum(responses.map(r => r.incorrect));
    const a = sum(responses.map(r => r.approximate));
    const parts = [plural(c, 'correct response'), plural(i, 'incorrect response'), ...(a ? [plural(a, 'approximation')] : [])];
    const list = parts.length === 3 ? `${parts[0]}, ${parts[1]} and ${parts[2]}` : parts.join(' and ');
    lines.push(`Across all trials, ${name} gave ${list} out of ${c + i + a} opportunities.`);
  }

  if (type === 'FLUENCY_SYLLABLE_STUTTER') {
    const syllables = total('totalSyllables');
    const types = [['blocks', total('blocks')], ['repetitions', total('repetitions')], ['prolongations', total('prolongations')], ['interjections', total('interjections')]] as [string, number][];
    const top = types.filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);
    lines.push(`${plural(syllables, 'syllable')} were sampled, with ${plural(total('stutteredSyllables'), 'stuttered syllable')}.${top.length ? ` The most frequent dysfluency type was ${top[0][0]} (${top[0][1]}).` : ''}`);
  }

  if (type === 'STORY_ELEMENTS') {
    const parts = STORY_PARTS.map(p => ({ label: p.label, score: avg(data.map(d => Math.min(2, Number(d[p.key]) || 0))) }));
    const strong = parts.filter(p => p.score >= 1.5).map(p => p.label.toLowerCase());
    const weak = parts.filter(p => p.score < 1).map(p => p.label.toLowerCase());
    if (strong.length) lines.push(`Story parts ${name} included most consistently: ${strong.join(', ')}.`);
    if (weak.length) lines.push(`Story parts that were often missing or partial: ${weak.join(', ')}.`);
    const words = STORY_LINKING_WORDS.map(w => [w, total(linkingWordField(w))] as [string, number]).filter(([, n]) => n > 0);
    if (words.length) lines.push(`${name} used ${plural(sum(words.map(([, n]) => n)), 'linking word')} (${words.map(([w, n]) => `"${w}" ${n}`).join(', ')}).`);
  }

  if (type === 'COMMUNICATION_FUNCTIONS') {
    const summary = data.map(d => summarizeCommunicationFunctions(d));
    const spontaneous = sum(summary.map(s => s.spontaneous));
    const prompted = sum(summary.map(s => s.prompted));
    const byFunction = COMMUNICATION_FUNCTIONS
      .map(f => ({ label: f.label.toLowerCase(), s: total(`${f.key}Spontaneous`) }))
      .filter(f => f.s > 0).sort((x, y) => y.s - x.s);
    lines.push(`${name} used communicative functions ${spontaneous} times spontaneously and ${prompted} times with a prompt.`);
    if (byFunction.length) lines.push(`The functions used most often without a prompt were ${byFunction.slice(0, 3).map(f => `${f.label} (${f.s})`).join(', ')}.`);
  }

  if (type === 'BEHAVIOR_FREQUENCY') {
    const minutes = sum(data.map(d => summarizeFrequency(d).minutes));
    const count = sum(data.map(d => summarizeFrequency(d).count));
    if (minutes > 0) lines.push(`Over ${round(minutes)} observed minutes, this is a rate of ${round((count / minutes) * 60)} per hour.`);
  }

  if (type === 'BEHAVIOR_ABC') {
    const abc = summarizeAbc({ incidents: data.flatMap(d => (Array.isArray(d.incidents) ? d.incidents : []) as AbcIncident[]) });
    lines.push(`${plural(abc.incidentCount, 'incident')} were recorded: ${abc.problemCount} with problem behavior and ${abc.replacementCount} where ${name} used the replacement skill.`);
    if (abc.antecedents.length) lines.push(`The most common antecedent was "${abc.antecedents[0][0]}" (${abc.antecedents[0][1]}).`);
    if (abc.behaviors.length) lines.push(`The most frequent problem behavior was "${abc.behaviors[0][0]}" (${abc.behaviors[0][1]}).`);
    if (abc.functions.length) lines.push(`Consequences most often suggested a function of ${abc.functions[0][0].toLowerCase()} (${abc.functions[0][1]}).`);
  }

  if (type === 'BEHAVIOR_DURATION') {
    const durations = data.map(d => summarizeDuration(d));
    const episodes = sum(durations.map(d => d.episodeCount));
    const totalMinutes = sum(durations.map(d => d.totalMinutes));
    const longest = Math.max(0, ...durations.map(d => d.longestSeconds));
    if (episodes === 1) {
      lines.push(`1 episode was timed, lasting ${round(totalMinutes)} min.`);
    } else if (episodes > 1) {
      lines.push(`${plural(episodes, 'episode')} were timed, averaging ${round(totalMinutes / episodes)} min each (longest ${round(longest / 60)} min).`);
    }
    // Only sessions with an observation time count toward the percentage, on both sides of the division.
    const observedSessions = data.map((d, i) => ({ minutes: Number(d.observationMinutes) || 0, behavior: durations[i].totalMinutes })).filter(s => s.minutes > 0);
    const observed = sum(observedSessions.map(s => s.minutes));
    if (observed > 0) {
      const behavior = sum(observedSessions.map(s => s.behavior));
      const scope = observedSessions.length < data.length ? ` (in the ${plural(observedSessions.length, 'session')} with an observation time)` : '';
      lines.push(`The behavior took up ${pct(Math.min(100, (behavior / observed) * 100))} of ${round(observed)} observed minutes${scope}.`);
    }
  }

  if (type === 'BEHAVIOR_INTERVAL') {
    const intervals = data.map(d => summarizeIntervals(d));
    const occurred = sum(intervals.map(i => i.occurred));
    const scored = sum(intervals.map(i => i.scored));
    const methods = [...new Set(intervals.map(i => INTERVAL_METHODS.find(m => m.value === i.method)?.label.toLowerCase()).filter(Boolean))];
    if (scored > 0) lines.push(`Using ${methods.join(' and ') || 'interval recording'}, the behavior was scored in ${occurred} of ${plural(scored, 'interval')} (${pct((occurred / scored) * 100)}).`);
  }

  if (type === 'BEHAVIOR_LATENCY') {
    const latencies = data.map(d => summarizeLatency(d));
    const trials = sum(latencies.map(l => l.trialCount));
    const noResponse = sum(latencies.map(l => l.noResponseCount));
    const times = latencies.flatMap(l => l.latencies.filter((v): v is number => v !== null)).sort((a, b) => a - b);
    if (trials > 0) {
      const middle = median(times);
      if (times.length === 0) {
        lines.push(`${name} did not respond in any of the ${plural(trials, 'trial')}.`);
      } else {
        lines.push(`${name} responded in ${times.length} of ${plural(trials, 'trial')} (median ${round(middle!)} seconds, fastest ${round(times[0])} seconds)${noResponse ? ` and did not respond in ${noResponse}` : ''}.`);
      }
    }
  }

  if (usesPromptCounters(type)) {
    const totals = promptTotals();
    data.forEach(d => Object.entries(promptTotals(d)).forEach(([k, v]) => { totals[k] += v; }));
    const all = sum(Object.values(totals));
    if (all > 0) {
      const prompts = Object.entries(totals).filter(([k, n]) => k !== 'Independent' && n > 0).sort((x, y) => y[1] - x[1]);
      lines.push(`${pct((totals.Independent / all) * 100)} of recorded responses were independent${prompts.length ? `; the most frequent prompt was ${PROMPT_NAMES[prompts[0][0]] ?? prompts[0][0]} (${prompts[0][1]})` : ''}.`);
    }
  }
  return lines;
}

/** When the behavior happened most (or, for latency, when responses were slowest), if there is enough data. */
function timingSentence(type: string, recorded: { session: SessionData; data: Record<string, any> }[]): string | null {
  const patterns = timePatterns(type, recorded);
  if (patterns.eventCount < 3 || !patterns.peakHour) return null;
  const unit = TIMING_MEASURE_LABELS[patterns.measure].unit;
  const latency = patterns.measure === 'seconds';
  const day = patterns.peakWeekday && patterns.byWeekday.filter(d => d.value > 0).length > 1
    ? ` and on ${WEEKDAY_NAMES[patterns.peakWeekday.name]}s (${patterns.peakWeekday.value}${unit}${latency ? '' : ' per session'})`
    : '';
  const basis = patterns.exactShare < 0.5 ? ' (mostly based on session start times)' : '';
  return latency
    ? `Responses were slowest around ${patterns.peakHour.name} (${patterns.peakHour.value}${unit} on average)${day}${basis}.`
    : `The behavior was recorded most around ${patterns.peakHour.name} (${patterns.peakHour.value}${unit})${day}${basis}.`;
}

function goalHeading(a: GoalAnalysis): string {
  const type = captureTypeOf(a.goal);
  return `Goal ${a.number}: ${a.goal.name} (${goalTypeLabel(type)}${a.target !== undefined ? `; target ${formatGoalTarget(type, a.target, a.goal.targetDirection)}` : ''})`;
}

function targetSentence(a: GoalAnalysis): string | null {
  if (a.target === undefined || !a.latest) return null;
  // Latency sessions without any response count as sessions where the target wasn't met.
  const sessions = a.values.length + a.unmeasured.length;
  const streak = a.streak >= 2 ? `, including the last ${a.streak} sessions in a row` : '';
  const latest = sessions > 1 && a.streak < 2 ? `, and ${a.latestMet ? 'was' : 'was not'} met in the most recent session` : '';
  return `The target was met in ${a.metCount} of ${plural(sessions, 'session')}${streak}${latest}.`;
}

function goalParagraph(name: string, a: GoalAnalysis, options: Required<NarrativeOptions>): string {
  const heading = goalHeading(a);
  if (!a.latest) {
    // Latency trials with no response at all have no time to average, but they are still data.
    const unanswered = a.unmeasured.length ? detailSentences(name, a.goal, a.unmeasured) : [];
    const text = unanswered.length ? unanswered.join(' ') : 'No data were recorded for this goal during this period.';
    return `${heading}\n${text}${options.nextSteps && !unanswered.length ? `\nSuggested next step: ${nextStep(a)}` : ''}`;
  }

  const goal = a.goal;
  const type = captureTypeOf(goal);
  const sentences: string[] = [];
  const measure = measureName(goal);
  const capitalized = measure.charAt(0).toUpperCase() + measure.slice(1);
  if (a.values.length === 1) {
    sentences.push(`Data were recorded in 1 session (${formatDate(a.latest.date)}). ${capitalized} was ${formatValue(goal, a.latest.value)}.`);
  } else {
    const range = round(a.low) === round(a.high) ? 'the same in every session' : `range ${formatValue(goal, a.low)} to ${formatValue(goal, a.high)}`;
    sentences.push(`Across ${a.values.length} sessions with data, ${measure} averaged ${formatValue(goal, a.average)} (${range}).`);
    sentences.push(`In the most recent session${a.latestUnanswered ? ' with a response' : ''} (${formatDate(a.latest.date)}), ${measure} was ${formatValue(goal, a.latest.value)}.`);
  }
  const targetText = targetSentence(a);
  if (targetText) sentences.push(targetText);
  const trend = trendSentence(name, a);
  if (trend) sentences.push(trend);
  const aimText = aimSentence(name, a);
  if (aimText) sentences.push(aimText);
  if (a.unmeasured.length) {
    const n = a.unmeasured.length;
    sentences.push(`In ${n === 1 ? '1 more session' : `${n} more sessions`} (${a.unmeasuredDates.map(d => formatDate(d)).join(', ')}), ${name} did not respond in any trial; ${n === 1 ? 'it is' : 'they are'} not included in the average time.`);
  }
  sentences.push(...detailSentences(name, goal, [...a.recorded.map(r => r.data), ...a.unmeasured]));
  if (BEHAVIOR_GOAL_TYPES.includes(type)) {
    const timing = timingSentence(type, a.recorded);
    if (timing) sentences.push(timing);
  }
  const notes = a.recorded.map(r => ({ date: r.session.date, text: goalNotes(r.data) })).filter(n => n.text).slice(-2);
  if (notes.length) sentences.push(`Session notes: ${notes.map(n => `${formatDate(n.date)}: "${n.text}"`).join('; ')}.`);

  const step = options.nextSteps ? nextStep(a) : null;
  return `${heading}\n${sentences.join(' ')}${step ? `\nSuggested next step: ${step}` : ''}`;
}

const TREND_WORDS: Record<TrendKind, string> = { improving: 'improving', declining: 'moving away from the goal', stable: 'steady', 'too few': 'too few sessions for a trend' };

/** One line per goal: average, latest against the target, and the trend. */
function briefLine(a: GoalAnalysis, options: Required<NarrativeOptions>): string {
  const label = `Goal ${a.number} – ${a.goal.name}`;
  if (!a.latest) return `${label}: no data this period.${options.nextSteps ? ` ${nextStep(a)}` : ''}`;
  const goal = a.goal;
  const parts = [
    a.values.length > 1 ? `averaged ${formatValue(goal, a.average)} over ${plural(a.values.length, 'session')}` : `${formatValue(goal, a.latest.value)} in 1 session`,
    a.values.length > 1 ? `latest ${formatValue(goal, a.latest.value)}` : null,
    a.target !== undefined ? `target met in ${a.metCount} of ${a.values.length + a.unmeasured.length}${a.streak >= a.mastery ? ` (last ${a.streak} in a row)` : ''}` : null,
    a.aimStatus === 'behind' ? 'behind the aim line' : a.aimStatus === 'on-track' ? 'on track with the aim line' : null,
    TREND_WORDS[a.trend.kind],
  ].filter(Boolean);
  const step = options.nextSteps ? nextStep(a) : null;
  return `${label}: ${parts.join('; ')}.${step ? ` ${step}` : ''}`;
}

/** Where every goal stands, so the reader sees the whole picture before the details. */
function overview(analyses: GoalAnalysis[]): string | null {
  if (analyses.length < 2) return null;
  const groups: [GoalStatus, string][] = [
    ['met', 'met their mastery criteria'],
    ['improving', 'are improving'],
    ['stable', 'are steady'],
    ['declining', 'are moving away from the goal'],
    ['too few', 'have too few sessions to show a trend'],
    ['no data', 'had no data'],
  ];
  const parts = groups
    .map(([status, words]) => {
      const numbers = analyses.filter(a => a.status === status).map(a => a.number);
      if (!numbers.length) return null;
      const which = numbers.length === analyses.length ? '' : ` (Goal${numbers.length > 1 ? 's' : ''} ${numbers.join(', ')})`;
      const verb = numbers.length === 1 ? words.replace(/^are /, 'is ').replace(/^have /, 'has ') : words;
      return `${numbers.length === analyses.length ? 'all' : numbers.length} ${verb}${which}`;
    })
    .filter(Boolean);
  return `Overview: of the ${analyses.length} goals, ${parts.join('; ')}.`;
}

export interface NarrativeInput {
  student: Student;
  goals: Goal[]; // the goals to include, in order
  sessions: SessionData[]; // the student's sessions in the date range, oldest first
  rangeLabel?: string; // e.g. "Oct 1, 2026 to Oct 28, 2026"; defaults to the sessions' dates
  options?: NarrativeOptions;
}

export function buildNarrative({ student, goals, sessions, rangeLabel, options = {} }: NarrativeInput): string {
  const settings: Required<NarrativeOptions> = { style: options.style ?? 'detailed', nextSteps: options.nextSteps ?? false };
  const name = student.name.trim().split(/\s+/)[0] || student.name;
  const sorted = [...sessions].sort(compareSessionsOldestFirst);
  const period = rangeLabel
    ?? (sorted.length ? `${formatDate(sorted[0].date)} to ${formatDate(sorted[sorted.length - 1].date)}` : 'the selected period');

  if (sorted.length === 0) {
    return [`Progress Summary: ${student.name}`, `No sessions were recorded for ${name} ${rangeLabel ? `from ${period}` : 'in the selected period'}.`].join('\n\n');
  }

  const analyses = goals.map((goal, i) => analyzeGoal(goal, i + 1, sorted));
  // Sessions where something was recorded for at least one of these goals (not every session in the range).
  const sessionsWithData = sorted.filter(session => goals.some(goal => {
    const data = session.goals?.find(g => g.goalId === goal.id)?.data;
    if (!data) return false;
    const saved = withoutRunningTimers(data);
    return goalMeasure(goal, saved) !== null || (captureTypeOf(goal) === 'BEHAVIOR_LATENCY' && summarizeLatency(saved).trialCount > 0);
  })).length;
  const intro = `This summary covers ${plural(sessionsWithData, 'session')} with ${name} from ${period}, for ${plural(goals.length, 'goal')}.`;
  const body = settings.style === 'brief'
    ? [analyses.map(a => briefLine(a, settings)).join('\n')]
    : analyses.map(a => goalParagraph(name, a, settings));
  return [`Progress Summary: ${student.name}`, intro, overview(analyses), ...body].filter(Boolean).join('\n\n');
}

// ---- Printable progress report (Reports → Progress Report) ----

/** Where a goal stands for the reporting period, in the words IEP progress reports use. */
export type ProgressStatus = 'mastered' | 'progressing' | 'limited' | 'not-progressing' | 'too-few' | 'not-addressed';

export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  mastered: 'Goal met',
  progressing: 'Making progress',
  limited: 'Limited progress',
  'not-progressing': 'Not making progress',
  'too-few': 'Too few sessions to judge',
  'not-addressed': 'Not addressed this period',
};

export interface GoalProgress {
  goal: Goal;
  number: number;
  typeLabel: string;
  targetLabel: string | null;
  /** One point per session with a measure, oldest first. */
  points: { date: string; value: number }[];
  /** Average, range and latest, already formatted with the goal's unit (null without data). */
  average: string | null;
  range: string | null;
  latest: string | null;
  latestDate: string | null;
  target: number | undefined;
  metCount: number;
  sessionCount: number;
  streak: number;
  trend: 'improving' | 'declining' | 'stable' | 'too few';
  status: ProgressStatus;
  /** The goal's paragraph from the narrative (without its heading line). */
  comment: string;
  nextStep: string | null;
  /** Mastery criteria, baseline and aim line (null when the goal doesn't set them). */
  mastery: number;
  baseline: string | null;
  aim: AimLine | null;
  aimStatus: AimStatus | null;
  /** The measure's name, unit and scale, for the chart. */
  measureLabel: string;
  unit: string;
  max?: number;
}

function progressStatus(a: GoalAnalysis): ProgressStatus {
  switch (a.status) {
    case 'met': return 'mastered';
    case 'improving': return 'progressing';
    // Steady at or above the target in the latest session still counts as progress toward it.
    case 'stable': return a.latestMet ? 'progressing' : 'limited';
    case 'declining': return a.latestMet ? 'limited' : 'not-progressing';
    case 'too few': return 'too-few';
    default: return 'not-addressed';
  }
}

/** Per-goal figures, status and comment for the printable progress report. */
export function buildProgressReport({ student, goals, sessions }: Omit<NarrativeInput, 'rangeLabel' | 'options'>): GoalProgress[] {
  const name = student.name.trim().split(/\s+/)[0] || student.name;
  const sorted = [...sessions].sort(compareSessionsOldestFirst);
  const settings: Required<NarrativeOptions> = { style: 'detailed', nextSteps: false };
  return goals.map((goal, i) => {
    const a = analyzeGoal(goal, i + 1, sorted);
    const type = captureTypeOf(goal);
    const info = goalMeasureInfo(goal);
    const has = !!a.latest;
    return {
      goal,
      number: a.number,
      typeLabel: goalTypeLabel(type),
      targetLabel: a.target !== undefined ? formatGoalTarget(type, a.target, goal.targetDirection) : null,
      points: a.recorded.map(r => ({ date: r.session.date, value: r.value })),
      average: has && a.values.length > 1 ? formatValue(goal, a.average) : has ? formatValue(goal, a.latest!.value) : null,
      range: has && a.values.length > 1 && round(a.low) !== round(a.high) ? `${formatValue(goal, a.low)} – ${formatValue(goal, a.high)}` : null,
      latest: has ? formatValue(goal, a.latest!.value) : null,
      latestDate: a.latest?.date ?? null,
      target: a.target,
      metCount: a.metCount,
      sessionCount: a.values.length + a.unmeasured.length,
      streak: a.streak,
      trend: a.trend.kind,
      status: progressStatus(a),
      comment: goalParagraph(name, a, settings).split('\n').slice(1).join(' ').trim(),
      nextStep: nextStep(a),
      mastery: a.mastery,
      baseline: goal.baseline !== undefined && goal.baseline !== null ? formatValue(goal, Number(goal.baseline)) : null,
      aim: a.aim,
      aimStatus: a.aimStatus,
      measureLabel: info.label,
      unit: info.unit,
      max: info.max,
    };
  });
}
