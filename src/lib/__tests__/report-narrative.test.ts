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
});
