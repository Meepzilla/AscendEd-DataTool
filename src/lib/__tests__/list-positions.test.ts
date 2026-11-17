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

  it('falls back to 0, 1, 2… when there is no room left between two positions', () => {
    let current: number[] = [0, 1];
    for (let i = 0; i < 80; i++) {
      current = listPositions([current[0], undefined, ...current.slice(1)]);
      expect(increasing(current)).toBe(true);
    }
  });
});
