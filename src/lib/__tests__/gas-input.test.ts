import { describe, expect, it } from 'vitest';
import { applyFieldChange, goalAccuracyText } from '../goal-input-logic';

// Track B (Data Entry picker): the card's accuracy line for GAS goals. The picker itself cannot be
// rendered here (Vitest runs in environment node with no jsdom), so the level-to-text mapping it
// feeds is verified at this lib level instead.

describe('goalAccuracyText for GOAL_ATTAINMENT_SCALE', () => {
  it('shows each recorded level with its label, with + on positive levels', () => {
    expect(goalAccuracyText('GOAL_ATTAINMENT_SCALE', { gasLevel: -2 })).toBe('-2 (much less than expected)');
    expect(goalAccuracyText('GOAL_ATTAINMENT_SCALE', { gasLevel: -1 })).toBe('-1 (somewhat less than expected)');
    expect(goalAccuracyText('GOAL_ATTAINMENT_SCALE', { gasLevel: 0 })).toBe('0 (expected outcome)');
    expect(goalAccuracyText('GOAL_ATTAINMENT_SCALE', { gasLevel: 1 })).toBe('+1 (somewhat more than expected)');
    expect(goalAccuracyText('GOAL_ATTAINMENT_SCALE', { gasLevel: 2 })).toBe('+2 (much more than expected)');
  });

  it('shows no data, not a 0, when no level has been recorded yet', () => {
    expect(goalAccuracyText('GOAL_ATTAINMENT_SCALE', {})).toBe('N/A (no level recorded yet)');
    expect(goalAccuracyText('GOAL_ATTAINMENT_SCALE', { gasLevel: undefined })).toBe('N/A (no level recorded yet)');
    expect(goalAccuracyText('GOAL_ATTAINMENT_SCALE', { notes: 'observed' })).toBe('N/A (no level recorded yet)');
  });

  it('treats an out-of-range level as no level recorded', () => {
    expect(goalAccuracyText('GOAL_ATTAINMENT_SCALE', { gasLevel: 3 })).toBe('N/A (no level recorded yet)');
    expect(goalAccuracyText('GOAL_ATTAINMENT_SCALE', { gasLevel: 'high' })).toBe('N/A (no level recorded yet)');
  });
});

describe('applyFieldChange for GOAL_ATTAINMENT_SCALE', () => {
  it('stores a picked level, and clearing it back to undefined leaves no level (not 0)', () => {
    expect(applyFieldChange('GOAL_ATTAINMENT_SCALE', {}, 'gasLevel', 1)).toEqual({ gasLevel: 1 });
    const cleared = applyFieldChange('GOAL_ATTAINMENT_SCALE', { gasLevel: 1 }, 'gasLevel', undefined);
    expect(cleared.gasLevel).toBeUndefined();
    expect(goalAccuracyText('GOAL_ATTAINMENT_SCALE', cleared)).toBe('N/A (no level recorded yet)');
  });

  it('stores notes alongside the level', () => {
    expect(applyFieldChange('GOAL_ATTAINMENT_SCALE', { gasLevel: 0 }, 'notes', 'used the device'))
      .toEqual({ gasLevel: 0, notes: 'used the device' });
  });
});
