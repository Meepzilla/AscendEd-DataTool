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

  it('does not count the same trial grid twice when it was saved in two parts', () => {
    const merged = mergeGoalData([
      { trials: ['correct', 'untouched'], numberOfTrials: 2 },
      { trials: ['correct', 'untouched'], numberOfTrials: 2 },
    ]);
    expect(merged.trials).toEqual(['correct']);
    expect(merged.numberOfTrials).toBe(1);
  });

  it('does not count the same ABC incident twice, but keeps different ones', () => {
    const incident = { time: '09:05', antecedent: 'Transition', behavior: 'Elopement', consequence: 'Break given' };
    const other = { time: '09:12', antecedent: 'Noise', behavior: 'Elopement', consequence: 'Break given' };
    const merged = mergeGoalData([
      { incidents: [incident, other] },
      { incidents: [incident] },
    ]);
    expect(merged.incidents).toEqual([incident, other]);
  });

  it('does not count the same intervals or latencies twice, but joins different parts', () => {
    const merged = mergeGoalData([
      { intervals: [true, false], latencies: [2, null] },
      { intervals: [true, false], latencies: [2, null] },
    ]);
    expect(merged.intervals).toEqual([true, false]);
    expect(merged.latencies).toEqual([2, null]);
    const joined = mergeGoalData([
      { intervals: [true, false], latencies: [2] },
      { intervals: [true, true], latencies: [3, null] },
    ]);
    expect(joined.intervals).toEqual([true, false, true, true]);
    expect(joined.latencies).toEqual([2, 3, null]);
  });

  it('keeps step scores from every part: an unscored step in a later part does not erase an earlier score', () => {
    // Part 1 scored steps a and b; part 2 scored c and d (Data Entry saves every step, unscored ones empty).
    const merged = mergeGoalData([
      { steps: [{ label: 'a', level: 'Verbal' }, { label: 'b', level: 'Independent' }, { label: 'c', level: '' }, { label: 'd', level: '' }] },
      { steps: [{ label: 'a', level: '' }, { label: 'b', level: '' }, { label: 'c', level: 'Independent' }, { label: 'd', level: 'Independent' }] },
    ]);
    expect(merged.steps.map((s: { level: string }) => s.level)).toEqual(['Verbal', 'Independent', 'Independent', 'Independent']);
  });

  it('keeps text and single values an earlier part recorded when a later part left them empty', () => {
    // After saving, Data Entry resets the card, so the next part is saved with empty text fields.
    const merged = mergeGoalData([
      { correct: 8, targetSound: '/s/', wordList: 'sun, sock', notes: 'first', rating: 4, food: 'cracker' },
      { correct: 5, targetSound: '', wordList: '', notes: '', rating: null, food: '' },
    ]);
    expect(merged).toMatchObject({ correct: 13, targetSound: '/s/', wordList: 'sun, sock', notes: 'first', rating: 4, food: 'cracker' });
    // A value the later part did record still wins.
    expect(mergeGoalData([{ targetSound: '/s/' }, { targetSound: '/z/' }]).targetSound).toBe('/z/');
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

  it('does not use a part\'s start time as the merged end time', () => {
    const a = session({ time: '09:00', endTime: '09:20', goals: [] });
    const b = session({ time: '09:30', endTime: undefined, goals: [] });
    const merged = mergeSessions([a, b]);
    expect([merged.time, merged.endTime]).toEqual(['09:00', '09:20']);
  });

  it('still caps observation minutes when the merged session runs past 600 minutes', () => {
    const part = (time: string, endTime: string) => session({ time, endTime, goals: [{ goalId: 'g', goalName: 'G', goalType: 'BEHAVIOR_FREQUENCY', data: { count: 1, observationMinutes: 800 } }] });
    const merged = mergeSessions([part('08:00', '13:00'), part('13:00', '19:00')]);
    expect(merged.endTime).toBe('19:00');
    expect(merged.goals[0].data.observationMinutes).toBe(660);
    expect(mergedMinutes([part('08:00', '13:00'), part('13:00', '19:00')])).toEqual({ before: 660, after: 0 });
  });
});

describe('merging fields the app stores in other forms', () => {
  it('adds observation minutes stored as typed text, and caps them at the merged span', () => {
    expect(mergeGoalData([{ count: 3, observationMinutes: '15' }, { count: 3, observationMinutes: '15' }])).toMatchObject({ count: 6, observationMinutes: 30 });
    expect(mergeGoalData([{ count: 3, observationMinutes: '15' }, { count: 1, observationMinutes: '' }])).toMatchObject({ count: 4, observationMinutes: 15 });
    const goal = (minutes: string) => [{ goalId: 'g', goalName: 'Calling out', goalType: 'BEHAVIOR_FREQUENCY', data: { count: 2, observationMinutes: minutes } }];
    const merged = mergeSessions([
      session({ sessionId: 'a', time: '09:00', endTime: '09:20', goals: goal('20') as any }),
      session({ sessionId: 'b', time: '09:20', endTime: '09:30', goals: goal('20') as any }),
    ]);
    expect(merged.goals[0].data.observationMinutes).toBe(30); // 40 entered, but the merged session is 30 minutes
  });

  it("keeps a recorded rating when a later part didn't work on the goal", () => {
    expect(mergeGoalData([{ rating: 5, notes: 'great', recorded: true }, { rating: 3, notes: '' }])).toMatchObject({ rating: 5, notes: 'great' });
    // A later part that did record a rating replaces it.
    expect(mergeGoalData([{ rating: 5, recorded: true }, { rating: 2, recorded: true }])).toMatchObject({ rating: 2 });
  });

  it("adds up each part's split of minutes across service types", () => {
    const merged = mergeSessions([
      session({ sessionId: 'a', time: '09:00', endTime: '09:30', serviceMinutes: { related: 30 } }),
      session({ sessionId: 'b', time: '09:30', endTime: '10:00', serviceMinutes: { aac: 30 } }),
    ]);
    expect(merged.serviceMinutes).toEqual({ related: 30, aac: 30 });
    // A part without a split counts all its minutes as Related, as it did on its own.
    const mixed = mergeSessions([
      session({ sessionId: 'a', time: '09:00', endTime: '09:30', serviceMinutes: { related: 20, aac: 10 } }),
      session({ sessionId: 'b', time: '09:30', endTime: '10:00' }),
    ]);
    expect(mixed.serviceMinutes).toEqual({ related: 50, aac: 10 });
    // Without any split the merged session has none (all its minutes count as Related).
    expect(mergeSessions([session({ sessionId: 'a', time: '09:00', endTime: '09:30' }), session({ sessionId: 'b', time: '09:30', endTime: '10:00' })]).serviceMinutes).toBeUndefined();
  });
});
