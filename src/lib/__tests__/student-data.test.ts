import { describe, expect, it } from 'vitest';
import { prepareLoadedData } from '../data-migrations';
import { planSessionImport, type ImportedSession } from '../session-import';
import { planRestore } from '../restore';
import { createBackup } from '../backup';
import { DEFAULT_GOAL_TEMPLATES } from '../goal-constants';
import { session } from './helpers';
import type { GoalTemplate, Student } from '../types';

const student = (id: string, name: string, goals: Student['goals'] = []) => ({ id, name, userId: 'u', createdAt: '2026-01-01', goals }) as Student;

describe('prepareLoadedData (app load)', () => {
  it('adds every built-in template on a new device, sorted by name, and asks to save them', () => {
    const prepared = prepareLoadedData([], [], 'u');
    expect(prepared.templates).toHaveLength(DEFAULT_GOAL_TEMPLATES.length);
    expect(prepared.templatesChanged).toBe(true);
    const names = prepared.templates.map(t => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(prepared.templates.every(t => t.defaultKey === t.name && t.isDefault)).toBe(true);
  });

  it('changes nothing on a second load', () => {
    const first = prepareLoadedData([student('s', 'Ava')], [], 'u');
    const second = prepareLoadedData(first.students, first.templates, 'u');
    expect(second.templatesChanged).toBe(false);
    expect(second.studentsChanged).toBe(false);
    expect(second.templates).toHaveLength(first.templates.length);
  });

  it('doesn\'t add a built-in template again after the user renamed it', () => {
    const first = prepareLoadedData([], [], 'u');
    const renamed = first.templates.map((t, i) => (i === 0 ? { ...t, name: 'My own name' } : t)) as GoalTemplate[];
    const second = prepareLoadedData([], renamed, 'u');
    expect(second.templates).toHaveLength(first.templates.length);
    expect(second.templates.some(t => t.name === 'My own name')).toBe(true);
  });

  it('sorts students by name', () => {
    expect(prepareLoadedData([student('b', 'Ben'), student('a', 'Ava')], [], 'u').students.map(s => s.name)).toEqual(['Ava', 'Ben']);
  });
});

describe('planSessionImport (CSV import)', () => {
  const ava = student('ava', 'Ava', [{ id: 'g1', name: 'Produce /s/', type: 'ARTICULATION', smartGoal: '' }]);
  const imported = (overrides: Partial<ImportedSession> = {}): ImportedSession => ({
    studentId: 'other-device-id', studentName: 'ava', date: '2026-10-01T09:00:00.000Z', time: '09:00', endTime: '09:30', activity: '', notes: '',
    goals: [{ goalId: 'other-goal-id', goalName: 'Produce /s/', goalType: 'ARTICULATION', data: { correct: 5 } }], originalGoalHeaders: [], ...overrides,
  });

  it('matches students by name and goals by name and type when ids differ', () => {
    const plan = planSessionImport([ava], [], [imported({ sourceSessionId: 'file-1' })], 'u');
    expect(plan.newCount).toBe(1);
    expect(plan.sessions[0]).toMatchObject({ sessionId: 'file-1', studentId: 'ava', studentName: 'Ava', userId: 'u' });
    expect(plan.sessions[0].goals[0].goalId).toBe('g1');
    expect(plan.addedGoalCount).toBe(0);
  });

  it('adds a goal the student doesn\'t have, and skips students not on the device', () => {
    const plan = planSessionImport([ava], [], [
      imported({ goals: [{ goalId: 'new-goal', goalName: 'Fluency', goalType: 'FLUENCY_SYLLABLE_STUTTER', data: {} }] }),
      imported({ studentId: 'x', studentName: 'Nobody' }),
    ], 'u');
    expect(plan.addedGoalCount).toBe(1);
    expect(plan.students[0].goals.map(g => g.id)).toEqual(['g1', 'new-goal']);
    expect(plan.unmatchedCount).toBe(1);
  });

  it('adds nothing when the same file is imported twice', () => {
    const first = planSessionImport([ava], [], [imported({ sourceSessionId: 'file-1' }), imported({ sourceSessionId: 'file-2', time: '10:00' })], 'u');
    const second = planSessionImport(first.students, first.sessions, [imported({ sourceSessionId: 'file-1' }), imported({ sourceSessionId: 'file-2', time: '10:00' })], 'u');
    expect(second.newCount).toBe(0);
    expect(second.duplicateCount).toBe(2);
  });

  it('doesn\'t change the lists it was given', () => {
    const students = [ava];
    planSessionImport(students, [], [imported({ goals: [{ goalId: 'n', goalName: 'New', goalType: 'AAC', data: {} }] })], 'u');
    expect(students[0].goals).toHaveLength(1);
  });
});

describe('planRestore (backups)', () => {
  const current = { students: [student('a', 'Ava')], goalTemplates: [], sessions: [session({ sessionId: 'x1' })] };
  const backup = createBackup({ students: [student('b', 'Ben'), student('a', 'Ava')], goalTemplates: [], sessions: [session({ sessionId: 'x2' })] });

  it('replace uses the backup\'s lists, sorted', () => {
    const { next, summary } = planRestore(current, backup, 'replace');
    expect(next.students.map(s => s.name)).toEqual(['Ava', 'Ben']);
    expect(next.sessions.map(s => s.sessionId)).toEqual(['x2']);
    expect(summary).toEqual({ students: 2, goalTemplates: 0, sessions: 1, goals: 0 });
  });

  it('merge keeps this device\'s records and adds the new ones', () => {
    const { next, summary } = planRestore(current, backup, 'merge');
    expect(next.students.map(s => s.id)).toEqual(['a', 'b']);
    expect(next.sessions.map(s => s.sessionId).sort()).toEqual(['x1', 'x2']);
    expect(summary).toMatchObject({ students: 1, sessions: 1 });
  });
});
