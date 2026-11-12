import { describe, expect, it } from 'vitest';
import {
  MAX_BACKUP_FILE_BYTES, backupFileText, canonicalJson, computeBackupChecksum, createBackup, decryptBackupText,
  parseBackup, sha256Hex, sha256HexSync,
} from '../backup';
import { session } from './helpers';
import type { GoalTemplate, Student } from '../types';

const student = (id: string, goalIds: string[] = [], createdAt = '2026-01-01'): Student =>
  ({ id, name: id, userId: 'u', createdAt, goals: goalIds.map(g => ({ id: g, name: g, type: 'ARTICULATION', smartGoal: '' })) }) as unknown as Student;
const template = (id: string, createdAt: unknown = new Date('2026-01-01T00:00:00.000Z')) =>
  ({ id, name: id, type: 'ARTICULATION', createdAt }) as unknown as GoalTemplate;
const data = () => ({ students: [student('ava', ['g1'])], goalTemplates: [template('t1')], sessions: [session({ sessionId: 'x1' })] });
/** A backup file without a checksum (as older versions wrote it). */
const legacyText = () => JSON.stringify(createBackup(data()));
/** The same backup with one top-level change applied to its parsed JSON. */
const mutateLegacy = (fn: (json: any) => void) => {
  const json = JSON.parse(legacyText());
  fn(json);
  return JSON.stringify(json);
};

describe('backup checksum', () => {
  it('hashes the canonical payload the same way in both implementations', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256HexSync('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256HexSync('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    const payload = data();
    expect(await computeBackupChecksum(payload)).toBe(sha256HexSync(canonicalJson({ data: payload })));
  });

  it('accepts a backup written with a checksum', async () => {
    const parsed = parseBackup(await backupFileText(createBackup(data())));
    expect(parsed.data.students[0].id).toBe('ava');
    expect(typeof parsed.checksum).toBe('string');
    expect(parsed.droppedSettings).toEqual([]);
    expect(parsed.droppedRecords).toEqual([]);
    expect(parsed.strippedUnknownFields).toBe(false);
  });

  it('rejects a tampered student, session, or settings block', async () => {
    const withSettings = createBackup(data(), { studentGroups: [{ id: 'grp', name: 'Group', studentIds: ['ava'] }] });
    const tamper = async (fn: (json: any) => void) => {
      const json = JSON.parse(await backupFileText(withSettings));
      fn(json);
      return JSON.stringify(json);
    };
    const tamperedStudent = await tamper(j => { j.data.students[0].name = 'mallory'; });
    const tamperedSession = await tamper(j => { j.data.sessions[0].date = '2026-01-02'; });
    const tamperedSettings = await tamper(j => { j.settings.studentGroups[0].name = 'Other'; });
    expect(() => parseBackup(tamperedStudent)).toThrow(/checksum/);
    expect(() => parseBackup(tamperedSession)).toThrow(/checksum/);
    expect(() => parseBackup(tamperedSettings)).toThrow(/checksum/);
  });

  it('restores a legacy backup with no checksum', () => {
    expect(parseBackup(legacyText()).data.students[0].id).toBe('ava');
  });

  it('round-trips a password-protected backup and rejects a tampered decrypted payload', async () => {
    const text = await backupFileText(createBackup(data()), 'secret-pass');
    const decrypted = await decryptBackupText(text, 'secret-pass');
    expect(parseBackup(decrypted).data.students[0].id).toBe('ava');
    const json = JSON.parse(decrypted);
    json.data.students[0].name = 'mallory';
    expect(() => parseBackup(JSON.stringify(json))).toThrow(/checksum/);
  }, 20000);
});

describe('backup version and exportedAt', () => {
  it('rejects version 0 and non-integer versions, and version above the supported one', () => {
    expect(() => parseBackup(mutateLegacy(j => { j.version = 0; }))).toThrow(/invalid version/);
    expect(() => parseBackup(mutateLegacy(j => { j.version = 1.5; }))).toThrow(/not an AscendEd backup/);
    expect(() => parseBackup(mutateLegacy(j => { j.version = 2; }))).toThrow(/newer version/);
  });

  it('rejects a missing or invalid exportedAt', () => {
    expect(() => parseBackup(mutateLegacy(j => { j.exportedAt = 'not-a-date'; }))).toThrow(/export date/);
    expect(() => parseBackup(mutateLegacy(j => { delete j.exportedAt; }))).toThrow(/not an AscendEd backup/);
  });
});

