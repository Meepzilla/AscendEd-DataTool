import { describe, expect, it } from 'vitest';
import { goalDirectionFor } from '../student-import';
import { applyGoalHotkey } from '../data-entry-hotkeys';
import { goalMeasure } from '../goal-measures';
import { trendWeight } from '../trial-weights';
import { serviceStatus } from '../dashboard';
import { matchTextToTarget } from '../goal-blanks';
import { CustomGoalTypeSchema } from '../schemas';
import { behaviorEvents, timePatterns } from '../behavior-timing';
import { buildNarrative, buildProgressReport } from '../report-narrative';
import { collectRecordedGoalSessions } from '../report-chart-views';
import { periodService } from '../student-overview';
import type { CustomGoalType, Goal, SessionData, Student } from '../types';

const makeCustom = (partial: Partial<CustomGoalType>): CustomGoalType => ({
  id: 'ct-1',
  version: 1,
  name: 'Custom Type',
  color: '#3b82f6',
  kind: 'counter',
  direction: 'increase',
  extras: { promptLevel: false, notes: true },
  createdAt: '2026-01-01T00:00:00.000Z',
  ...partial,
});

const makeStudent = (id: string, name: string, goals: Goal[]): Student => ({
  id,
  name,
  goals,
  createdAt: '2026-01-01T00:00:00.000Z',
  userId: 'u1',
});

const makeSession = (partial: Partial<SessionData> & Pick<SessionData, 'sessionId' | 'studentId' | 'studentName' | 'date' | 'time'>): SessionData => ({
  activity: '',
  notes: '',
  goals: [],
  originalGoalHeaders: [],
  ...partial,
});

