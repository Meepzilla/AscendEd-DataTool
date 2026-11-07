import { describe, expect, it } from 'vitest';
import { MISSED_REASONS, MISSED_REASON_SHORT, missedReasonFromCsv } from '../attendance';

describe('the Attendance column of a CSV export, read back on import', () => {
  it('gives back every missed reason the export writes', () => {
    for (const reason of MISSED_REASONS) {
      expect(missedReasonFromCsv(`Missed: ${MISSED_REASON_SHORT[reason]}`)).toBe(reason);
    }
  });

  it('is null for a held session or an empty cell, and "other" for a reason it does not know', () => {
    expect(missedReasonFromCsv('Held')).toBeNull();
    expect(missedReasonFromCsv('')).toBeNull();
    expect(missedReasonFromCsv(undefined)).toBeNull();
    expect(missedReasonFromCsv('Missed: snow day')).toBe('other');
    expect(missedReasonFromCsv('missed')).toBe('other');
  });
});
