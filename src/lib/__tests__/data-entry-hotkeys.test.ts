import { describe, expect, it } from 'vitest';
import { applyGoalHotkey, removeCorrect } from '../data-entry-hotkeys';

describe('Data Entry hotkeys', () => {
  it('C and N count correct and incorrect responses', () => {
    expect(applyGoalHotkey('ARTICULATION', 'C', { correct: 1, incorrect: 0 })).toMatchObject({ correct: 2 });
    expect(applyGoalHotkey('ARTICULATION', 'N', { correct: 1, incorrect: 0 })).toMatchObject({ incorrect: 1 });
  });
  it('fills the next trial on a trial grid', () => {
    const next = applyGoalHotkey('DISCRETE_TRIALS', 'C', { numberOfTrials: 3, trials: ['correct', 'untouched', 'untouched'] });
    expect(next?.trials).toEqual(['correct', 'correct', 'untouched']);
  });
  it('I counts an independent response as correct too', () => {
    expect(applyGoalHotkey('ARTICULATION', 'I', { correct: 0 })).toMatchObject({ Independent: 1, correct: 1 });
  });
  it('scores the next task analysis step', () => {
    const next = applyGoalHotkey('TASK_ANALYSIS', 'V', {}, ['a', 'b']);
    expect(next?.steps.map((s: { level: string }) => s.level)).toEqual(['Verbal', '']);
  });
  it('ignores keys that mean nothing for the goal type', () => {
    expect(applyGoalHotkey('STORY_ELEMENTS', 'V', {})).toBeNull();
    expect(applyGoalHotkey('ARTICULATION', 'Z', {})).toBeNull();
  });
  it('removeCorrect undoes C on behavior frequency and communication count goals', () => {
    const incBehavior = applyGoalHotkey('BEHAVIOR_FREQUENCY', 'C', { count: 1, occurrenceTimes: ['2026-10-05T09:00:00.000Z'] });
    expect(incBehavior?.count).toBe(2);
    expect(incBehavior?.occurrenceTimes).toHaveLength(2);
    const decBehavior = removeCorrect('BEHAVIOR_FREQUENCY', incBehavior!);
    expect(decBehavior.count).toBe(1);
    expect(decBehavior.occurrenceTimes).toHaveLength(1);

    const incComm = applyGoalHotkey('COMMUNICATION_COUNT', 'C', { count: 2 });
    expect(incComm?.count).toBe(3);
    const decComm = removeCorrect('COMMUNICATION_COUNT', incComm!);
    expect(decComm.count).toBe(2);
  });
  it('increments totalSyllables for all fluency dysfluency hotkeys including H (prolongations)', () => {
    for (const [key, field] of [['B', 'blocks'], ['R', 'repetitions'], ['H', 'prolongations'], ['J', 'interjections']] as const) {
      const next = applyGoalHotkey('FLUENCY_SYLLABLE_STUTTER', key, { totalSyllables: 10, [field]: 0 });
      expect(next).toMatchObject({ [field]: 1, totalSyllables: 11 });
    }
  });
});

