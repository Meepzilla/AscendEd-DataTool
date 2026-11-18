import { describe, expect, it } from 'vitest';
import { isRealDate, parseDateOnly, sessionInDateRange } from '../helpers';
import { knownGoalType } from '../legacy-goal-types';
import { MAX_TRIALS, cycleTrial, storedTrialCount } from '../goal-input-logic';
import { applyGoalHotkey } from '../data-entry-hotkeys';
import { createBackup, parseBackup } from '../backup';
import { mergeGoalData, mergeProblem, mergeSessions } from '../session-merge';
import { goalTarget } from '../student-import';
import { summarizeDuration, summarizeAbc } from '../goal-constants';
import { storyPartScore } from '../goal-constants';
import { session } from './helpers';
import type { GoalTemplate, Student } from '../types';

// Stored and imported data can hold values the app never writes (a hand-edited file, another app's export, damage).
// These check that such values are rejected or contained at the place they come in, not carried into a crash.
// They run under TZ=America/Los_Angeles (vitest.config.mts).

describe('impossible calendar dates (audit M4)', () => {
  it('isRealDate knows month lengths and leap years', () => {
    expect(isRealDate(2026, 2, 28)).toBe(true);
    expect(isRealDate(2026, 2, 29)).toBe(false);
    expect(isRealDate(2028, 2, 29)).toBe(true);
    expect(isRealDate(2026, 4, 31)).toBe(false);
    expect(isRealDate(2026, 12, 31)).toBe(true);
    expect(isRealDate(2026, 13, 1)).toBe(false);
    expect(isRealDate(2026, 1, 0)).toBe(false);
    expect(isRealDate(2026.5, 1, 1)).toBe(false);
  });
  it('parseDateOnly reads a real day as that day and an impossible one as Invalid Date, not a rolled day', () => {
    expect(parseDateOnly('2026-02-28').getDate()).toBe(28);
    expect(Number.isNaN(parseDateOnly('2026-02-30').getTime())).toBe(true);
    expect(Number.isNaN(parseDateOnly('2026-04-31').getTime())).toBe(true);
    expect(Number.isNaN(parseDateOnly('2026-13-01').getTime())).toBe(true);
    expect(parseDateOnly('2026-10-05T09:00:00.000Z').getUTCFullYear()).toBe(2026);
  });
  it('a session with an impossible date is outside any range that is set, and still listed with no range', () => {
    const from = new Date(2026, 2, 1);
    const to = new Date(2026, 2, 31);
    expect(sessionInDateRange('2026-02-30', from, to)).toBe(false);
    expect(sessionInDateRange('2026-02-30', null, null)).toBe(true);
    expect(sessionInDateRange('not-a-date', undefined, undefined)).toBe(true);
    expect(sessionInDateRange('not-a-date', from, undefined)).toBe(false);
  });
});

