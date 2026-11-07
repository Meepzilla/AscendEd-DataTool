import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';

// student-groups.ts: a failed save used to be silent ("this visit only"). It is now recorded
// (persistent warning) and thrown, so the dialog that asked for the save can say it wasn't kept.
let storage: ReturnType<typeof memoryStorage>;
let groups: typeof import('../student-groups');
let failures: typeof import('../storage-failure');

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
  groups = await import('../student-groups');
  failures = await import('../storage-failure');
});

describe('saveStudentGroups', () => {
  it('saves groups and reads them back', () => {
    groups.saveStudentGroups('u', [{ id: 'g1', name: 'Room 12', studentIds: ['s1'] }]);
    expect(groups.getStudentGroups('u')).toEqual([{ id: 'g1', name: 'Room 12', studentIds: ['s1'] }]);
    expect(failures.getStorageFailure('student-groups')).toBe(null);
  });

  it('throws and records the failure when storage is full', () => {
    const original = storage.setItem;
    storage.setItem = (k: string, v: string) => {
      if (k.startsWith('ascended_student_groups_v1_')) throw new DOMException('Storage is full', 'QuotaExceededError');
      return original(k, v);
    };
    expect(() => groups.saveStudentGroups('u', [{ id: 'g1', name: 'Room 12', studentIds: ['s1'] }]))
      .toThrow('could not be saved');
    expect(failures.getStorageFailure('student-groups')).toMatchObject({ quota: true });
    expect(groups.getStudentGroups('u')).toEqual([]);
    storage.setItem = original;
    // A later save landing clears the failure.
    groups.saveStudentGroups('u', [{ id: 'g1', name: 'Room 12', studentIds: ['s1'] }]);
    expect(failures.getStorageFailure('student-groups')).toBe(null);
  });
});
