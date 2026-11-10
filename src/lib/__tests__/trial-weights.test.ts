import { describe, expect, it } from 'vitest';
import { FEW_OPPORTUNITIES, dotRadius, opportunitiesOf, pooledAccuracy, trendWeight } from '../trial-weights';

describe('opportunitiesOf and trendWeight', () => {
  it('counts correct, incorrect and approximate responses for a trial-based goal', () => {
    expect(opportunitiesOf('ARTICULATION', { correct: 3, incorrect: 1, approximate: 1 })).toBe(5);
    expect(trendWeight('ARTICULATION', { correct: 1, incorrect: 0, approximate: 0 })).toBe(1);
    expect(trendWeight('ARTICULATION', { correct: 5, incorrect: 0, approximate: 0 })).toBe(5);
  });
  it('gives other kinds of goal an equal weight of 1', () => {
    expect(opportunitiesOf('BEHAVIOR_FREQUENCY', { count: 4 })).toBeNull();
    expect(trendWeight('BEHAVIOR_FREQUENCY', { count: 4 })).toBe(1);
  });
});

describe('pooledAccuracy', () => {
  it('pools the trials of the last three sessions, so a 1-of-1 session barely moves it', () => {
    // 4 of 10, 4 of 10, then 1 of 1: the plain accuracy jumps 40% → 100%; pooled it is 9 of 21, about 42.9%.
    const pooled = pooledAccuracy([{ correct: 4, opportunities: 10 }, { correct: 4, opportunities: 10 }, { correct: 1, opportunities: 1 }]);
    expect(pooled).toEqual([40, 40, 42.9]);
  });
  it('drops sessions older than the window', () => {
    const pooled = pooledAccuracy([
      { correct: 0, opportunities: 10 }, { correct: 10, opportunities: 10 }, { correct: 10, opportunities: 10 }, { correct: 10, opportunities: 10 },
    ]);
    expect(pooled[3]).toBe(100); // the first (0 of 10) is out of the last three
  });
  it('skips points without trials and is empty until one has them', () => {
    expect(pooledAccuracy([{ correct: 0, opportunities: 0 }, { correct: 2, opportunities: 4 }, { correct: 0, opportunities: 0 }])).toEqual([null, 50, 50]);
  });
});

describe('dotRadius', () => {
  it('grows with opportunities and stops at a maximum', () => {
    expect(dotRadius(1)).toBeLessThan(dotRadius(FEW_OPPORTUNITIES));
    expect(dotRadius(FEW_OPPORTUNITIES)).toBeLessThan(dotRadius(20));
    expect(dotRadius(20)).toBe(9);
    expect(dotRadius(500)).toBe(9);
    expect(dotRadius(0)).toBe(dotRadius(1));
  });
});