describe('goal types from outside (audit M2)', () => {
  it('knownGoalType accepts current types and earlier keys, and nothing else', () => {
    expect(knownGoalType('ARTICULATION')).toBe('ARTICULATION');
    expect(knownGoalType('STORY_OLD_KEY')).toBe('STORY_ELEMENTS');
    expect(knownGoalType('COMMUNICATION_COUNT')).toBe('COMMUNICATION_COUNT');
    expect(knownGoalType('ARTICULATON')).toBeUndefined();
    expect(knownGoalType('')).toBeUndefined();
    expect(knownGoalType(undefined)).toBeUndefined();
    expect(knownGoalType(7)).toBeUndefined();
    expect(knownGoalType('__proto__')).toBeUndefined();
  });

  const student = (id: string, goals: { id: string; type: string; dataCaptureType?: string }[]) =>
    ({ id, name: id, userId: 'u', createdAt: '2026-01-01', goals: goals.map(g => ({ name: g.id, smartGoal: '', ...g })) }) as unknown as Student;
  const backupText = (students: Student[], sessions: unknown[] = [], templates: unknown[] = []) =>
    JSON.stringify(createBackup({ students, goalTemplates: templates as GoalTemplate[], sessions: sessions as never }));

  it('restoring leaves out a goal of an unknown type, with a report, and keeps the student and the other goals', () => {
    const parsed = parseBackup(backupText([student('ava', [{ id: 'g1', type: 'ARTICULATION' }, { id: 'g2', type: 'ARTICULATON' }])]));
    expect(parsed.data.students[0].goals.map(g => g.id)).toEqual(['g1']);
    expect(parsed.droppedRecords).toEqual([expect.objectContaining({ kind: 'goal', id: 'g2, on student ava' })]);
  });
  it('an unknown data capture type also leaves the goal out, and an earlier key is read as the current one', () => {
    const parsed = parseBackup(backupText([student('ava', [
      { id: 'g1', type: 'ARTICULATION', dataCaptureType: 'NOPE' },
      { id: 'g2', type: 'STORY_OLD_KEY' },
    ])]));
    expect(parsed.data.students[0].goals.map(g => [g.id, g.type])).toEqual([['g2', 'STORY_ELEMENTS']]);
    expect(parsed.droppedRecords).toHaveLength(1);
  });
  it('a template of an unknown type is left out, and one of a current type is kept', () => {
    const parsed = parseBackup(backupText([], [], [
      { id: 't1', name: 'One', type: 'ARTICULATION' }, { id: 't2', name: 'Two', type: 'WHAT' },
    ]));
    expect(parsed.data.goalTemplates.map(t => t.id)).toEqual(['t1']);
    expect(parsed.droppedRecords).toEqual([expect.objectContaining({ kind: 'goalTemplate', id: 't2' })]);
  });
  it('a session goal of an unknown type is left out of its session, and the session stays', () => {
    const parsed = parseBackup(backupText([student('ava', [])], [session({
      sessionId: 'x1',
      goals: [
        { goalId: 'g1', goalName: 'a', goalType: 'ARTICULATION', data: { correct: 1 } },
        { goalId: 'g2', goalName: 'b', goalType: 'WHAT', data: {} },
      ] as never,
    })]));
    expect(parsed.data.sessions).toHaveLength(1);
    expect(parsed.data.sessions[0].goals.map(g => g.goalId)).toEqual(['g1']);
    expect(parsed.droppedRecords).toEqual([expect.objectContaining({ kind: 'sessionGoal' })]);
  });
  it('a backup of known types restores with nothing reported', () => {
    const parsed = parseBackup(backupText([student('ava', [{ id: 'g1', type: 'ARTICULATION' }])], [session()]));
    expect(parsed.droppedRecords).toEqual([]);
  });
});

describe('a date outside the range a Date can hold, in a backup (audit M5)', () => {
  it('drops a template whose createdAt is out of range, instead of throwing and aborting the whole restore', () => {
    const text = JSON.stringify(createBackup({
      students: [], sessions: [session({ sessionId: 'good' })],
      goalTemplates: [{ id: 'ok', name: 'ok', type: 'ARTICULATION', createdAt: '2026-01-01' }, { id: 'bad', name: 'bad', type: 'ARTICULATION', createdAt: 1e20 }] as unknown as GoalTemplate[],
    }));
    const parsed = parseBackup(text);
    expect(parsed.data.goalTemplates.map(t => t.id)).toEqual(['ok']);
    expect(parsed.droppedRecords).toEqual([expect.objectContaining({ kind: 'goalTemplate', id: 'bad' })]);
    expect(parsed.data.sessions.map(x => x.sessionId)).toEqual(['good']);
  });
  it('drops a student whose createdAt is out of range', () => {
    const text = JSON.stringify(createBackup({
      students: [{ id: 'ava', name: 'ava', createdAt: 1e20, goals: [] } as unknown as Student], goalTemplates: [], sessions: [],
    }));
    expect(parseBackup(text).droppedRecords).toEqual([expect.objectContaining({ kind: 'student', id: 'ava' })]);
  });
});

describe('a stored trial count (audit M6)', () => {
  it('is a whole number from 1 to the grid limit, or the default', () => {
    expect(storedTrialCount(5)).toBe(5);
    expect(storedTrialCount(5.5)).toBe(5);
    expect(storedTrialCount(0)).toBe(1);
    expect(storedTrialCount(-3)).toBe(1);
    expect(storedTrialCount(4e9)).toBe(MAX_TRIALS);
    expect(storedTrialCount('12')).toBe(12);
    expect(storedTrialCount(undefined)).toBe(5);
    expect(storedTrialCount(null)).toBe(5);
    expect(storedTrialCount('abc')).toBe(5);
    expect(storedTrialCount(Number.NaN)).toBe(5);
    expect(storedTrialCount(Infinity)).toBe(5);
  });
  it('tapping a trial or using a hotkey does not throw on a damaged count', () => {
    for (const numberOfTrials of [5.5, 4e9, -1, 'x', Infinity]) {
      const data = { numberOfTrials };
      expect(() => cycleTrial(data, 0)).not.toThrow();
      expect(cycleTrial(data, 0).length).toBeLessThanOrEqual(MAX_TRIALS);
      const marked = applyGoalHotkey('DISCRETE_TRIALS', 'C', data);
      expect(marked?.trials.length).toBeLessThanOrEqual(MAX_TRIALS);
    }
  });
});

