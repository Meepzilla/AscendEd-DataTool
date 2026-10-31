import { describe, expect, it } from 'vitest';
import { applyGoalHotkey } from '../data-entry-hotkeys';

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
});
