import { describe, expect, it } from 'vitest';
import { backupFileText, createBackup, decryptBackupText, isProtectedBackup, mergeBackupData, parseBackup } from '../backup';
import { session } from './helpers';
import type { Student } from '../types';

const student = (id: string, goalIds: string[] = []) => ({ id, name: id, userId: 'u', createdAt: '2026-01-01', goals: goalIds.map(g => ({ id: g, name: g, type: 'ARTICULATION', smartGoal: '' })) }) as unknown as Student;
const data = () => ({ students: [student('ava', ['g1'])], goalTemplates: [], sessions: [session({ sessionId: 'x1' })] });

describe('backups', () => {
  it('round-trips through a backup file', async () => {
    const text = await backupFileText(createBackup(data(), { studentGroups: [{ id: 'grp', name: 'Group', studentIds: ['ava'] }] }));
    const parsed = parseBackup(text);
    expect(parsed.data.students[0].id).toBe('ava');
    expect(parsed.data.sessions[0].sessionId).toBe('x1');
    expect(parsed.settings?.studentGroups?.[0].name).toBe('Group');
  });

  it('round-trips a password-protected backup and rejects a wrong password', async () => {
    const text = await backupFileText(createBackup(data()), 'secret-pass');
    expect(isProtectedBackup(text)).toBe(true);
    // The student's data isn't readable in the file. Checked with quote marks: the encrypted part is base64, which has
    // no quote marks, so random ciphertext can't match by chance (a bare 'ava' sometimes did, e.g. "…Navab…").
    expect(text).not.toContain('"ava"');
    expect(text).not.toContain('"students"');
    await expect(decryptBackupText(text, 'wrong-pass')).rejects.toThrow(/Wrong password/);
    expect(parseBackup(await decryptBackupText(text, 'secret-pass')).data.students[0].id).toBe('ava');
  }, 20000);

  it('rejects files that aren\'t backups', () => {
    expect(() => parseBackup('not json')).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"hello":1}')).toThrow(/not an AscendEd backup/);
  });

  it('reads earlier goal type keys in older backups', () => {
    const backup = createBackup({ students: [], goalTemplates: [{ id: 't', name: 'T', type: ['STORY', 'OLD'].join('_') } as never], sessions: [] });
    expect(parseBackup(JSON.stringify(backup)).data.goalTemplates[0].type).toBe('STORY_ELEMENTS');
  });

  it('merges: keeps the device\'s records and adds what is new, including new goals of known students', () => {
    const incoming = { students: [student('ava', ['g1', 'g2']), student('ben')], goalTemplates: [], sessions: [session({ sessionId: 'x1' }), session({ sessionId: 'x2' })] };
    const { merged, added } = mergeBackupData(data(), incoming);
    expect(added).toEqual({ students: 1, goalTemplates: 0, sessions: 1, goals: 1 });
    expect(merged.students.find(s => s.id === 'ava')!.goals.map(g => g.id)).toEqual(['g1', 'g2']);
  });
});