describe('backup createdAt and date validation', () => {
  it('drops a template with an invalid createdAt and reports it, never storing Invalid Date', () => {
    const parsed = parseBackup(mutateLegacy(j => {
      j.data.goalTemplates.push({ id: 'bad', name: 'Bad', type: 'ARTICULATION', createdAt: 'garbage' });
    }));
    expect(parsed.data.goalTemplates.map(t => t.id)).toEqual(['t1']);
    expect(parsed.droppedRecords).toEqual([{ kind: 'goalTemplate', id: 'bad', reason: 'createdAt is not a valid date' }]);
    expect(parsed.data.goalTemplates.every(t => !Number.isNaN(t.createdAt.getTime()))).toBe(true);
  });

  it('backfills a missing template createdAt from the export date', () => {
    const text = legacyText();
    const exportedAt = (JSON.parse(text) as { exportedAt: string }).exportedAt;
    const json = JSON.parse(text);
    delete json.data.goalTemplates[0].createdAt;
    const parsed = parseBackup(JSON.stringify(json));
    expect(parsed.data.goalTemplates[0].createdAt).toBeInstanceOf(Date);
    expect(parsed.data.goalTemplates[0].createdAt.toISOString()).toBe(exportedAt);
    expect(parsed.droppedRecords).toEqual([]);
  });

  it('keeps a template or student whose createdAt is null (an invalid Date saved by an older app), backfilled from the export date', () => {
    const text = legacyText();
    const exportedAt = (JSON.parse(text) as { exportedAt: string }).exportedAt;
    const json = JSON.parse(text);
    json.data.goalTemplates[0].createdAt = null;
    json.data.students[0].createdAt = null;
    const parsed = parseBackup(JSON.stringify(json));
    expect(parsed.data.goalTemplates.map(t => t.id)).toEqual(['t1']);
    expect(parsed.data.goalTemplates[0].createdAt.toISOString()).toBe(exportedAt);
    expect(parsed.data.students.map(s => s.id)).toEqual(['ava']);
    expect(parsed.data.students[0].createdAt).toBe(exportedAt);
    expect(parsed.droppedRecords).toEqual([]);
  });

  it('drops a student with an invalid createdAt and a session with an invalid date', () => {
    const parsed = parseBackup(mutateLegacy(j => {
      j.data.students.push({ id: 'bad', name: 'Bad', goals: [], createdAt: 'garbage' });
      j.data.sessions.push({ sessionId: 'bad', studentId: 'ava', date: 'not-a-date' });
    }));
    expect(parsed.data.students.map(s => s.id)).toEqual(['ava']);
    expect(parsed.data.sessions.map(s => s.sessionId)).toEqual(['x1']);
    expect(parsed.droppedRecords).toEqual([
      { kind: 'student', id: 'bad', reason: 'createdAt is not a valid date' },
      { kind: 'session', id: 'bad', reason: 'date is not a valid date' },
    ]);
  });
});

describe('backup shape validation and dropped settings', () => {
  it('strips unknown fields and says so', () => {
    const parsed = parseBackup(mutateLegacy(j => {
      j.data.students[0].surprise = true;
      j.data.students[0].goals[0].surprise = true;
      j.data.goalTemplates[0].surprise = true;
      j.data.sessions[0].surprise = true;
    }));
    expect((parsed.data.students[0] as any).surprise).toBeUndefined();
    expect((parsed.data.students[0].goals[0] as any).surprise).toBeUndefined();
    expect((parsed.data.goalTemplates[0] as any).surprise).toBeUndefined();
    expect((parsed.data.sessions[0] as any).surprise).toBeUndefined();
    expect(parsed.strippedUnknownFields).toBe(true);
  });

  it('reports a damaged ABC lists block and keeps the good student groups', () => {
    const parsed = parseBackup(mutateLegacy(j => {
      j.settings = {
        abcLists: { antecedents: 'not-an-array', behaviors: [], consequences: [] },
        studentGroups: [{ id: 'grp', name: 'Group', studentIds: ['ava'] }],
      };
    }));
    expect(parsed.droppedSettings).toEqual(['abcLists']);
    expect(parsed.settings?.studentGroups?.[0].name).toBe('Group');
    expect(parsed.settings?.abcLists).toBeUndefined();
  });

  it('reports a settings value that is not an object at all', () => {
    const parsed = parseBackup(mutateLegacy(j => { j.settings = 'junk'; }));
    expect(parsed.droppedSettings).toEqual(['settings']);
    expect(parsed.settings).toBeUndefined();
  });

  it('rejects a record missing a required id', () => {
    expect(() => parseBackup(mutateLegacy(j => { delete j.data.students[0].id; }))).toThrow(/not an AscendEd backup/);
  });
});

