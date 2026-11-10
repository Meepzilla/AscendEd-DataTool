import { describe, expect, it } from 'vitest';
import { planSessionImport, type ImportedSession } from '../session-import';
import { session } from './helpers';
import type { Student } from '../types';

const students = [{
  id: 'st1', name: 'Ava', userId: 'u', createdAt: '2026-01-01', goals: [
    { id: 'g1', name: 'Say hi', type: 'ARTICULATION', smartGoal: '' },
  ],
}] as unknown as Student[];

const base: ImportedSession = {
  studentId: 'st1', studentName: 'Ava', date: '2026-10-05', time: '09:00', endTime: '09:30',
  activity: 'cards', notes: 'good session', originalGoalHeaders: [],
  goals: [{ goalId: 'g1', goalName: 'Say hi', goalType: 'ARTICULATION', data: { correct: 3 } }],
};

describe('planSessionImport dedup', () => {
  it('recognizes a session entered in the app when its exported, date-only copy comes back (America/Los_Angeles)', () => {
    // Entered on 5 October at 9:00 Pacific, so stored as a full timestamp; the CSV carries just "2026-10-05".
    const stored = new Date(2026, 9, 5, 9, 0).toISOString();
    const current = [session({ studentId: 'st1', studentName: 'Ava', date: stored, time: '09:00', endTime: '09:30', activity: 'cards', notes: 'good session', goals: [{ goalId: 'g1', goalName: 'Say hi', goalType: 'ARTICULATION', data: { correct: 3 } }] })];
    const plan = planSessionImport(students, current, [base], 'u');
    expect(plan.duplicateCount).toBe(1);
    expect(plan.newCount).toBe(0);
  });
  it('imports the same session twice only once', () => {
    const plan = planSessionImport(students, [], [base, base], 'u');
    expect(plan.newCount).toBe(1);
    expect(plan.duplicateCount).toBe(1);
  });
  it('treats a different end time as a different session', () => {
    const current = [session({ studentId: 'st1', studentName: 'Ava', date: '2026-10-05', time: '09:00', endTime: '09:30', activity: 'cards', notes: 'good session', goals: [{ goalId: 'g1', goalName: 'Say hi', goalType: 'ARTICULATION', data: { correct: 3 } }] })];
    const plan = planSessionImport(students, current, [{ ...base, endTime: '10:00' }], 'u');
    expect(plan.newCount).toBe(1);
    expect(plan.duplicateCount).toBe(0);
  });
  it('treats a different activity as a different session', () => {
    const current = [session({ studentId: 'st1', studentName: 'Ava', date: '2026-10-05', time: '09:00', endTime: '09:30', activity: 'cards', notes: 'good session', goals: [{ goalId: 'g1', goalName: 'Say hi', goalType: 'ARTICULATION', data: { correct: 3 } }] })];
    const plan = planSessionImport(students, current, [{ ...base, activity: 'game' }], 'u');
    expect(plan.newCount).toBe(1);
    expect(plan.duplicateCount).toBe(0);
  });
  it('treats a missed session as different from the held one with the same times', () => {
    const current = [session({ studentId: 'st1', studentName: 'Ava', date: '2026-10-05', time: '09:00', endTime: '09:30', activity: 'cards', notes: 'good session', goals: [{ goalId: 'g1', goalName: 'Say hi', goalType: 'ARTICULATION', data: { correct: 3 } }] })];
    const plan = planSessionImport(students, current, [{ ...base, missed: { reason: 'student-absent' } }], 'u');
    expect(plan.newCount).toBe(1);
    expect(plan.duplicateCount).toBe(0);
  });
  it('still drops an exact duplicate, including the missed status', () => {
    const current = [session({ studentId: 'st1', studentName: 'Ava', date: '2026-10-05', time: '09:00', endTime: '09:30', activity: 'cards', notes: 'good session', missed: { reason: 'student-absent' }, goals: [] })];
    const plan = planSessionImport(students, current, [{ ...base, goals: [], missed: { reason: 'student-absent' } }], 'u');
    expect(plan.newCount).toBe(0);
    expect(plan.duplicateCount).toBe(1);
  });
});
