import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';
import {
  PASSCODE_DECISION_KEY, getPasscodeDecision, hasExistingStudentData, needsFirstRunPrompt,
  needsPasscodeOffer, passcodeGateStatus, recordPasscodeDecision, clearPasscodeDecision,
} from '../passcode-onboarding';
import {
  PASSCODE_BACKUP_DECLINED_KEY, hasBackupOnRecord, hasDeclinedBackupBeforePasscode,
  recordBackupDeclinedBeforePasscode, shouldPromptForBackupBeforePasscode,
} from '../passcode-onboarding';
import { LAST_BACKUP_KEY } from '../backup';

// First-run passcode onboarding decisions, with an in-memory localStorage. The passcode config key
// (ascended_passcode_v1) stands in for protection being on: the onboarding module only reads it
// through secure-store's isPasscodeEnabled, which needs `window` to exist in this node environment.
const STUDENTS = 'ascended_students_v2_local-guest-user';
const SESSIONS = 'ascended_sessions_v2_local-guest-user';
const DRAFT = 'ascended_data_entry_draft_v1_local-guest-user';
const TEMPLATES = 'ascended_goal_templates_v2_local-guest-user';
const PASSCODE_CONFIG = 'ascended_passcode_v1';

let storage: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', globalThis);
});

describe('passcode onboarding decisions', () => {
  it('prompts a fresh install for setup and never offers it instead', () => {
    expect(needsFirstRunPrompt()).toBe(true);
    expect(needsPasscodeOffer()).toBe(false);
    expect(hasExistingStudentData()).toBe(false);
    expect(getPasscodeDecision()).toBeNull();
  });

  it('records a passcode decision and stops prompting', () => {
    const decision = recordPasscodeDecision('passcode');
    expect(decision).toMatchObject({ v: 1, choice: 'passcode' });
    expect(getPasscodeDecision()).toEqual(decision);
    expect(needsFirstRunPrompt()).toBe(false);
    expect(needsPasscodeOffer()).toBe(false);
  });

  it('records an opt-out and stops prompting', () => {
    recordPasscodeDecision('opted-out');
    expect(getPasscodeDecision()?.choice).toBe('opted-out');
    expect(needsFirstRunPrompt()).toBe(false);
    expect(needsPasscodeOffer()).toBe(false);
  });

  it('ignores a damaged or foreign decision value', () => {
    storage.setItem(PASSCODE_DECISION_KEY, 'not json');
    expect(getPasscodeDecision()).toBeNull();
    expect(needsFirstRunPrompt()).toBe(true);
    storage.setItem(PASSCODE_DECISION_KEY, JSON.stringify({ v: 2, choice: 'passcode', at: '2026-11-06T00:00:00.000Z' }));
    expect(getPasscodeDecision()).toBeNull();
  });

  it('offers, never blocks, an existing install with student data', () => {
    storage.setItem(STUDENTS, '[{"name":"Ava"}]');
    expect(hasExistingStudentData()).toBe(true);
    expect(needsFirstRunPrompt()).toBe(false);
    expect(needsPasscodeOffer()).toBe(true);
  });

  it('offers when sessions or an unsaved draft are the only data', () => {
    storage.setItem(SESSIONS, '[{"sessionId":"s1"}]');
    expect(needsPasscodeOffer()).toBe(true);
    storage.removeItem(SESSIONS);
    storage.setItem(DRAFT, '{"students":[]}');
    expect(needsPasscodeOffer()).toBe(true);
  });

  it('treats a stored empty list as no data, and templates alone as no data', () => {
    storage.setItem(STUDENTS, '[]');
    storage.setItem(SESSIONS, '[]');
    storage.setItem(TEMPLATES, '[{"name":"Goal"}]');
    expect(hasExistingStudentData()).toBe(false);
    expect(needsFirstRunPrompt()).toBe(true);
  });

  it('treats encrypted or unreadable stored data as existing data', () => {
    storage.setItem(STUDENTS, 'enc1:AAAA');
    expect(hasExistingStudentData()).toBe(true);
    expect(needsPasscodeOffer()).toBe(true);
    storage.setItem(STUDENTS, '{damaged');
    expect(hasExistingStudentData()).toBe(true);
  });

  it('never prompts once a passcode is set, even with data and no decision', () => {
    storage.setItem(STUDENTS, '[{"name":"Ava"}]');
    storage.setItem(PASSCODE_CONFIG, JSON.stringify({ v: 1, salt: 'x', iterations: 600000, check: 'y' }));
    expect(needsFirstRunPrompt()).toBe(false);
    expect(needsPasscodeOffer()).toBe(false);
  });

  it('never prompts an existing install that already recorded a decision', () => {
    storage.setItem(STUDENTS, '[{"name":"Ava"}]');
    recordPasscodeDecision('opted-out');
    expect(needsFirstRunPrompt()).toBe(false);
    expect(needsPasscodeOffer()).toBe(false);
  });
});

describe('backup before enabling the passcode', () => {
  it('prompts when there is no backup on record and no decline', () => {
    expect(hasBackupOnRecord()).toBe(false);
    expect(hasDeclinedBackupBeforePasscode()).toBe(false);
    expect(shouldPromptForBackupBeforePasscode()).toBe(true);
  });

  it('a decline lets setup proceed and stops prompting', () => {
    const record = recordBackupDeclinedBeforePasscode();
    expect(record).toMatchObject({ v: 1 });
    expect(storage.getItem(PASSCODE_BACKUP_DECLINED_KEY)).toBe(JSON.stringify(record));
    expect(hasDeclinedBackupBeforePasscode()).toBe(true);
    expect(shouldPromptForBackupBeforePasscode()).toBe(false);
  });

  it('a backup on record skips the prompt without a decline', () => {
    storage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
    expect(hasBackupOnRecord()).toBe(true);
    expect(shouldPromptForBackupBeforePasscode()).toBe(false);
  });

  it('ignores a backup timestamp that is not a real date', () => {
    storage.setItem(LAST_BACKUP_KEY, 'not a date');
    expect(hasBackupOnRecord()).toBe(false);
    expect(shouldPromptForBackupBeforePasscode()).toBe(true);
  });
});

describe('passcodeGateStatus', () => {
  const base = { passcodeOn: false, unlocked: true, firstRun: false, offer: false, offerPutOff: false };
  it('asks for a passcode on a fresh install, even though no passcode means "unlocked"', () => {
    expect(passcodeGateStatus({ ...base, firstRun: true })).toBe('setup');
  });
  it('offers a passcode once on an install with data, unless put off for this session', () => {
    expect(passcodeGateStatus({ ...base, offer: true })).toBe('offer');
    expect(passcodeGateStatus({ ...base, offer: true, offerPutOff: true })).toBe('open');
  });
  it('opens without a passcode once the user has decided', () => {
    expect(passcodeGateStatus(base)).toBe('open');
  });
  it('shows the lock screen until a set passcode is entered', () => {
    expect(passcodeGateStatus({ ...base, passcodeOn: true, unlocked: false })).toBe('locked');
    expect(passcodeGateStatus({ ...base, passcodeOn: true, unlocked: true })).toBe('open');
  });
});

describe('after Erase and Start Over', () => {
  it('asks again on the next load, so a restored backup is not stored unprotected without asking', () => {
    recordPasscodeDecision('passcode');
    expect(needsFirstRunPrompt()).toBe(false);
    // The erase removes the passcode and the data; the decision goes with them.
    clearPasscodeDecision();
    expect(getPasscodeDecision()).toBeNull();
    expect(needsFirstRunPrompt()).toBe(true);
  });
});
