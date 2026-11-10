import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';
import type { AppBackup } from '../backup';
import type { GoalTemplate, Student } from '../types';

// Finding 11: student groups, ABC lists, and the goal templates list (built-ins included) are
// encrypted when passcode protection is on, like students and sessions. Each test loads fresh
// copies of the modules (secure-store keeps the key and decrypted data in memory).
const GROUPS = 'ascended_student_groups_v1_u';
const ABC = 'ascended_abc_lists';
const T = 'ascended_goal_templates_v2_u';

let storage: ReturnType<typeof memoryStorage>;
let store: typeof import('../secure-store');
let abc: typeof import('../abc-lists');
let groupsMod: typeof import('../student-groups');
let restoreMod: typeof import('../restore');
let dataStore: typeof import('../data-store');
let idb: typeof import('../indexed-db-store');

async function freshModules() {
  vi.resetModules();
  idb = await import('../indexed-db-store');
  idb.useMemoryIndexedDb();
  idb.resetMemoryIndexedDb();
  store = await import('../secure-store');
  abc = await import('../abc-lists');
  groupsMod = await import('../student-groups');
  restoreMod = await import('../restore');
  dataStore = await import('../data-store');
}

const groupList = [{ id: 'g1', name: 'Room 12', studentIds: ['s1', 's2'] }];
const customAbc = {
  antecedents: ['Asked to wait'],
  behaviors: ['Hit'],
  consequences: [{ label: 'Left alone', fn: 'Escape' as const }],
};

const backupWithSettings = (settings: AppBackup['settings']): AppBackup => ({
  app: 'AscendEd',
  version: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  data: { students: [], goalTemplates: [], sessions: [] },
  settings,
});

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });
  await freshModules();
});

