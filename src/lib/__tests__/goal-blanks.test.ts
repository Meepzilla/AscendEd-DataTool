import { describe, expect, it } from 'vitest';
import { automaticBlankValues, fillBlanks, fillNameBlanks, findBlanks, percentAsFraction } from '../goal-blanks';
import { goalStatement } from '../helpers';

const AAC = 'By [date], STUDENT will independently initiate communication using _________ (AAC device/app/system) to interact with peers or adults in ___ out of ___ opportunities as measured by _________.';

describe('goal text blanks', () => {
  it('finds each blank with the words around it', () => {
    const blanks = findBlanks(AAC);
    expect(blanks).toHaveLength(4);
    expect(blanks[0]).toMatchObject({ index: 0, before: 'independently initiate communication using', after: '(AAC device/app/system) to interact' });
    expect(blanks[3].before).toBe('opportunities as measured by');
  });

  it('fills "___ out of ___" from the target', () => {
    expect(automaticBlankValues(AAC, { sessionTargetValue: 80 })).toEqual([undefined, '4', '5', undefined]);
    expect(percentAsFraction(90)).toEqual([9, 10]);
    expect(percentAsFraction(75)).toEqual([3, 4]);
    expect(percentAsFraction(33)).toBeNull();
  });

  it('fills "___%" and "___ consecutive" from the target and mastery', () => {
    expect(fillBlanks('with ___% accuracy across ___ consecutive sessions', { sessionTargetValue: 80, masterySessions: 4 }))
      .toBe('with 80% accuracy across 4 consecutive sessions');
  });

  it('uses what was typed for a blank, over the automatic value, and leaves unknown blanks', () => {
    const goal = { smartGoal: AAC, sessionTargetValue: 80, blankFills: ['a speech-generating device', '', '', 'SLP data collection'] };
    expect(fillBlanks(AAC, goal)).toContain('using a speech-generating device (AAC');
    expect(fillBlanks(AAC, goal)).toContain('in 4 out of 5 opportunities as measured by SLP data collection.');
    expect(fillBlanks(AAC, { smartGoal: AAC })).toBe(AAC);
  });

  it('fills the goal statement with blanks, date and name together', () => {
    const goal = { smartGoal: AAC, sessionTargetValue: 80, targetDate: '2026-11-28', blankFills: ['a talker'] };
    const text = goalStatement(goal, 'Devin Lewis');
    expect(text).toMatch(/^By Nov 28, 2026, Devin will independently initiate communication using a talker/);
    expect(text).toContain('in 4 out of 5 opportunities');
  });

  it('fills a name that starts the goal text with the same blanks', () => {
    const goal = { name: 'Initiate communication using _________ (AAC device/app/system) to interact with peers or...', smartGoal: AAC, blankFills: ['a talker'] };
    expect(fillNameBlanks(goal)).toBe('Initiate communication using a talker (AAC device/app/system) to interact with peers or...');
    expect(fillNameBlanks({ ...goal, name: 'Other ___ name' })).toBe('Other ___ name');
  });
});
