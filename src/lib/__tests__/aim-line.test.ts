import { describe, expect, it } from 'vitest';
import { aimLine, aimStatus, aimValueAt, masterySessions } from '../aim-line';
import { goal } from './helpers';

const withAim = goal({ baseline: 40, sessionTargetValue: 80, baselineDate: '2026-09-01', targetDate: '2027-06-01' });

describe('aimLine', () => {
  it('needs a baseline, a target and a target date', () => {
    expect(aimLine(goal({ sessionTargetValue: 80, targetDate: '2027-06-01' }), '2026-09-01')).toBeNull();
    expect(aimLine(goal({ baseline: 40, targetDate: '2027-06-01' }), '2026-09-01')).toBeNull();
    expect(aimLine(goal({ baseline: 40, sessionTargetValue: 80 }), '2026-09-01')).toBeNull();
  });
  it('starts at the baseline date, else the first session', () => {
    expect(aimLine(withAim, '2026-10-15')!.start.value).toBe(40);
    const noDate = goal({ baseline: 40, sessionTargetValue: 80, targetDate: '2027-06-01' });
    expect(aimLine(noDate, '2026-10-15')!.start.time).toBe(new Date('2026-10-15T00:00').getTime());
  });
  it('rises from the baseline to the target and holds there', () => {
    const aim = aimLine(withAim)!;
    expect(aimValueAt(aim, '2026-08-01')).toBe(40);
    expect(aimValueAt(aim, '2027-07-01')).toBe(80);
    const middle = aimValueAt(aim, (aim.start.time + aim.end.time) / 2);
    expect(middle).toBeCloseTo(60);
  });
});

describe('aimStatus', () => {
  const aim = aimLine(withAim)!;
  it('is behind when the last 3 sessions are all below the line', () => {
    const points = ['2027-03-01', '2027-03-08', '2027-03-15'].map(date => ({ date, value: 45 }));
    expect(aimStatus(withAim, aim, points)).toBe('behind');
  });
  it('is on track when any of the last 3 reach the line', () => {
    const points = [{ date: '2027-03-01', value: 45 }, { date: '2027-03-08', value: 90 }, { date: '2027-03-15', value: 45 }];
    expect(aimStatus(withAim, aim, points)).toBe('on-track');
  });
  it('reads decrease goals the other way', () => {
    const down = goal({ type: 'BEHAVIOR_FREQUENCY', baseline: 10, sessionTargetValue: 2, baselineDate: '2026-09-01', targetDate: '2027-06-01' });
    const points = ['2027-03-01', '2027-03-08', '2027-03-15'].map(date => ({ date, value: 1 }));
    expect(aimStatus(down, aimLine(down), points)).toBe('on-track');
  });
});

describe('masterySessions', () => {
  it('defaults to 3', () => {
    expect(masterySessions(goal())).toBe(3);
    expect(masterySessions(goal({ masterySessions: 5 }))).toBe(5);
  });
});