describe('merging sessions saved in parts', () => {
  it('does not add trialsPerAttempt, a setting, as if it were a count (audit M7)', () => {
    expect(mergeGoalData([{ trialsPerAttempt: 3, correct: 1 }, { trialsPerAttempt: 3, correct: 2 }])).toMatchObject({ trialsPerAttempt: 3, correct: 3 });
  });
  it('will not merge sessions whose dates can\'t be read, which would all read as the same day (audit L11)', () => {
    expect(mergeProblem([session({ date: '2026-02-30' }), session({ date: 'garbage' })])).toMatch(/can't be read/);
    expect(mergeProblem([session({ date: '2026-11-04' }), session({ date: '2026-11-04' })])).toBeNull();
  });
  it('splits merged service minutes so they add up to the merged total, however the parts round (audit L12)', () => {
    // 30 minutes across two types, but the parts overlap and span 25, so they are scaled by 5/6: 16.67 and 8.33.
    // The minutes are shared out together, so the types always add up to the rounded total.
    const parts = [
      session({ time: '09:00', endTime: '09:10', serviceMinutes: { related: 10 } }),
      session({ time: '09:05', endTime: '09:15', serviceMinutes: { aac: 10 } }),
      session({ time: '09:15', endTime: '09:25', serviceMinutes: { related: 10 } }),
    ];
    const merged = mergeSessions(parts);
    const sum = Object.values(merged.serviceMinutes ?? {}).reduce((x, y) => x + (y ?? 0), 0);
    expect(sum).toBe(25);
    expect(merged.serviceMinutes).toEqual({ related: 17, aac: 8 });
    // Parts that don't overlap are not scaled: their minutes are kept as they are.
    const tie = mergeSessions([
      session({ time: '09:00', endTime: '09:05', serviceMinutes: { related: 2 } }),
      session({ time: '09:00', endTime: '09:05', serviceMinutes: { aac: 2 } }),
    ]);
    expect(Object.values(tie.serviceMinutes ?? {}).reduce((x, y) => x + (y ?? 0), 0)).toBe(4);
  });
});

describe('small summaries given damaged data', () => {
  it('a trials target above 100 percent is not made up from "5/3 trials" (audit L14)', () => {
    expect(goalTarget('DISCRETE_TRIALS', 'respond in 5/3 trials')).toBe(80);
    expect(goalTarget('DISCRETE_TRIALS', 'respond in 4/5 trials')).toBe(80);
    expect(goalTarget('DISCRETE_TRIALS', 'respond in 3/4 trials')).toBe(75);
  });
  it('one episode that is not a number does not turn the duration summary into NaN (audit L17)', () => {
    const summary = summarizeDuration({ episodeSeconds: [60, 'x', 30, null as never, undefined as never], observationMinutes: '10' });
    expect(summary.totalSeconds).toBe(90);
    expect(Number.isFinite(summary.longestSeconds)).toBe(true);
    expect(Number.isFinite(summary.percentOfObservation as number)).toBe(true);
    void summarizeAbc;
  });
  it('a negative story part score is not assessed, not an assessed zero (audit L18)', () => {
    expect(storyPartScore(-1)).toBeNull();
    expect(storyPartScore(-2)).toBeNull();
    expect(storyPartScore(0)).toBe(0);
    expect(storyPartScore(2)).toBe(2);
    expect(storyPartScore(5)).toBe(2);
  });
});

describe('what a restore left out is described (audit M2)', () => {
  it('names each dropped record and settings block, with why, in one list', async () => {
    const { describeLeftOut } = await import('../backup');
    expect(describeLeftOut({})).toEqual([]);
    expect(describeLeftOut({
      droppedSettings: ['abcLists'],
      droppedRecords: [
        { kind: 'goal', id: 'g2, on student ava', reason: 'goal type "X" is not known' },
        { kind: 'goalTemplate', id: 't1', reason: 'createdAt is not a valid date' },
        { kind: 'sessionGoal', id: 'g3, in session s1', reason: 'goal type "Y" is not known' },
      ],
    })).toEqual([
      'the ABC lists settings',
      'a goal (g2, on student ava: goal type "X" is not known)',
      'a goal template (t1: createdAt is not a valid date)',
      'a goal in a session (g3, in session s1: goal type "Y" is not known)',
    ]);
  });
});