describe('Batch B domain & clinical accuracy fixes', () => {
  it('infers increase/decrease direction for BEHAVIOR_ABC and BEHAVIOR_INTERVAL during import', () => {
    expect(goalDirectionFor('BEHAVIOR_ABC', 'Use a replacement behavior instead of throwing materials in 80% of incidents')).toBe('increase');
    expect(goalDirectionFor('BEHAVIOR_ABC', 'Reduce aggressive incidents to no more than 2 per week')).toBe('decrease');
    expect(goalDirectionFor('BEHAVIOR_INTERVAL', 'Remain on-task during 80% of 1-minute intervals')).toBe('increase');
    expect(goalDirectionFor('BEHAVIOR_INTERVAL', 'Reduce off-task behavior to fewer than 20% of intervals')).toBe('decrease');
  });

  it('treats unanswered custom latency sessions as breaking the mastery streak and counts them in reports', () => {
    const latencyType = makeCustom({ id: 'ct-lat', name: 'Response Time', kind: 'latency', direction: 'decrease' });
    const goal: Goal = {
      id: 'g-lat',
      name: 'Respond quickly',
      type: 'CUSTOM',
      dataCaptureType: 'CUSTOM',
      customTypeId: latencyType.id,
      customType: latencyType,
      smartGoal: 'Respond within 5 seconds',
      sessionTargetValue: 5,
      targetDirection: 'decrease',
      masterySessions: 2,
    };
    const sessions: SessionData[] = [
      makeSession({
        sessionId: 's1', studentId: 'st1', studentName: 'Alex', date: '2026-03-01', time: '09:00',
        goals: [{ goalId: 'g-lat', goalName: goal.name, goalType: 'CUSTOM', data: { latencies: [3, 4] } }],
      }),
      makeSession({
        sessionId: 's2', studentId: 'st1', studentName: 'Alex', date: '2026-03-02', time: '09:00',
        goals: [{ goalId: 'g-lat', goalName: goal.name, goalType: 'CUSTOM', data: { latencies: [2, 3] } }],
      }),
      makeSession({
        sessionId: 's3', studentId: 'st1', studentName: 'Alex', date: '2026-03-03', time: '09:00',
        goals: [{ goalId: 'g-lat', goalName: goal.name, goalType: 'CUSTOM', data: { latencies: [null, null] } }],
      }),
    ];

    const student = makeStudent('st1', 'Alex', [goal]);
    const [row] = buildProgressReport({ student, goals: [goal], sessions });
    expect(row.sessionCount).toBe(3);
    expect(row.streak).toBe(0);
    expect(row.status).not.toBe('mastered');

    const chartRows = collectRecordedGoalSessions(goal, sessions, true);
    expect(chartRows).toHaveLength(3);
    expect(Number.isNaN(chartRows[2].value)).toBe(true);

    const text = buildNarrative({ student, goals: [goal], sessions });
    expect(text).toContain('3 sessions');
    expect(text).toContain('did not respond in 2');
  });

  it('blocks prompt hotkeys on CUSTOM goals unless prompt counters are enabled', () => {
    expect(applyGoalHotkey('CUSTOM', 'V', {})).toBeNull();
    expect(applyGoalHotkey('CUSTOM', 'V', {}, [], false)).toBeNull();
    expect(applyGoalHotkey('CUSTOM', 'V', {}, [], true)).toEqual({ Verbal: 1 });
  });

  it('returns null for perMinute custom counter when observationMinutes is blank or non-positive', () => {
    const rateType = makeCustom({
      id: 'ct-rate',
      name: 'Rate',
      kind: 'counter',
      counter: { label: 'taps', perMinute: true },
    });
    const goal = { type: 'CUSTOM' as const, customType: rateType };
    expect(goalMeasure(goal, { count: 6, recorded: true })).toBeNull();
    expect(goalMeasure(goal, { count: 6, observationMinutes: 0, recorded: true })).toBeNull();
    expect(goalMeasure(goal, { count: 6, observationMinutes: 3, recorded: true })).toBe(2);
  });

  it('weights custom trials goals by opportunity count in trendWeight', () => {
    const trialsType = makeCustom({ id: 'ct-trials', name: 'Trial Grid', kind: 'trials', trials: { count: 10 } });
    const goal = { type: 'CUSTOM' as const, customType: trialsType };
    expect(trendWeight(goal, { trials: ['correct', 'incorrect', 'correct', 'untouched'] })).toBe(3);
  });

  it('counts explicit serviceMinutes allocations in dashboard serviceStatus for single-line IEPs', () => {
    const now = new Date(2026, 2, 11, 12, 0); // Wed Mar 11, 2026
    const status = serviceStatus(
      [{ id: 'st1', name: 'Sam', iep: { services: [{ type: 'related', minutes: 30, per: 'week' }] } }],
      [{ studentId: 'st1', date: '2026-03-10', time: '', serviceMinutes: { related: 30 } }],
      now,
    );
    expect(status.behind).toHaveLength(0);
  });

  it('does not rewrite LANGUAGE_SAMPLE MLU targets as percentages and caps custom prompting/trials at 100', () => {
    expect(matchTextToTarget('Produce MLU of 4.0 words with 80% intelligibility', { type: 'LANGUAGE_SAMPLE', sessionTargetValue: 4 })).toBe(
      'Produce MLU of 4.0 words with 80% intelligibility',
    );
    const badPrompting = CustomGoalTypeSchema.safeParse(makeCustom({ kind: 'prompting', defaultTarget: 120 }));
    expect(badPrompting.success).toBe(false);
    const badTrials = CustomGoalTypeSchema.safeParse(makeCustom({ kind: 'trials', defaultTarget: 150 }));
    expect(badTrials.success).toBe(false);
  });

  it('retains 0-second manual latency trials and skips 12 AM hour buckets for untimed sessions', () => {
    const events = behaviorEvents('BEHAVIOR_LATENCY', { latencies: [0, 3] }, new Date(2026, 2, 10, 9, 0));
    expect(events).toHaveLength(2);
    expect(events[0].amount).toBe(0);

    const patterns = timePatterns('BEHAVIOR_FREQUENCY', [
      { session: { date: '2026-03-10', time: '' }, data: { count: 0 } },
    ]);
    expect(patterns.byHour.find(b => b.name === '12 AM')).toBeUndefined();
  });

  it('excludes unparseable session dates in periodService and ignores non-finite baselines in buildProgressReport', () => {
    const ps = periodService(
      [makeSession({ sessionId: 's-bad', studentId: 'st1', studentName: 'Sam', date: 'not-a-date', time: '09:00', endTime: '09:30' })],
      undefined,
      new Date(2026, 2, 1),
      new Date(2026, 2, 31),
    );
    expect(ps.delivered).toBe(0);

    const goal: Goal = {
      id: 'g1', name: 'Test', type: 'DISCRETE_TRIALS', smartGoal: 'Test',
      baseline: Number.NaN,
    };
    const [row] = buildProgressReport({ student: makeStudent('st1', 'Sam', [goal]), goals: [goal], sessions: [] });
    expect(row.baseline).toBeNull();
  });
});