describe('student groups with passcode protection', () => {
  it('stays plaintext when protection is off, encrypted when it is on, and reads back after unlock', async () => {
    groupsMod.saveStudentGroups('u', groupList);
    expect(storage.getItem(GROUPS)).toContain('Room 12');
    expect(storage.getItem(GROUPS)).toContain('s1');

    await store.enablePasscode('passcode1');
    await store.flushWrites();
    expect(storage.getItem(GROUPS)!.startsWith('enc1:')).toBe(true);
    expect(storage.getItem(GROUPS)).not.toContain('Room 12');
    // Encrypted text is random base64, which can contain any short run of letters and digits, but never a quote
    // or a space, so the plaintext is looked for with its JSON quotes (a bare 's1' matched by chance in about 2% of runs).
    expect(storage.getItem(GROUPS)).not.toContain('"s1"');
    expect(groupsMod.getStudentGroups('u')).toEqual(groupList);

    await freshModules();
    expect(groupsMod.getStudentGroups('u')).toEqual([]);
    expect(await store.unlock('passcode1')).toBe(true);
    expect(groupsMod.getStudentGroups('u')).toEqual(groupList);
  }, 30000);

  it('is re-encrypted on passcode change and stored plain on disable', async () => {
    groupsMod.saveStudentGroups('u', groupList);
    await store.enablePasscode('passcode1');
    await store.changePasscode('passcode1', 'passcode2');
    await store.flushWrites();
    expect(storage.getItem(GROUPS)!.startsWith('enc1:')).toBe(true);
    expect(groupsMod.getStudentGroups('u')).toEqual(groupList);
    await store.disablePasscode('passcode2');
    await store.flushWrites();
    expect(storage.getItem(GROUPS)).toContain('Room 12');
    expect(store.isPasscodeEnabled()).toBe(false);
  }, 60000);

  it('is erased with the protected data', async () => {
    groupsMod.saveStudentGroups('u', groupList);
    abc.saveAbcLists(customAbc);
    await store.enablePasscode('passcode1');
    store.eraseProtectedData();
    expect(storage.getItem(GROUPS)).toBe(null);
    expect(storage.getItem(ABC)).toBe(null);
  }, 30000);

  it('a damaged groups list is shown as none and never written over', async () => {
    groupsMod.saveStudentGroups('u', groupList);
    await store.enablePasscode('passcode1');
    storage.setItem(GROUPS, 'enc1:damaged-data');
    await freshModules();
    expect(await store.unlock('passcode1')).toBe(true);
    expect(groupsMod.isStudentGroupsDamaged('u')).toBe(true);
    expect(groupsMod.getStudentGroups('u')).toEqual([]);

    expect(() => groupsMod.saveStudentGroups('u', [{ id: 'g2', name: 'New group', studentIds: [] }])).toThrow();
    expect(storage.getItem(GROUPS)).toBe('enc1:damaged-data');

    groupsMod.saveStudentGroupsForRestore('u', [{ id: 'g2', name: 'New group', studentIds: [] }]);
    await store.flushWrites();
    expect(groupsMod.isStudentGroupsDamaged('u')).toBe(false);
    expect(groupsMod.getStudentGroups('u')).toEqual([{ id: 'g2', name: 'New group', studentIds: [] }]);
  }, 30000);

  it('reads as none while locked', async () => {
    groupsMod.saveStudentGroups('u', groupList);
    await store.enablePasscode('passcode1');
    await freshModules();
    expect(groupsMod.getStudentGroups('u')).toEqual([]);
    expect(groupsMod.isStudentGroupsDamaged('u')).toBe(false);
  }, 30000);

  it('refreshFromStorage picks up another tab’s change', async () => {
    groupsMod.saveStudentGroups('u', groupList);
    await store.enablePasscode('passcode1');
    await store.flushWrites();
    // Another tab writes a new value straight to storage; this tab’s cache is stale until refreshed.
    const v2 = [{ id: 'g2', name: 'Tuesday group', studentIds: ['s3'] }];
    storage.setItem(GROUPS, await store.encryptStoredValue(GROUPS, JSON.stringify(v2)));
    expect(groupsMod.getStudentGroups('u')).toEqual(groupList);
    expect(await store.refreshFromStorage(GROUPS)).toBe(true);
    expect(groupsMod.getStudentGroups('u')).toEqual(v2);
    expect(await store.refreshFromStorage(GROUPS)).toBe(false);
  }, 30000);
});

describe('ABC lists with passcode protection', () => {
  it('stays plaintext when protection is off, encrypted when it is on, and reads back after unlock', async () => {
    abc.saveAbcLists(customAbc);
    expect(storage.getItem(ABC)).toContain('Asked to wait');

    await store.enablePasscode('passcode1');
    await store.flushWrites();
    expect(storage.getItem(ABC)!.startsWith('enc1:')).toBe(true);
    expect(storage.getItem(ABC)).not.toContain('Asked to wait');
    expect(abc.loadCustomAbcLists()).toEqual(customAbc);

    await freshModules();
    expect(abc.loadCustomAbcLists()).toBe(null);
    expect(await store.unlock('passcode1')).toBe(true);
    expect(abc.loadCustomAbcLists()).toEqual(customAbc);
  }, 30000);

  it('is re-encrypted on passcode change and stored plain on disable', async () => {
    abc.saveAbcLists(customAbc);
    await store.enablePasscode('passcode1');
    await store.changePasscode('passcode1', 'passcode2');
    await store.flushWrites();
    expect(storage.getItem(ABC)!.startsWith('enc1:')).toBe(true);
    expect(abc.loadCustomAbcLists()).toEqual(customAbc);
    await store.disablePasscode('passcode2');
    await store.flushWrites();
    expect(storage.getItem(ABC)).toContain('Asked to wait');
  }, 60000);

  it('a damaged ABC list falls back to the defaults and is never written over', async () => {
    abc.saveAbcLists(customAbc);
    await store.enablePasscode('passcode1');
    storage.setItem(ABC, 'enc1:damaged-data');
    await freshModules();
    expect(await store.unlock('passcode1')).toBe(true);
    expect(abc.isAbcListsDamaged()).toBe(true);
    expect(abc.loadAbcLists()).toEqual(abc.DEFAULT_ABC_LISTS);

    expect(() => abc.saveAbcLists(customAbc)).toThrow();
    expect(storage.getItem(ABC)).toBe('enc1:damaged-data');

    abc.saveAbcListsForRestore(customAbc);
    await store.flushWrites();
    expect(abc.isAbcListsDamaged()).toBe(false);
    expect(abc.loadCustomAbcLists()).toEqual(customAbc);
  }, 30000);
});