describe('fields this version does not know', () => {
  it('restores a backup whose records carry an extra field, instead of calling it damaged', async () => {
    const extra = { ...data(), students: [{ ...student('ava', ['g1']), goals: [{ id: 'g1', name: 'g1', type: 'ARTICULATION', smartGoal: '', addedLater: 'x' }] } as unknown as Student] };
    const parsed = parseBackup(await backupFileText(createBackup(extra)));
    expect(parsed.data.students[0].id).toBe('ava');
  });
  it('still rejects a file that was changed after it was written', async () => {
    const text = await backupFileText(createBackup(data()));
    expect(() => parseBackup(text.replace('"name":"ava"', '"name":"eve"'))).toThrow(/damaged/);
  });
});

describe('backup file size limit', () => {
  it('writes a backup of 3,000 sessions that can be restored', async () => {
    const goals = ['g1', 'g2', 'g3', 'g4'];
    const sessions = Array.from({ length: 3000 }, (_, i) => session({
      sessionId: `s${i}`, studentId: 'ava', notes: 'Worked on sounds in words.',
      originalGoalHeaders: goals.map(g => ({ id: g, name: g, type: 'ARTICULATION', smartGoal: 'Ava will produce the sound in words with 80% accuracy.' })) as any,
      goals: goals.map(g => ({ goalId: g, goalName: g, goalType: 'ARTICULATION', data: { correct: 8, incorrect: 2, approximate: 0, recorded: true } })),
    }));
    const text = await backupFileText(createBackup({ students: [student('ava', goals)], goalTemplates: [], sessions }));
    expect(text).not.toContain('\n'); // compact: indenting roughly doubled the file
    expect(new TextEncoder().encode(text).length).toBeLessThan(MAX_BACKUP_FILE_BYTES / 4);
    expect(parseBackup(text).data.sessions).toHaveLength(3000);
  }, 30000);

  it('refuses to write a backup too large to restore, instead of saving one that can never be read', async () => {
    const huge = createBackup({ students: [student('ava')], goalTemplates: [], sessions: [session({ sessionId: 'x', notes: 'n'.repeat(MAX_BACKUP_FILE_BYTES) })] });
    await expect(backupFileText(huge)).rejects.toThrow(/too large to restore/);
  }, 30000);

  it('refuses a password-protected backup whose encrypted form exceeds the limit, even when the plaintext fits', async () => {
    // Plaintext is under the limit, but base64 encryption expands it by about a
    // third, so the file actually written would pass the restore limit.
    const big = createBackup({ students: [student('ava')], goalTemplates: [], sessions: [session({ sessionId: 'x', notes: 'n'.repeat(Math.floor(MAX_BACKUP_FILE_BYTES * 0.78)) })] });
    await expect(backupFileText(big, 'secret-pass')).rejects.toThrow(/too large to restore/);
  }, 30000);

  it('rejects files over the size limit before parsing', () => {
    const text = legacyText();
    const over = text + ' '.repeat(MAX_BACKUP_FILE_BYTES - text.length + 1);
    expect(new TextEncoder().encode(over).length).toBeGreaterThan(MAX_BACKUP_FILE_BYTES);
    expect(() => parseBackup(over)).toThrow(/too large/);
  });

  it('accepts a file just under the size limit', () => {
    const text = legacyText();
    const under = text + ' '.repeat(MAX_BACKUP_FILE_BYTES - text.length - 1);
    expect(parseBackup(under).data.students[0].id).toBe('ava');
  });
});
