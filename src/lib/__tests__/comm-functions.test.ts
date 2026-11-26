import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';

// Settings → Communication Functions: an editable list like the ABC lists. Data is stored by each function's key,
// so a removed function is hidden (not deleted) and past sessions keep their counts and names.
let storage: ReturnType<typeof memoryStorage>;
let comm: typeof import('../comm-functions');
let constants: typeof import('../goal-constants/communication');

beforeEach(async () => {
  storage = memoryStorage();
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
  comm = await import('../comm-functions');
  constants = await import('../goal-constants/communication');
});

describe('communication functions list', () => {
  it('uses the defaults until changed, and never stores the defaults', () => {
    expect(comm.loadCommFunctions()).toEqual(constants.DEFAULT_COMM_FUNCTIONS);
    comm.saveCommFunctions([...constants.DEFAULT_COMM_FUNCTIONS]);
    expect(storage.getItem(comm.COMM_FUNCTIONS_KEY)).toBeNull();
  });

  it('saves added and hidden functions, and the app reads them', () => {
    const list = comm.loadCommFunctions();
    const key = comm.newCommFunctionKey('Sharing information', list);
    expect(key).toBe('c_sharingInformation');
    comm.saveCommFunctions([...list.map(f => (f.key === 'greeting' ? { ...f, hidden: true } : f)), { key, label: 'Sharing information' }]);
    expect(constants.activeCommFunctions().map(f => f.key)).toContain('c_sharingInformation');
    expect(constants.activeCommFunctions().map(f => f.key)).not.toContain('greeting');
    expect(constants.commFunctionLabel('greeting')).toBe('Greeting/Farewell'); // hidden, still named
    expect(constants.commFunctionLabel(key)).toBe('Sharing information');
  });

  it('gives each new function its own key', () => {
    const list = [...constants.DEFAULT_COMM_FUNCTIONS, { key: 'c_sharingInformation', label: 'Sharing information' }];
    expect(comm.newCommFunctionKey('Sharing information!', list)).toBe('c_sharingInformation2');
  });

  it('refuses a list with every function removed or repeated keys', () => {
    expect(() => comm.saveCommFunctions(constants.DEFAULT_COMM_FUNCTIONS.map(f => ({ ...f, hidden: true })))).toThrow();
    expect(() => comm.saveCommFunctions([{ key: 'a', label: 'A' }, { key: 'a', label: 'B' }])).toThrow();
  });

  it('counts every function with tallies, including added and removed ones', () => {
    comm.saveCommFunctions([...constants.DEFAULT_COMM_FUNCTIONS.map(f => (f.key === 'commenting' ? { ...f, hidden: true } : f)), { key: 'c_joking', label: 'Joking' }]);
    const data = { commentingSpontaneous: 2, c_jokingEmerging: 1, requestingItemsPrompted: 3 };
    const summary = constants.summarizeCommunicationFunctions(data);
    expect(summary.functionsUsedUnprompted).toBe(2);
    expect(summary.functionCount).toBe(10); // 9 shown defaults + Joking
    expect(constants.commFunctionsFor([data]).map(f => f.label)).toEqual(expect.arrayContaining(['Joking', 'Commenting']));
  });

  it('merges a backup\'s list by key', () => {
    const merged = comm.mergeCommFunctions(constants.DEFAULT_COMM_FUNCTIONS, [{ key: 'c_joking', label: 'Joking' }, { key: 'greeting', label: 'Hi' }]);
    expect(merged).toHaveLength(constants.DEFAULT_COMM_FUNCTIONS.length + 1);
    expect(merged.find(f => f.key === 'greeting')?.label).toBe('Greeting/Farewell');
  });
});

describe('backups', () => {
  it('include an edited list and restore it', async () => {
    comm.saveCommFunctions([...constants.DEFAULT_COMM_FUNCTIONS, { key: 'c_joking', label: 'Joking' }]);
    const { createBackup, parseBackup } = await import('../backup');
    const backup = createBackup({ students: [], goalTemplates: [], sessions: [] }, { commFunctions: comm.loadCustomCommFunctions() ?? undefined });
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.settings?.commFunctions?.at(-1)?.label).toBe('Joking');
    comm.saveCommFunctions(null);
    const { restoreBackupSettings } = await import('../restore');
    restoreBackupSettings(parsed, 'replace', 'u1', () => {});
    expect(comm.loadCommFunctions().at(-1)?.label).toBe('Joking');
  });
});

describe('function keys from stored data', () => {
  it('ignores fields whose key is not a plain function key', () => {
    const data = { __proto__Spontaneous: 3, 'a.bEmerging': 2, '1abcPrompted': 1, c_jokingSpontaneous: 1, notes: 'x' } as Record<string, any>;
    expect(constants.commFunctionKeysIn(data)).toEqual(['c_joking']);
    expect(constants.isSafeCommFunctionKey('__proto__')).toBe(false);
    // Plain letter keys, but denied: a key named constructor or prototype must never reach data
    // writes or merges, even though every current use is only as a field-name prefix (finding D1).
    expect(constants.isSafeCommFunctionKey('constructor')).toBe(false);
    expect(constants.isSafeCommFunctionKey('prototype')).toBe(false);
  });

  it('leaves constructor and prototype tallies out of the keys read from session data', () => {
    const data = { constructorSpontaneous: 2, prototypePrompted: 1, greetingSpontaneous: 1 } as Record<string, any>;
    expect(constants.commFunctionKeysIn(data)).toEqual(['greeting']);
  });
});

describe('functions by session', () => {
  it('lists each used function with its uses per session, in list order, leaving unused ones out', () => {
    const sessions = [
      { commentingSpontaneous: 2, requestingItemsPrompted: 1 },
      {},
      { requestingItemsSpontaneous: 1, requestingItemsEmerging: 1, c_jokingPrompted: 3, greetingSpontaneous: -4 },
    ];
    const rows = constants.commFunctionsBySession(sessions);
    expect(rows.map(r => r.key)).toEqual(['requestingItems', 'commenting', 'c_joking']);
    const requesting = rows[0];
    expect(requesting.sessions).toEqual([
      { spontaneous: 0, emerging: 0, prompted: 1 },
      { spontaneous: 0, emerging: 0, prompted: 0 },
      { spontaneous: 1, emerging: 1, prompted: 0 },
    ]);
    expect(requesting.total).toEqual({ spontaneous: 1, emerging: 1, prompted: 1 });
    expect(rows[2]).toMatchObject({ label: 'Joking', hidden: true, total: { spontaneous: 0, emerging: 0, prompted: 3 } });
  });

  it('is empty when no function was used', () => {
    expect(constants.commFunctionsBySession([{}, { commentingSpontaneous: 0 }])).toEqual([]);
  });
});
