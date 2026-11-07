import { describe, expect, it } from 'vitest';
import { buildNarrative } from '../report-narrative';
import { goal, session } from './helpers';
import type { Student } from '../types';

const student = { id: 'st1', name: 'Ava Smith', goals: [] } as unknown as Student;
const artic = goal({ id: 'g1', name: 'Produce /s/', type: 'ARTICULATION', sessionTargetValue: 80 });
const scored = (date: string, correct: number, incorrect: number) =>
  session({ date, goals: [{ goalId: 'g1', goalName: 'Produce /s/', goalType: 'ARTICULATION', data: { correct, incorrect, approximate: 0 } }] });

describe('buildNarrative', () => {
  const sessions = [scored('2026-10-01T09:00:00Z', 6, 4), scored('2026-10-08T09:00:00Z', 8, 2), scored('2026-10-15T09:00:00Z', 9, 1)];

  it('reports how often the target was met, using the student\'s first name', () => {
    const text = buildNarrative({ student, goals: [artic], sessions });
    expect(text).toContain('Ava');
    expect(text).toMatch(/target was met in 2 of 3 sessions/);
  });

  it('brief style gives one line per goal', () => {
    const text = buildNarrative({ student, goals: [artic], sessions, options: { style: 'brief' } });
    expect(text).toMatch(/Goal 1 – Produce \/s\/: .*target met in 2 of 3/);
  });

  it('counts latency sessions without a response in both styles', () => {
    const latency = goal({ id: 'g2', name: 'Respond', type: 'BEHAVIOR_LATENCY', sessionTargetValue: 5 });
    const s = (date: string, latencies: (number | null)[]) =>
      session({ date, goals: [{ goalId: 'g2', goalName: 'Respond', goalType: 'BEHAVIOR_LATENCY', data: { latencies } }] });
    const input = { student, goals: [latency], sessions: [s('2026-10-01T09:00:00Z', [3]), s('2026-10-08T09:00:00Z', [4]), s('2026-10-15T09:00:00Z', [null])] };
    expect(buildNarrative(input)).toMatch(/target was met in 2 of 3 sessions/);
    expect(buildNarrative({ ...input, options: { style: 'brief' } })).toMatch(/target met in 2 of 3/);
  });

  it('starts the aim line at the goal\'s first recorded session, not the first session of the period', () => {
    // From Oct 1 (the goal's first data) the line expects about 49% and 58% on Oct 8 and 15: on track. From
    // Jun 1 (an earlier session without this goal) it would expect over 70%: behind.
    const aimed = { ...artic, baseline: 40, targetDate: '2026-11-01' };
    const earlier = session({ date: '2026-06-01T09:00:00Z', goals: [] });
    const data = [scored('2026-10-01T09:00:00Z', 5, 5), scored('2026-10-08T09:00:00Z', 6, 4), scored('2026-10-15T09:00:00Z', 7, 3)];
    const text = buildNarrative({ student, goals: [aimed], sessions: [earlier, ...data] });
    expect(text).toMatch(/aim line \(from a baseline of 40%/);
    expect(text).toMatch(/on track with the aim line/);
  });

  it('shows stored date-only sessions on their own day, not the day before (America/Los_Angeles)', () => {
    const data = [scored('2026-10-01', 5, 5), scored('2026-10-08', 6, 4), scored('2026-10-15', 9, 1)];
    const text = buildNarrative({ student, goals: [artic], sessions: data });
    expect(text).toContain('from Oct 1, 2026 to Oct 15, 2026');
    expect(text).toContain('In the most recent session (Oct 15, 2026)');
    expect(text).not.toContain('Sep 30');
    expect(text).not.toContain('Oct 14');
  });
});

describe('trend fitted by elapsed days, not session index', () => {
  // Same scores, different spacing: 50, 60, 70. A day apart the line runs 50% to 70% (10 points
  // per day); with the last session a month later the same scores give a much shallower per-day
  // slope, so the fitted value at the first session is about 54.7%, not 50%.
  it('spaces sessions by elapsed days, so a month apart is shallower than a day apart', () => {
    const close = [scored('2026-10-01T09:00:00Z', 5, 5), scored('2026-10-02T09:00:00Z', 6, 4), scored('2026-10-03T09:00:00Z', 7, 3)];
    expect(buildNarrative({ student, goals: [artic], sessions: close }))
      .toContain('the trend went from about 50% at the start of the period to about 70% at the end');
    const spread = [scored('2026-10-01T09:00:00Z', 5, 5), scored('2026-10-02T09:00:00Z', 6, 4), scored('2026-11-01T09:00:00Z', 7, 3)];
    expect(buildNarrative({ student, goals: [artic], sessions: spread }))
      .toContain('the trend went from about 54.7% at the start of the period to about 70.2% at the end');
  });

  it('fits unsorted sessions in date order', () => {
    const reversed = [scored('2026-10-03T09:00:00Z', 7, 3), scored('2026-10-01T09:00:00Z', 5, 5), scored('2026-10-02T09:00:00Z', 6, 4)];
    expect(buildNarrative({ student, goals: [artic], sessions: reversed }))
      .toContain('the trend went from about 50% at the start of the period to about 70% at the end');
  });

  it('reports the unclamped fitted ends, even past the observed range', () => {
    // 50, 60, 70, 71 with the last session a month later: the fitted line ends at about 71.6%,
    // above the highest value actually recorded (71%).
    const data = [scored('2026-10-01T09:00:00Z', 5, 5), scored('2026-10-02T09:00:00Z', 6, 4), scored('2026-10-03T09:00:00Z', 7, 3), scored('2026-11-01T09:00:00Z', 7.1, 2.9)];
    expect(buildNarrative({ student, goals: [artic], sessions: data }))
      .toContain('the trend went from about 59.4% at the start of the period to about 71.6% at the end');
  });

  it('calls a single session too few for a trend', () => {
    const text = buildNarrative({ student, goals: [artic], sessions: [scored('2026-10-01T09:00:00Z', 6, 4)] });
    expect(text).toContain('Data were recorded in 1 session');
    expect(text).not.toContain('trend went');
  });

  it('calls two sessions too few for a trend', () => {
    const text = buildNarrative({ student, goals: [artic], sessions: [scored('2026-10-01T09:00:00Z', 5, 5), scored('2026-10-02T09:00:00Z', 9, 1)] });
    expect(text).not.toContain('trend went');
  });

  it('calls sessions all on the same day steady, with no elapsed span to fit against', () => {
    const sameDay = [scored('2026-10-01T09:00:00Z', 5, 5), scored('2026-10-01T09:00:00Z', 6, 4), scored('2026-10-01T09:00:00Z', 7, 3)];
    const text = buildNarrative({ student, goals: [artic], sessions: sameDay });
    expect(text).toContain("stayed fairly steady over the period (about 60%)");
  });
});

describe('ABC narrative', () => {
  const abc = goal({ id: 'g3', name: 'Calm down', type: 'BEHAVIOR_ABC', sessionTargetValue: 80, targetDirection: 'increase' });
  const withIncidents = (incidents: object[]) => buildNarrative({ student, goals: [abc], sessions: [
    session({ date: '2026-11-01T17:00:00Z', goals: [{ goalId: 'g3', goalName: 'Calm down', goalType: 'BEHAVIOR_ABC', data: { incidents, incidentCount: incidents.length, recorded: true } }] }),
  ] });
  const time = '2026-11-01T17:05:00Z';

  it('reports every choice tied for the most, when an incident has several', () => {
    const text = withIncidents([{
      time, antecedent: 'Unstructured time, Noise or sensory input', behavior: 'Aggression, Self-injury', consequence: 'Break given, Adult attention',
      antecedents: ['Unstructured time', 'Noise or sensory input'], behaviors: ['Aggression', 'Self-injury'], consequences: ['Break given', 'Adult attention'],
      fn: 'Escape', fns: ['Escape', 'Attention'],
    }]);
    expect(text).toContain('1 incident was recorded');
    expect(text).toContain('The most common antecedents were "Unstructured time" and "Noise or sensory input" (1 each).');
    expect(text).toContain('The most frequent problem behaviors were "Aggression" and "Self-injury" (1 each).');
    expect(text).toContain('Consequences most often suggested functions of escape and attention (1 each).');
  });

  it('names only the most common when one stands out', () => {
    const one = (antecedent: string) => ({ time, antecedent, behavior: 'Elopement', consequence: 'Break given' });
    const text = withIncidents([one('Transition'), one('Transition'), one('Peer interaction')]);
    expect(text).toContain('3 incidents were recorded');
    expect(text).toContain('The most common antecedent was "Transition" (2).');
    expect(text).toContain('The most frequent problem behavior was "Elopement" (3).');
    expect(text).toContain('Consequences most often suggested a function of escape (3).');
  });
});
