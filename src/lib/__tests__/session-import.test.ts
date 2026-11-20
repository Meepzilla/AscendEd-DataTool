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
  it('does not match an unnamed student or goal when importing a de-identified session without names', () => {
    const unnamedStudents = [{
      id: 'st-empty', name: '   ', userId: 'u', createdAt: '2026-01-01', goals: [
        { id: 'g-empty', name: '', type: 'ARTICULATION', smartGoal: '' },
      ],
    }] as unknown as Student[];
    // Unknown studentId + empty studentName must not match st-empty by empty name
    const unmatchedDeidentified: ImportedSession = {
      studentId: 'st-other', studentName: '', date: '2026-10-05', time: '09:00', endTime: '09:30',
      activity: 'cards', notes: '', originalGoalHeaders: [],
      goals: [{ goalId: 'g-new', goalName: '', goalType: 'ARTICULATION', data: { correct: 3 } }],
    };
    expect(planSessionImport(unnamedStudents, [], [unmatchedDeidentified], 'u').unmatchedCount).toBe(1);

    // Known studentId + unknown goalId + empty goalName must not match g-empty by empty name, and gets fallback name
    const matchedStudentDeidentified: ImportedSession = {
      studentId: 'st-empty', studentName: '', date: '2026-10-05', time: '09:00', endTime: '09:30',
      activity: 'cards', notes: '', originalGoalHeaders: [],
      goals: [{ goalId: 'g-new', goalName: '', goalType: 'ARTICULATION', data: { correct: 3 } }],
    };
    const plan = planSessionImport(unnamedStudents, [], [matchedStudentDeidentified], 'u');
    expect(plan.addedGoalCount).toBe(1);
    expect(plan.students[0].goals).toHaveLength(2);
    expect(plan.students[0].goals[1]).toMatchObject({ id: 'g-new', name: 'ARTICULATION' });
  });

  it('round-trips Data Capture Type and de-identified CSV exports through parseSessionCsvRows and planSessionImport', async () => {
    const Papa = (await import('papaparse')).default;
    const { buildSessionsCsv, unescapeCsvFormula } = await import('../session-csv');
    const { parseSessionCsvRows } = await import('../session-import');

    const exportedSession = session({
      sessionId: 'sess-capture-1',
      studentId: 'st1',
      studentName: 'Ava',
      date: '2026-10-08',
      time: '10:00',
      endTime: '10:30',
      originalGoalHeaders: [
        { id: 'g-custom', name: 'Social via GAS', type: 'LANGUAGE_EXPRESSION', dataCaptureType: 'GOAL_ATTAINMENT_SCALE', smartGoal: '' },
      ],
      goals: [
        { goalId: 'g-custom', goalName: 'Social via GAS', goalType: 'LANGUAGE_EXPRESSION', data: { gasLevel: 1, recorded: true } },
      ],
    });

    // Identified export preserves Data Capture Type on synthesized student goal
    const { csv: identifiedCsv } = buildSessionsCsv([exportedSession], 'Ava');
    const identifiedRows = Papa.parse<Record<string, string>>(identifiedCsv, {
      header: true,
      skipEmptyLines: true,
      transform: (v: string) => unescapeCsvFormula(v),
    }).data;
    const parsedIdentified = parseSessionCsvRows(identifiedRows);
    expect(parsedIdentified).toHaveLength(1);
    expect(parsedIdentified[0].goals[0].dataCaptureType).toBe('GOAL_ATTAINMENT_SCALE');
    const planIdentified = planSessionImport(students, [], parsedIdentified, 'u');
    expect(planIdentified.newCount).toBe(1);
    expect(planIdentified.addedGoalCount).toBe(1);
    expect(planIdentified.students[0].goals.find(g => g.id === 'g-custom')).toMatchObject({
      type: 'LANGUAGE_EXPRESSION',
      dataCaptureType: 'GOAL_ATTAINMENT_SCALE',
    });

    // De-identified export (no Student Name / Goal Name) parses and imports cleanly by IDs
    const { csv: deidCsv } = buildSessionsCsv([exportedSession], 'Ava', { deidentified: true });
    const deidRows = Papa.parse<Record<string, string>>(deidCsv, {
      header: true,
      skipEmptyLines: true,
      transform: (v: string) => unescapeCsvFormula(v),
    }).data;
    const parsedDeid = parseSessionCsvRows(deidRows);
    expect(parsedDeid).toHaveLength(1);
    expect(parsedDeid[0].studentId).toBe('st1');
    expect(parsedDeid[0].goals[0]).toMatchObject({
      goalId: 'g-custom',
      goalType: 'LANGUAGE_EXPRESSION',
      dataCaptureType: 'GOAL_ATTAINMENT_SCALE',
      data: { gasLevel: 1, recorded: true },
    });
    const planDeid = planSessionImport(students, [], parsedDeid, 'u');
    expect(planDeid.newCount).toBe(1);
    expect(planDeid.students[0].goals.find(g => g.id === 'g-custom')?.dataCaptureType).toBe('GOAL_ATTAINMENT_SCALE');
  });
});

