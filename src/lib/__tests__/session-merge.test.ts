import { describe, expect, it } from 'vitest';
import { mergeGoalData, mergeProblem, mergeSessions, mergedMinutes } from '../session-merge';
import { session } from './helpers';

describe('mergeProblem', () => {
  it('needs two sessions of one student on one day, none missed', () => {
    expect(mergeProblem([session()])).toMatch(/at least two/);
    expect(mergeProblem([session(), session({ studentId: 'other' })])).toMatch(/one student/);
    expect(mergeProblem([session(), session({ date: '2026-10-06T09:00:00.000Z' })])).toMatch(/same day/);
    expect(mergeProblem([session(), session({ missed: { reason: 'student-absent' } })])).toMatch(/Missed/);
    expect(mergeProblem([session(), session()])).toBeNull();
  });
});

describe('mergeGoalData', () => {
  it('adds counts and keeps the latest single values', () => {
    expect(mergeGoalData([{ correct: 3, incorrect: 1, rating: 2 }, { correct: 2, incorrect: 2, rating: 4 }]))
      .toEqual({ correct: 5, incorrect: 3, rating: 4 });
  });

  it('joins notes and keeps only scored trials', () => {
    const merged = mergeGoalData([
      { trials: ['correct', 'untouched'], numberOfTrials: 2, notes: 'first' },
      { trials: ['incorrect', 'untouched'], numberOfTrials: 2, notes: 'second' },
    ]);
    expect(merged.trials).toEqual(['correct', 'incorrect']);
    expect(merged.numberOfTrials).toBe(2);
    expect(merged.notes).toBe('first; second');
  });

  it('works out % of intervals again instead of adding it, and keeps the interval length', () => {
    const part = (intervals: boolean[]) => ({ method: 'partial', intervalSeconds: 60, intervalCount: intervals.length, intervals, timerStartedAt: null, startedAt: 'first', scoredCount: intervals.length, percentIntervals: 50, notes: '' });
    const merged = mergeGoalData([part([true, true, false, false]), { ...part([true, true, true, false]), startedAt: 'second' }]);
    expect(merged.intervalSeconds).toBe(60);
    expect(merged.intervalCount).toBe(8);
    expect(merged.percentIntervals).toBe(62.5);
    expect(merged.startedAt).toBe('first');
  });

  it('works out the average latency again', () => {
    const merged = mergeGoalData([
      { latencies: [2], trialTimes: [null], cueGivenAt: null, averageSeconds: 2, trialCount: 1, notes: '' },
      { latencies: [3, null], trialTimes: [null, null], cueGivenAt: null, averageSeconds: 3, trialCount: 2, notes: '' },
    ]);
    expect(merged.averageSeconds).toBe(2.5);
    expect(merged.trialCount).toBe(3);
  });

  it('keeps the best story element score and adds linking words', () => {
    expect(mergeGoalData([{ problem: 1, feeling: 1, wordBecause: 1 }, { problem: 1, feeling: 2, wordBecause: 2 }]))
      .toEqual({ problem: 1, feeling: 2, wordBecause: 3 });
  });

  it('keeps each task analysis step\'s latest score', () => {
    const merged = mergeGoalData([
      { steps: [{ label: 'a', level: 'Verbal' }, { label: 'b', level: '' }] },
      { steps: [{ label: 'a', level: 'Independent' }, { label: 'b', level: '' }] },
    ]);
    expect(merged.steps.map((s: { level: string }) => s.level)).toEqual(['Independent', '']);
  });
});

describe('mergeSessions', () => {
  it('spans the earliest start to the latest end and counts the time once', () => {
    const a = session({ time: '09:00', endTime: '09:20', activity: 'cards', goals: [{ goalId: 'g', goalName: 'G', goalType: 'ARTICULATION', data: { correct: 2 } }] });
    const b = session({ time: '09:10', endTime: '09:30', activity: 'game', goals: [{ goalId: 'g', goalName: 'G', goalType: 'ARTICULATION', data: { correct: 3 } }] });
    const merged = mergeSessions([b, a]);
    expect([merged.time, merged.endTime]).toEqual(['09:00', '09:30']);
    expect(merged.activity).toBe('cards; game');
    expect(merged.goals[0].data.correct).toBe(5);
    expect(mergedMinutes([a, b])).toEqual({ before: 40, after: 30 });
  });

  it('caps behavior observation minutes at the merged session\'s length', () => {
    const part = () => session({ time: '09:00', endTime: '09:20', goals: [{ goalId: 'g', goalName: 'G', goalType: 'BEHAVIOR_FREQUENCY', data: { count: 1, observationMinutes: 20 } }] });
    expect(mergeSessions([part(), part()]).goals[0].data.observationMinutes).toBe(20);
  });
});
