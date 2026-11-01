import { describe, expect, it } from 'vitest';
import { dueSoon, serviceStatus } from '../dashboard';
import { session } from './helpers';
import type { Student } from '../types';

const student = (id: string, name: string, iep: Student['iep'] = {}, extra: Partial<Student> = {}) => ({ id, name, iep, ...extra }) as Student;
const NOW = new Date(2026, 9, 29, 12, 0); // Thursday 29 October 2026; the week is 26 Oct to 1 Nov
// A session on a local date, 30 minutes unless given.
const on = (studentId: string, y: number, m: number, d: number, endTime = '09:30') =>
  session({ studentId, date: new Date(y, m, d, 9, 0).toISOString(), time: '09:00', endTime });

describe('dueSoon', () => {
  it('lists reviews that are overdue or due within 60 days, most overdue first, and skips the rest', () => {
    const items = dueSoon([
      student('a', 'Ava', { annualReviewDate: '2026-11-20', reevaluationDate: '2027-03-01' }),
      student('b', 'Ben', { annualReviewDate: '2026-10-20' }),
      student('c', 'Cam', { reevaluationDate: '2026-12-28' }), // 60 days: in
      student('d', 'Dee', { annualReviewDate: '2026-12-29' }), // 61 days: out
    ], NOW);
    expect(items.map(i => [i.studentName, i.kind, i.days])).toEqual([
      ['Ben', 'Annual review', -9],
      ['Ava', 'Annual review', 22],
      ['Cam', 'Re-evaluation', 60],
    ]);
  });
  it('ignores archived students and students without dates, and keeps a student\'s two dates apart', () => {
    const items = dueSoon([
      student('a', 'Ava', { annualReviewDate: '2026-11-01', reevaluationDate: '2026-11-15' }),
      student('b', 'Ben', { annualReviewDate: '2026-11-01' }, { isArchived: true }),
      student('c', 'Cam'),
    ], NOW);
    expect(items.map(i => [i.studentName, i.kind])).toEqual([['Ava', 'Annual review'], ['Ava', 'Re-evaluation']]);
  });
});

describe('serviceStatus (weekly requirement)', () => {
  const iep = { serviceMinutes: 60, servicePer: 'week' as const };
  it('lists students who still need minutes this week, with what is left and the days left', () => {
    const { tracked, behind } = serviceStatus(
      [student('a', 'Ava', iep), student('b', 'Ben', iep)],
      [on('a', 2026, 9, 27), on('b', 2026, 9, 27, '10:00'), on('b', 2026, 9, 28, '10:00')], // this week: Ava 30, Ben 120
      NOW,
    );
    expect(tracked).toBe(2);
    expect(behind).toHaveLength(1);
    expect(behind[0]).toMatchObject({ studentName: 'Ava', kind: 'needed', delivered: 30, minutes: 30, daysLeft: 4 }); // Thu, Fri, Sat, Sun
  });
  it('puts students who were short last week first, then the most minutes left', () => {
    const { behind } = serviceStatus(
      [student('a', 'Ava', iep), student('b', 'Ben', iep), student('c', 'Cam', iep)],
      [
        on('a', 2026, 9, 20, '10:00'), on('a', 2026, 9, 21, '10:00'), // Ava met last week (120), nothing yet this week
        on('b', 2026, 9, 21), // Ben: 30 last week, nothing this week
        on('c', 2026, 9, 20, '10:00'), on('c', 2026, 9, 21, '10:00'), on('c', 2026, 9, 27), // Cam met last week, 30 this week
      ],
      NOW,
    );
    expect(behind.map(i => [i.studentName, i.minutes, i.lastShort])).toEqual([['Ben', 60, 30], ['Ava', 60, 0], ['Cam', 30, 0]]);
  });
  it('doesn\'t count missed sessions or sessions without start and end times, or other students\' sessions', () => {
    const { behind } = serviceStatus(
      [student('a', 'Ava', iep)],
      [
        { ...on('a', 2026, 9, 27, '10:00'), missed: { reason: 'student-absent' } },
        { ...on('a', 2026, 9, 27), endTime: '' },
        on('b', 2026, 9, 27, '10:00'),
      ],
      NOW,
    );
    expect(behind[0]).toMatchObject({ delivered: 0, minutes: 60 });
  });
  it('skips students without required minutes, and archived students', () => {
    const { tracked, behind } = serviceStatus([student('a', 'Ava'), student('b', 'Ben', iep, { isArchived: true }), student('c', 'Cam', { serviceMinutes: 0 })], [], NOW);
    expect(tracked).toBe(0);
    expect(behind).toEqual([]);
  });
  it('uses the calendar month for a monthly requirement', () => {
    const { behind } = serviceStatus(
      [student('a', 'Ava', { serviceMinutes: 120, servicePer: 'month' })],
      [on('a', 2026, 9, 5, '10:00'), on('a', 2026, 8, 20, '11:00')], // 60 in October, 120 in September
      NOW,
    );
    expect(behind[0]).toMatchObject({ kind: 'needed', minutes: 60, lastShort: 0, daysLeft: 3 }); // 29, 30, 31 October
  });
});

describe('serviceStatus (school-year requirement)', () => {
  const iep = { serviceMinutes: 1200, servicePer: 'year' as const };
  it('compares with an even pace through the school year (1 August to 31 July)', () => {
    // 29 October is 89 of 365 days in, so the pace is about 293 minutes.
    const { behind } = serviceStatus(
      [student('a', 'Ava', iep), student('b', 'Ben', iep)],
      [on('b', 2026, 8, 1, '17:00')], // Ben has 480
      NOW,
    );
    expect(behind).toHaveLength(1);
    expect(behind[0].studentName).toBe('Ava');
    expect(behind[0]).toMatchObject({ kind: 'pace', delivered: 0, lastShort: 0, daysLeft: 0 });
    expect(behind[0].minutes).toBeGreaterThan(280);
    expect(behind[0].minutes).toBeLessThan(305);
  });
});
