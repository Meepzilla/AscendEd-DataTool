import { describe, expect, it } from 'vitest';
import { isValidStoredCustomGoalType } from '../custom-goal-types';

// Findings A8/D3: the stored-list check once validated far less than the Zod schema the import and
// backup paths use, so tampered or damaged stored types could re-enter with unbounded nested
// fields. These cases are the ones the old check admitted and the schema rejects; the base types
// are shapes the app itself writes and must keep loading.

const base = {
  id: 'ct1',
  version: 1,
  name: 'My Type',
  color: '#3366cc',
  direction: 'increase',
  extras: { promptLevel: true, notes: false },
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('isValidStoredCustomGoalType matches the import standard', () => {
  it('accepts the shapes the app writes', () => {
    expect(isValidStoredCustomGoalType({ ...base, kind: 'accuracy', accuracy: { correctLabel: 'Correct', incorrectLabel: 'Incorrect', approximate: true } })).toBe(true);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'rating', rating: { min: 1, max: 5, levelLabels: ['a', 'b', 'c', 'd', 'e'] }, defaultTarget: 4 })).toBe(true);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'checklist', checklist: { steps: ['Step one', 'Step two'] } })).toBe(true);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'trials', trials: { count: 10 } })).toBe(true);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'utterances', utterances: { unit: 'morphemes' }, charts: { style: 'bar', show: ['utterance-lengths'] } })).toBe(true);
  });

  it('rejects unbounded or malformed kind payloads the old check admitted', () => {
    expect(isValidStoredCustomGoalType({ ...base, kind: 'accuracy', accuracy: { correctLabel: 'x'.repeat(31), incorrectLabel: 'No', approximate: false } })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'counter', counter: { label: 'x'.repeat(41), perMinute: false } })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'checklist', checklist: { steps: Array.from({ length: 41 }, (_, i) => `Step ${i}`) } })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'checklist', checklist: { steps: ['x'.repeat(121)] } })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'rating', rating: { min: 1, max: 5, levelLabels: Array.from({ length: 12 }, () => 'lvl') } })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'rating', rating: { min: 1, max: 5, levelLabels: ['x'.repeat(31)] } })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'trials', trials: { count: 101 } })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'trials', trials: { count: 2.5 } })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'utterances', utterances: { unit: 'syllables' } })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'counter', counter: { label: 'Count', perMinute: false }, charts: { style: 'pie', show: [] } })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'counter', counter: { label: 'Count', perMinute: false }, charts: { style: 'line', show: ['bogus-chart'] } })).toBe(false);
  });

  it('rejects cross-field violations the schema refine rules catch', () => {
    expect(isValidStoredCustomGoalType({ ...base, kind: 'accuracy', accuracy: { correctLabel: 'Yes', incorrectLabel: 'No', approximate: false }, defaultTarget: 150 })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'rating', rating: { min: 1, max: 5, levelLabels: [] }, defaultTarget: 9 })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'counter', counter: { label: 'Count', perMinute: true }, defaultTarget: 1001 })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'rating' })).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'checklist' })).toBe(false);
    expect(isValidStoredCustomGoalType([])).toBe(false);
    expect(isValidStoredCustomGoalType({ ...base, kind: 'accuracy', extras: [] })).toBe(false);
  });
});
