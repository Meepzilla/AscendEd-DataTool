import type { Goal, SessionData, Student } from './types';
import {
  captureTypeOf, goalDirection, summarizeAbc, summarizeCommunicationFunctions, summarizeFrequency,
  COMMUNICATION_FUNCTIONS, STORY_PARTS, STORY_LINKING_WORDS, linkingWordField, type AbcIncident,
} from './goal-constants';
import { goalMeasure, goalMeasureInfo, goalNotes, goalResponses, meetsTarget, promptTotals, usesPromptCounters } from './goal-measures';
import { formatDate, formatGoalTarget, goalTypeLabel, plural } from './helpers';

// A written summary of a student's data for a date range, built from fixed sentence patterns (no AI):
// per goal, the measure's average, range, latest value against the target, how often the target was met,
// the trend from the first to the second half of the sessions, and details that fit the goal type.
// The student is referred to by first name only.

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
    case 'STORY_CHAMPS': return 'the story score';
    case 'COMMUNICATION_FUNCTIONS': return 'the number of functions used spontaneously';
    case 'QUALITATIVE_OBSERVATION':
    case 'COGNITIVE': return 'the rating';
    case 'PROMPTING': return 'the percentage of independent responses';
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
    case 'BEHAVIOR_ABC': return goalDirection(goal) === 'decrease' ? String(v) : pct(v);
    default: return pct(v);
  }
}

/** How much change counts as a real trend: 5 points on a percent scale, otherwise 10% of the average. */
function trendThreshold(goal: Goal, values: number[]): number {
  const info = goalMeasureInfo(goal);
  if (info.unit === '%') return 5;
  if (info.max) return info.max * 0.1;
  return Math.max(0.5, avg(values) * 0.1);
}

function trendSentence(name: string, goal: Goal, values: number[]): string {
  if (values.length < 3) return '';
  const half = Math.floor(values.length / 2);
  const first = avg(values.slice(0, half));
  const second = avg(values.slice(values.length - half));
  const change = second - first;
  const decreaseGoal = goalDirection(goal) === 'decrease';
  if (Math.abs(change) < trendThreshold(goal, values)) {
    return `${name}'s performance remained fairly stable over the period (${formatValue(goal, first)} in earlier sessions and ${formatValue(goal, second)} in later sessions).`;
  }
  const improved = decreaseGoal ? change < 0 : change > 0;
  const direction = change > 0 ? 'increased' : 'decreased';
  return `This ${direction} from an average of ${formatValue(goal, first)} in earlier sessions to ${formatValue(goal, second)} in later sessions, ${improved ? 'showing progress toward the goal' : 'moving away from the goal'}.`;
}

/** Extra sentences that fit the goal's type, over the sessions with data. */
function detailSentences(name: string, goal: Goal, data: Record<string, any>[]): string[] {
  const type = captureTypeOf(goal);
  const lines: string[] = [];
  const total = (field: string) => sum(data.map(d => Number(d[field]) || 0));

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

  if (type === 'STORY_CHAMPS') {
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

function goalParagraph(name: string, goal: Goal, index: number, sessions: SessionData[]): string {
  const type = captureTypeOf(goal);
  const target = goal.sessionTargetValue;
  const heading = `Goal ${index + 1}: ${goal.name} (${goalTypeLabel(type)}${target !== undefined ? `; target ${formatGoalTarget(type, target, goal.targetDirection)}` : ''})`;

  const recorded = sessions
    .map(session => ({ session, data: session.goals?.find(g => g.goalId === goal.id)?.data }))
    .filter((r): r is { session: SessionData; data: Record<string, any> } => !!r.data)
    .map(r => ({ ...r, value: goalMeasure(goal, r.data) }))
    .filter((r): r is typeof r & { value: number } => r.value !== null);

  if (recorded.length === 0) return `${heading}\nNo data were recorded for this goal during this period.`;

  const values = recorded.map(r => r.value);
  const latest = recorded[recorded.length - 1];
  const sentences: string[] = [];
  const measure = measureName(goal);
  const capitalized = measure.charAt(0).toUpperCase() + measure.slice(1);
  if (recorded.length === 1) {
    sentences.push(`Data were recorded in 1 session (${formatDate(latest.session.date)}). ${capitalized} was ${formatValue(goal, latest.value)}.`);
  } else {
    const [low, high] = [Math.min(...values), Math.max(...values)];
    const range = round(low) === round(high) ? 'the same in every session' : `range ${formatValue(goal, low)} to ${formatValue(goal, high)}`;
    sentences.push(`Across ${recorded.length} sessions with data, ${measure} averaged ${formatValue(goal, avg(values))} (${range}).`);
    sentences.push(`In the most recent session (${formatDate(latest.session.date)}), ${measure} was ${formatValue(goal, latest.value)}.`);
  }
  if (target !== undefined) {
    const met = values.filter(v => meetsTarget(goal, v, target)).length;
    const latestMet = meetsTarget(goal, latest.value, target);
    sentences.push(`The target was met in ${met} of ${plural(values.length, 'session')}${recorded.length > 1 ? `, and ${latestMet ? 'was' : 'was not'} met in the most recent session` : ''}.`);
  }
  const trend = trendSentence(name, goal, values);
  if (trend) sentences.push(trend);
  sentences.push(...detailSentences(name, goal, recorded.map(r => r.data)));

  const notes = recorded.map(r => ({ date: r.session.date, text: goalNotes(r.data) })).filter(n => n.text).slice(-2);
  if (notes.length) sentences.push(`Session notes: ${notes.map(n => `${formatDate(n.date)}: "${n.text}"`).join('; ')}.`);

  return `${heading}\n${sentences.join(' ')}`;
}

export interface NarrativeInput {
  student: Student;
  goals: Goal[]; // the goals to include, in order
  sessions: SessionData[]; // the student's sessions in the date range, oldest first
  rangeLabel?: string; // e.g. "Oct 1, 2026 to Oct 28, 2026"; defaults to the sessions' dates
}

export function buildNarrative({ student, goals, sessions, rangeLabel }: NarrativeInput): string {
  const name = student.name.trim().split(/\s+/)[0] || student.name;
  const sorted = [...sessions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const period = rangeLabel
    ?? (sorted.length ? `${formatDate(sorted[0].date)} to ${formatDate(sorted[sorted.length - 1].date)}` : 'the selected period');

  const intro = sorted.length === 0
    ? `No sessions were recorded for ${name} ${rangeLabel ? `from ${period}` : 'in the selected period'}.`
    : `This summary covers ${plural(sorted.length, 'session')} with ${name} from ${period}, for ${plural(goals.length, 'goal')}.`;

  return [`Progress Summary: ${student.name}`, intro, ...(sorted.length ? goals.map((goal, i) => goalParagraph(name, goal, i, sorted)) : [])]
    .join('\n\n');
}