describe('restoring settings with passcode protection', () => {
  it('replace recovers damaged settings, merge never overwrites them', async () => {
    groupsMod.saveStudentGroups('u', groupList);
    abc.saveAbcLists(customAbc);
    await store.enablePasscode('passcode1');
    storage.setItem(GROUPS, 'enc1:damaged-data');
    storage.setItem(ABC, 'enc1:damaged-data');
    await freshModules();
    expect(await store.unlock('passcode1')).toBe(true);

    const errors: unknown[] = [];
    const backup = backupWithSettings({
      abcLists: { antecedents: ['New antecedent'], behaviors: [], consequences: [] },
      studentGroups: [{ id: 'g9', name: 'Restored group', studentIds: [] }],
    });
    restoreMod.restoreBackupSettings(backup, 'merge', 'u', error => errors.push(error));
    expect(errors).toHaveLength(2);
    expect(storage.getItem(GROUPS)).toBe('enc1:damaged-data');
    expect(storage.getItem(ABC)).toBe('enc1:damaged-data');

    restoreMod.restoreBackupSettings(backup, 'replace', 'u', error => errors.push(error));
    expect(errors).toHaveLength(2);
    await store.flushWrites();
    expect(groupsMod.getStudentGroups('u')).toEqual([{ id: 'g9', name: 'Restored group', studentIds: [] }]);
    expect(abc.loadCustomAbcLists()).toEqual({ antecedents: ['New antecedent'], behaviors: [], consequences: [] });
  }, 30000);
});

describe('goal templates read back encrypted', () => {
  it('seeding and goal linking still work on templates read back encrypted', async () => {
    const { prepareLoadedData } = await import('../data-migrations');
    const templates: GoalTemplate[] = [
      { id: 't-custom', name: 'Produce /s/ in words (custom probe)', type: 'ARTICULATION', isDefault: false, createdAt: new Date('2026-01-01'), userId: 'u' } as unknown as GoalTemplate,
      { id: 't-builtin', name: 'Follow 1-step directions', type: 'AUDITORY_COMPREHENSION', isDefault: true, defaultKey: 'Follow 1-step directions', createdAt: new Date('2026-01-01'), userId: 'u' } as unknown as GoalTemplate,
    ];
    await dataStore.hydrateLists({ students: null, templates: T, sessions: null });
    await store.enablePasscode('passcode1');
    await store.setItemAsync(T, JSON.stringify(templates));
    const rows = await idb.getAllRecords('goalTemplates');
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.v.startsWith('enc1:'))).toBe(true);
    expect(rows.map(r => r.v).join('')).not.toContain('custom probe');

    const readBack = dataStore.readList<GoalTemplate>(T)!;
    expect(readBack).toHaveLength(2);
    const student = {
      id: 's1', name: 'Ava', userId: 'u', createdAt: '2026-01-01', goals: [
        { id: 'g1', name: 'Produce /s/ in words (custom probe)', type: 'ARTICULATION', smartGoal: '' },
      ],
    } as Student;
    const prepared = prepareLoadedData([student], readBack, 'u');
    expect(prepared.templates.some(t => t.id === 't-custom')).toBe(true);
    expect(prepared.templates.some(t => t.id === 't-builtin')).toBe(true);
    expect(prepared.linkedStudents?.[0].goals[0].templateId).toBe('t-custom');
  }, 60000);
});
