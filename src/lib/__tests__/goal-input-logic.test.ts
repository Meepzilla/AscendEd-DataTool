import { describe, expect, it } from 'vitest';
import { applyFieldChange, clearTrials, cycleTrial, goalAccuracyText, scoreNextTrial, undoLastTrial } from '../goal-input-logic';

describe('applyFieldChange', () => {
  it('sets a field', () => {
    expect(applyFieldChange('ARTICULATION', { correct: 1 }, 'correct', 2)).toEqual({ correct: 2 });
  });
  it('moves fluency total syllables with each dysfluency count, both ways', () => {
    const up = applyFieldChange('FLUENCY_SYLLABLE_STUTTER', { totalSyllables: 10, blocks: 0 }, 'blocks', 1);
    expect(up).toMatchObject({ blocks: 1, totalSyllables: 11 });
    expect(applyFieldChange('FLUENCY_SYLLABLE_STUTTER', up, 'blocks', 0)).toMatchObject({ blocks: 0, totalSyllables: 10 });
    expect(applyFieldChange('FLUENCY_SYLLABLE_STUTTER', { totalSyllables: 10 }, 'prolongations', 1).totalSyllables).toBe(10);
  });
  it('resizes the trial grid, keeping scored trials, and ignores a cleared count', () => {
    expect(applyFieldChange('DISCRETE_TRIALS', { trials: ['correct', 'incorrect', 'untouched'] }, 'numberOfTrials', 5).trials)
      .toEqual(['correct', 'incorrect', 'untouched', 'untouched', 'untouched']);
    expect(applyFieldChange('DISCRETE_TRIALS', { trials: ['correct', 'incorrect'] }, 'numberOfTrials', 1).trials).toEqual(['correct']);
    expect(applyFieldChange('DISCRETE_TRIALS', { trials: ['correct'] }, 'numberOfTrials', undefined).trials).toEqual(['correct']);
  });
});

describe('goalAccuracyText', () => {
  it('shows accuracy with the counts, counting approximate as an attempt', () => {
    expect(goalAccuracyText('ARTICULATION', { correct: 3, incorrect: 1, approximate: 0 })).toBe('75.0% (3/4)');
    expect(goalAccuracyText('LANGUAGE_COMPREHENSION', { questionsCorrect: 1, questionsIncorrect: 1, approximate: 2 })).toBe('25.0% (1/4)');
    expect(goalAccuracyText('ARTICULATION', {})).toBe('N/A (0%)');
  });
  it('shows % fluent, scored trials, story score and functions used', () => {
    expect(goalAccuracyText('FLUENCY_SYLLABLE_STUTTER', { totalSyllables: 20, blocks: 1, repetitions: 1 })).toBe('90.0% (18/20)');
    expect(goalAccuracyText('DISCRETE_TRIALS', { trials: ['correct', 'incorrect', 'untouched'] })).toBe('50.0% (1/2)');
    expect(goalAccuracyText('STORY_ELEMENTS', { character: 2, setting: 1 })).toBe('21.4% (3/14 points)');
    expect(goalAccuracyText('COMMUNICATION_FUNCTIONS', {})).toMatch(/^0 of \d+ used spontaneously/);
    expect(goalAccuracyText('COGNITIVE', {})).toBe('N/A');
  });
});

describe('trial grid', () => {
  it('cycles a trial through each status', () => {
    let data: Record<string, any> = { trials: ['untouched'] };
    const seen = [];
    for (let i = 0; i < 4; i++) { data = { trials: cycleTrial(data, 0) }; seen.push(data.trials[0]); }
    expect(seen).toEqual(['correct', 'approximate', 'incorrect', 'untouched']);
  });
  it('scores the next trial, and reports a full grid', () => {
    expect(scoreNextTrial({ trials: ['correct', 'untouched'] }, 'incorrect')).toEqual(['correct', 'incorrect']);
    expect(scoreNextTrial({ trials: ['correct'] }, 'incorrect')).toBeNull();
    expect(scoreNextTrial({ numberOfTrials: 3 }, 'correct')).toEqual(['correct', 'untouched', 'untouched']);
  });
  it('undoes the last scored trial and clears all', () => {
    expect(undoLastTrial({ trials: ['correct', 'incorrect', 'untouched'] })).toEqual(['correct', 'untouched', 'untouched']);
    expect(undoLastTrial({ trials: ['untouched'] })).toBeNull();
    expect(clearTrials({ trials: ['correct', 'incorrect'] })).toEqual(['untouched', 'untouched']);
  });
});

describe('goalAccuracyText matches Reports', () => {
  it('doesn\'t crash when trials isn\'t a list', () => {
    expect(goalAccuracyText('DISCRETE_TRIALS', { trials: 'correct,incorrect' })).toBe('0.0% (0/0)');
  });
  it('counts a goal entered with another count type\'s inputs, as Reports do', () => {
    expect(goalAccuracyText('ARTICULATION', { questionsCorrect: 3, questionsIncorrect: 1 })).toBe('75.0% (3/4)');
  });
  it('counts feeding trials accepted out of accepted and refused', () => {
    expect(goalAccuracyText('FEEDING_SWALLOWING', { trialsAccepted: 1, trialsRefused: 3 })).toBe('25.0% (1/4)');
  });
});
