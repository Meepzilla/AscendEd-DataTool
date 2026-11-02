import { describe, expect, it } from 'vitest';
import { goalStatement } from '../helpers';
import { placeholderKey, replacePlaceholders } from '../goal-placeholders';

const iep = { iepDate: '2026-10-29', annualReviewDate: '2027-10-28', reevaluationDate: '2028-03-01', serviceMinutes: 120, servicePer: 'month' as const };
const goal = (smartGoal: string, extra: Record<string, unknown> = {}) =>
  ({ smartGoal, type: 'ARTICULATION', sessionTargetValue: 80, targetDate: '2027-06-30', masterySessions: undefined, blankFills: undefined, ...extra }) as Parameters<typeof goalStatement>[0];

describe('placeholders in goal text', () => {
  it('fills in the student, dates, target, opportunities and mastery', () => {
    expect(goalStatement(goal('By [date], [student] will produce /s/ with [target] accuracy in [opportunities] opportunities across [sessions] consecutive sessions.'), 'Ava Smith', iep))
      .toBe('By Jun 30, 2027, Ava will produce /s/ with 80% accuracy in 4 out of 5 opportunities across 3 consecutive sessions.');
  });

  it('fills in IEP details, the full name and the baseline', () => {
    expect(goalStatement(goal('[full name] ([baseline] on [baseline date]) gets [service minutes]; review [annual review], IEP [IEP date], re-evaluation [re-evaluation].', { baseline: 40, baselineDate: '2026-09-01' }), 'Ava Smith', iep))
      .toBe('Ava Smith (40% on Sep 1, 2026) gets 120 minutes per month; review Oct 28, 2027, IEP Oct 29, 2026, re-evaluation Mar 1, 2028.');
  });

  it('reads "the student" in a template, capitalised at the start of a sentence', () => {
    expect(goalStatement(goal('[student] will request help. By [date], [student] will comment.'))).toBe('The student will request help. By Jun 30, 2027, the student will comment.');
  });

  it('uses the annual review for [date] when the goal has no target date, and leaves unset or unknown ones as typed', () => {
    expect(goalStatement(goal('By [date].', { targetDate: undefined }), 'Ava', iep)).toBe('By Oct 28, 2027.');
    expect(goalStatement(goal('By [date] with [baseline] and [colour].', { targetDate: undefined }), 'Ava')).toBe('By [date] with [baseline] and [colour].');
  });

  it('gives counts and ratings as plain numbers, and no fraction for them', () => {
    const counts = goal('at least [target] times in [opportunities]', { type: 'BEHAVIOR_FREQUENCY', targetDirection: 'increase', sessionTargetValue: 5 });
    expect(goalStatement(counts, 'Ava')).toBe('at least 5 times in [opportunities]');
    expect(goalStatement(goal('[target] functions', { type: 'COMMUNICATION_FUNCTIONS', sessionTargetValue: 3 }))).toBe('3 functions');
  });

  it('accepts other spellings, any case, and spaces or underscores', () => {
    expect(['Student', ' NAME ', 'first_name', 'Target Date', 'IEP end date', 'reevaluation', 'Mastery'].map(placeholderKey))
      .toEqual(['student', 'student', 'student', 'date', 'annualReview', 'reevaluation', 'mastery']);
    expect(replacePlaceholders('[Student] and [ STUDENT ]', () => 'Ava')).toBe('Ava and Ava');
  });
});
