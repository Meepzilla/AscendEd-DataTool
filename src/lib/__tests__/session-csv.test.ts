import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { buildSessionsCsv, deidentifiedSessionRows, sessionsCsvFileName, unescapeCsvFormula } from '../session-csv';
import { isPlaintextBackupAcknowledged, PLAINTEXT_BACKUP_ACKNOWLEDGEMENT } from '../backup';
import { session } from './helpers';

const deidentified = () => buildSessionsCsv(
  [session({
    sessionId: 's1', studentId: 'st1', studentName: 'Ava Example', date: '2026-10-05', time: '09:00', endTime: '09:30',
    activity: 'Circle time game', notes: 'Ava was very chatty today, asked for mom.',
    goals: [{
      goalId: 'g1', goalName: 'Say two-word phrases', goalType: 'LANGUAGE_EXPRESSION',
      data: { correct: 4, incorrect: 1, promptLevel: 'verbal prompt', observation: 'She smiled a lot' },
    }],
  })],
  'Ava Example',
  { deidentified: true },
  new Date('2026-11-06T12:00:00'),
);

describe('de-identified session CSV', () => {
  it('has no student name, notes, activity, goal name, or free-text goal data', () => {
    const { csv } = deidentified();
    expect(csv).not.toContain('Ava Example');
    expect(csv).not.toContain('chatty');
    expect(csv).not.toContain('Circle time');
    expect(csv).not.toContain('Say two-word phrases');
    expect(csv).not.toContain('verbal prompt');
    expect(csv).not.toContain('smiled');
    expect(csv).not.toContain('Student Name');
    expect(csv).not.toContain('Session Notes');
    expect(csv).not.toContain('Activity');
    expect(csv).not.toContain('Goal Name');
  });

  it('keeps IDs, dates, minutes, and numeric goal measures', () => {
    const { csv } = deidentified();
    const rows = Papa.parse<Record<string, string>>(csv, { header: true }).data;
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row['Session ID']).toBe('s1');
    expect(row['Student ID']).toBe('st1');
    expect(row['Goal ID']).toBe('g1');
    expect(row['Goal Type']).toBe('LANGUAGE_EXPRESSION');
    expect(row['Date']).toContain('2026');
    expect(row['Minutes']).toBe('30');
    expect(row['Goal Data: correct']).toBe('4');
    expect(row['Goal Data: incorrect']).toBe('1');
    expect(row['Attendance']).toBe('Held');
  });

  it('names the file without the student name', () => {
    const { fileName } = deidentified();
    expect(fileName).toBe('sessions_deidentified_2026-11-06.csv');
    expect(fileName).not.toContain('ava');
    expect(sessionsCsvFileName('Ava Example', { deidentified: true }, new Date('2026-11-06T12:00:00')))
      .toBe('sessions_deidentified_2026-11-06.csv');
  });

  it('still exports a row for a session with no goals, and a missed session without its note', () => {
    const rows = deidentifiedSessionRows([
      session({ sessionId: 's2', studentId: 'st1', studentName: 'Ava Example', goals: [] }),
      session({
        sessionId: 's3', studentId: 'st1', studentName: 'Ava Example', goals: [],
        missed: { reason: 'student-absent', note: 'Home sick with a fever, mom called.' },
      }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]['Student Name']).toBeUndefined();
    expect(rows[1]['Attendance']).toBe('Missed: Student absent');
    expect(JSON.stringify(rows)).not.toContain('fever');
    expect(JSON.stringify(rows)).not.toContain('Ava Example');
  });

  it('identified export (the default) is unchanged: name and notes stay in, file is named for the student', () => {
    const { csv, fileName } = buildSessionsCsv(
      [session({ studentName: 'Ava Example', notes: 'Ava was chatty.' })],
      'Ava Example',
      {},
      new Date('2026-11-06T12:00:00'),
    );
    expect(csv).toContain('Ava Example');
    expect(csv).toContain('Ava was chatty.');
    expect(fileName).toBe('sessions_ava_example_2026-11-06.csv');
  });

  it('exports the stored date on the right day, not a day early', () => {
    const { csv } = buildSessionsCsv(
      [session({ date: '2026-10-05', time: '09:00', endTime: '09:30', goals: [] })],
      'Ava Example',
      {},
      new Date('2026-11-06T12:00:00'),
    );
    const rows = Papa.parse<Record<string, string>>(csv, { header: true }).data;
    expect(rows).toHaveLength(1);
    // In America/Los_Angeles the old formatDate read "2026-10-05" as UTC midnight: Oct 4.
    expect(rows[0]['Date']).toBe('Oct 5, 2026');
    const deidentifiedRows = deidentifiedSessionRows([session({ date: '2026-10-05', goals: [] })]);
    expect(deidentifiedRows[0]['Date']).toBe('Oct 5, 2026');
  });
});

describe('plaintext backup acknowledgement', () => {
  it('accepts the confirmation word, case-insensitively and with surrounding space', () => {
    expect(PLAINTEXT_BACKUP_ACKNOWLEDGEMENT).toBe('PLAINTEXT');
    expect(isPlaintextBackupAcknowledged('PLAINTEXT')).toBe(true);
    expect(isPlaintextBackupAcknowledged('plaintext')).toBe(true);
    expect(isPlaintextBackupAcknowledged('  Plaintext  ')).toBe(true);
  });

  it('rejects anything that is not the word', () => {
    expect(isPlaintextBackupAcknowledged('')).toBe(false);
    expect(isPlaintextBackupAcknowledged('PLAIN')).toBe(false);
    expect(isPlaintextBackupAcknowledged('PLAINTEXT!')).toBe(false);
    expect(isPlaintextBackupAcknowledged('yes')).toBe(false);
  });
});

describe('CSV formula injection (CWE-1236)', () => {
  it('writes formula-like text as text, and leaves numbers alone', () => {
    const s = session({ notes: '=HYPERLINK("http://example.com","click")', activity: '-cmd|calc', goals: [{ goalId: 'g', goalName: '@SUM(A1)', goalType: 'GOAL_ATTAINMENT_SCALE', data: { gasLevel: -1 } }] });
    const { csv } = buildSessionsCsv([s], 'Ava');
    expect(csv).toContain(`"'=HYPERLINK(""http://example.com"",""click"")"`);
    expect(csv).toContain(`"'-cmd|calc"`);
    expect(csv).toContain(`"'@SUM(A1)"`);
    expect(csv).not.toMatch(/,=|,@|,\+/);
    expect(csv).toMatch(/,-1(,|\r?\n|$)/); // a GAS level of -1 stays a number
  });

  it('comes back unchanged when the CSV is imported again', () => {
    const notes = '=1+2 and +plus, -minus @at';
    const { csv } = buildSessionsCsv([session({ notes, activity: 'plain words' })], 'Ava');
    const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true, transform: (v: string) => unescapeCsvFormula(v) }).data;
    expect(rows[0]['Session Notes']).toBe(notes);
    expect(rows[0]['Activity']).toBe('plain words');
    expect(unescapeCsvFormula("'plain")).toBe("'plain"); // an apostrophe the user typed stays
  });
});
