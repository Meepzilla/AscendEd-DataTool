import { describe, expect, it } from 'vitest';
import { shouldApplyUpdateNow, type ApplyUpdateState } from '../service-worker-update';

const base: ApplyUpdateState = {
  visible: true,
  passcodeOn: true,
  unlocked: false,
  returningToForeground: false,
  recentlyAutoUpdated: false,
};

describe('shouldApplyUpdateNow', () => {
  it('applies while the lock screen is showing', () => {
    expect(shouldApplyUpdateNow(base)).toBe(true);
    expect(shouldApplyUpdateNow({ ...base, returningToForeground: true })).toBe(true);
  });

  it('waits in the middle of an unlocked session, even on returning to the app', () => {
    expect(shouldApplyUpdateNow({ ...base, unlocked: true })).toBe(false);
    expect(shouldApplyUpdateNow({ ...base, unlocked: true, returningToForeground: true })).toBe(false);
  });

  it('without a passcode, applies only when the app comes back to the foreground', () => {
    const open = { ...base, passcodeOn: false, unlocked: true };
    expect(shouldApplyUpdateNow(open)).toBe(false);
    expect(shouldApplyUpdateNow({ ...open, returningToForeground: true })).toBe(true);
  });

  it('never applies while hidden', () => {
    expect(shouldApplyUpdateNow({ ...base, visible: false })).toBe(false);
    expect(shouldApplyUpdateNow({ ...base, passcodeOn: false, unlocked: true, visible: false, returningToForeground: true })).toBe(false);
  });

  it('does not reload again within a minute of the last automatic update', () => {
    expect(shouldApplyUpdateNow({ ...base, recentlyAutoUpdated: true })).toBe(false);
  });
});
