import { describe, expect, it } from 'vitest';
import { listPositions } from '../indexed-db-store';

const increasing = (o: number[]) => o.every((v, i) => i === 0 || v > o[i - 1]);
const kept = (current: (number | undefined)[], o: number[]) => o.filter((v, i) => v === current[i]).length;

describe('listPositions', () => {
  it('numbers a new list 0, 1, 2…', () => {
    expect(listPositions([undefined, undefined, undefined])).toEqual([0, 1, 2]);
    expect(listPositions([])).toEqual([]);
  });

  it('keeps every position when a record is added at the top, the end or in between', () => {
    const top = listPositions([undefined, 0, 1, 2, 3]);
    expect(increasing(top)).toBe(true);
    expect(top.slice(1)).toEqual([0, 1, 2, 3]);
    expect(listPositions([0, 1, 2, undefined])).toEqual([0, 1, 2, 3]);
    const middle = listPositions([0, 1, undefined, 2]);
    expect(middle).toEqual([0, 1, 1.5, 2]);
  });

  it('keeps every position when records are removed', () => {
    expect(listPositions([0, 2, 5])).toEqual([0, 2, 5]);
  });

  it('moves only the record that moved', () => {
    const o = listPositions([1, 2, 3, 0]);
    expect(increasing(o)).toBe(true);
    expect(kept([1, 2, 3, 0], o)).toBe(3);
    const back = listPositions([3, 0, 1, 2]);
    expect(increasing(back)).toBe(true);
    expect(kept([3, 0, 1, 2], back)).toBe(3);
  });

  it('stays in order after many records are added at the top, one at a time', () => {
    let current: number[] = [0, 1, 2];
    for (let i = 0; i < 500; i++) current = listPositions([undefined, ...current]);
    expect(current).toHaveLength(503);
    expect(increasing(current)).toBe(true);
  });

  it('keeps order through hundreds of inserts at the same place, without renumbering the list', () => {
    let current: number[] = [0, 1];
    for (let i = 0; i < 500; i++) {
      const next = listPositions([current[0], undefined, ...current.slice(1)]);
      expect(increasing(next)).toBe(true);
      // Only the new record gets a position: the others keep theirs.
      expect(next[0]).toBe(current[0]);
      expect(next[2]).toBe(current[1]);
      current = next;
    }
  });

  it('falls back to 0, 1, 2… when there is no room left between two positions', () => {
    // Two neighbours that are next to each other as numbers: nothing fits between them, so the list is numbered afresh.
    const adjacent = 1 + Number.EPSILON;
    expect(adjacent).toBeGreaterThan(1);
    expect(listPositions([1, undefined, adjacent])).toEqual([0, 1, 2]);
    expect(listPositions([1, undefined, undefined, adjacent])).toEqual([0, 1, 2, 3]);
    // A position that isn't a usable number is not trusted: that record is placed again like a new one.
    expect(listPositions([0, Number.NaN, 2])).toEqual([0, 1, 2]);
  });
});
