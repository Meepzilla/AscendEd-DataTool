import { describe, expect, it } from 'vitest';
import { automaticBlankValues, fillBlanks, fillNameBlanks, findBlanks, matchTextToTarget, percentAsFraction } from '../goal-blanks';
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

describe('goal text follows the target and mastery', () => {
  const text = 'By [date], STUDENT will request help in 4 out of 5 observed opportunities across 3 consecutive sessions.';
  it('changes "4 out of 5" when the target changes, keeping the number of opportunities when it can', () => {
    expect(matchTextToTarget(text, { type: 'LANGUAGE_EXPRESSION', sessionTargetValue: 60 })).toContain('in 3 out of 5 observed opportunities');
    expect(matchTextToTarget(text, { type: 'LANGUAGE_EXPRESSION', sessionTargetValue: 90 })).toContain('in 9 out of 10 observed opportunities');
    expect(matchTextToTarget(text, { type: 'LANGUAGE_EXPRESSION', sessionTargetValue: 80 })).toBe(text);
  });
  it('changes "6 of 10 opportunities" when it is the only target in the text', () => {
    expect(matchTextToTarget('respond in 8 of 10 opportunities.', { type: 'AAC', sessionTargetValue: 70 })).toBe('respond in 7 of 10 opportunities.');
  });
  it('changes a stated percentage but keeps the number of opportunities, which is set separately', () => {
    const pct = 'with 80% accuracy in 4 out of 5 opportunities across 3 consecutive sessions.';
    expect(matchTextToTarget(pct, { type: 'ARTICULATION', sessionTargetValue: 60 })).toBe('with 60% accuracy in 4 out of 5 opportunities across 3 consecutive sessions.');
    expect(matchTextToTarget('across 80% of opportunities (8 of 10 opportunities).', { type: 'AAC', sessionTargetValue: 70 })).toBe('across 70% of opportunities (8 of 10 opportunities).');
    const blanks = 'with ___% accuracy in ___ out of ___ opportunities';
    expect(fillBlanks(blanks, { sessionTargetValue: 60 })).toBe('with 60% accuracy in ___ out of ___ opportunities');
    expect(fillBlanks(blanks, { sessionTargetValue: 60, blankFills: ['', '4', '5'] })).toBe('with 60% accuracy in 4 out of 5 opportunities');
  });
  it('leaves text with two different percentages, and goals whose target is not a percentage', () => {
    expect(matchTextToTarget('80% accuracy at 90% intelligibility', { type: 'ARTICULATION', sessionTargetValue: 70 })).toBe('80% accuracy at 90% intelligibility');
    expect(matchTextToTarget('in 4 out of 5 opportunities', { type: 'BEHAVIOR_FREQUENCY', sessionTargetValue: 2 })).toBe('in 4 out of 5 opportunities');
    expect(matchTextToTarget('rated 4 out of 5', { type: 'COGNITIVE', sessionTargetValue: 3 })).toBe('rated 4 out of 5');
  });
  it('doesn\'t treat "2 out of 3 sessions" as the target, and follows mastery for "consecutive sessions" when set', () => {
    expect(matchTextToTarget('in 4 out of 5 trials in 2 out of 3 sessions', { type: 'ARTICULATION', sessionTargetValue: 60 })).toBe('in 3 out of 5 trials in 2 out of 3 sessions');
    expect(matchTextToTarget(text, { type: 'ARTICULATION', sessionTargetValue: 80, masterySessions: 4 })).toContain('across 4 consecutive sessions');
    expect(matchTextToTarget(text, { type: 'ARTICULATION', sessionTargetValue: 80 })).toContain('across 3 consecutive sessions');
  });
  it('reads custom goal wording: "80 percent", "4/5 trials" and "6 of 10 times"', () => {
    expect(matchTextToTarget('with 80 percent accuracy in 4/5 trials', { type: 'ARTICULATION', sessionTargetValue: 70 })).toBe('with 70 percent accuracy in 4/5 trials');
    expect(matchTextToTarget('answer wh- questions in 4/5 trials', { type: 'LANGUAGE_COMPREHENSION', sessionTargetValue: 60 })).toBe('answer wh- questions in 3/5 trials');
    expect(matchTextToTarget('answer correctly 8 of 10 times', { type: 'LANGUAGE_COMPREHENSION', sessionTargetValue: 90 })).toBe('answer correctly 9 of 10 times');
    expect(fillBlanks('with ___ percent accuracy', { sessionTargetValue: 75 })).toBe('with 75 percent accuracy');
  });
  it('never takes a date for a fraction', () => {
    const dated = 'By 6/15/2027, STUDENT will answer in 4 out of 5 trials.';
    expect(matchTextToTarget(dated, { type: 'ARTICULATION', sessionTargetValue: 60 })).toBe('By 6/15/2027, STUDENT will answer in 3 out of 5 trials.');
    expect(matchTextToTarget('By 6/15, answer in 4/5 trials', { type: 'ARTICULATION', sessionTargetValue: 60 })).toBe('By 6/15, answer in 3/5 trials');
  });
  it('shows the goal statement with the new numbers', () => {
    expect(goalStatement({ smartGoal: text, type: 'LANGUAGE_EXPRESSION', sessionTargetValue: 60 }, 'Ava')).toBe('By [date], Ava will request help in 3 out of 5 observed opportunities across 3 consecutive sessions.');
  });
});
