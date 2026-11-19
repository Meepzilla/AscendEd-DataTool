import { describe, expect, it } from 'vitest';
import { summarizeCommunicationFunctions } from '../goal-constants';
import { goalMeasure, goalResponses, sessionMeetsTarget } from '../goal-measures';

describe('goalResponses', () => {
  it('keeps a real 0 instead of falling through to another field', () => {
    expect(goalResponses('ARTICULATION', { correct: 0, questionsCorrect: 5, incorrect: 0, questionsIncorrect: 2 }))
      .toEqual({ correct: 0, incorrect: 0, approximate: 0 });
    expect(goalResponses('LANGUAGE_COMPREHENSION', { questionsCorrect: 3, questionsIncorrect: 0 }))
      .toEqual({ correct: 3, incorrect: 0, approximate: 0 });
  });
  it('clamps counts at zero, so a negative can\'t push accuracy past 100%', () => {
    expect(goalResponses('ARTICULATION', { correct: 10, incorrect: -5 })).toEqual({ correct: 10, incorrect: 0, approximate: 0 });
    expect(goalMeasure({ type: 'ARTICULATION' }, { correct: 10, incorrect: -5 })).toBe(100);
    expect(goalResponses('FEEDING_SWALLOWING', { trialsAccepted: 2, trialsRefused: -1 })).toEqual({ correct: 2, incorrect: 0, approximate: 0 });
  });
});

describe('goalMeasure', () => {
  it('charts a story session where every assessed part scored 0, instead of treating it as no data', () => {
    const allZero = { character: 0, setting: 0, problem: 0, feeling: 0, action: 0, ending: 0, endFeeling: 0 };
    expect(goalMeasure({ type: 'STORY_ELEMENTS' }, { ...allZero, recorded: true })).toBe(0);
    // The same zeros on a goal that wasn't worked on (as every saved session stores them) are no data, not 0%.
    expect(goalMeasure({ type: 'STORY_ELEMENTS' }, allZero)).toBeNull();
    // Older sessions have no recorded mark: a part set to N/A, a linking word or a note shows the goal was worked on.
    expect(goalMeasure({ type: 'STORY_ELEMENTS' }, { ...allZero, setting: -1 })).toBe(0);
    expect(goalMeasure({ type: 'STORY_ELEMENTS' }, { ...allZero, notes: 'could not retell' })).toBe(0);
    expect(goalMeasure({ type: 'STORY_ELEMENTS' }, { ...allZero, character: 1 })).toBeCloseTo(100 / 14, 5);
    // Nothing assessed at all is still no data.
    const none = { character: -1, setting: -1, problem: -1, feeling: -1, action: -1, ending: -1, endFeeling: -1 };
    expect(goalMeasure({ type: 'STORY_ELEMENTS' }, none)).toBeNull();
    expect(goalMeasure({ type: 'STORY_ELEMENTS' }, { character: 2, setting: -1, problem: -1, feeling: -1, action: -1, ending: -1, endFeeling: -1 })).toBe(100);
  });
  it('counts prolongations as dysfluent, like the narrative names them', () => {
    // 10 syllables, 2 prolongations only: 80% fluent, not N/A or 100%.
    expect(goalMeasure({ type: 'FLUENCY_SYLLABLE_STUTTER' }, { totalSyllables: 10, prolongations: 2 })).toBe(80);
    expect(goalMeasure({ type: 'FLUENCY_SYLLABLE_STUTTER' }, { totalSyllables: 10, prolongations: 10 })).toBe(0);
    // Dysfluencies can't push the percent below 0 or above 100.
    expect(goalMeasure({ type: 'FLUENCY_SYLLABLE_STUTTER' }, { totalSyllables: 5, blocks: 9 })).toBe(0);
  });
  it('clamps ratings to 1-5', () => {
    expect(goalMeasure({ type: 'COGNITIVE' }, { rating: 6, recorded: true })).toBe(5);
    expect(goalMeasure({ type: 'QUALITATIVE_OBSERVATION' }, { rating: 4, recorded: true })).toBe(4);
    expect(goalMeasure({ type: 'COGNITIVE' }, { rating: 3, recorded: true })).toBe(3);
  });
  it('clamps behavior percentages to 0-100 and counts at zero', () => {
    expect(goalMeasure({ type: 'BEHAVIOR_INTERVAL' }, { intervals: [true, true], intervalCount: 2, recorded: true })).toBe(100);
    expect(goalMeasure({ type: 'BEHAVIOR_FREQUENCY' }, { count: -3, recorded: true })).toBe(0);
    expect(goalMeasure({ type: 'BEHAVIOR_FREQUENCY' }, { count: 0, recorded: true })).toBe(0);
    expect(goalMeasure({ type: 'BEHAVIOR_FREQUENCY' }, { count: 0 })).toBeNull();
  });
});

describe('communication functions measure and target', () => {
  it('reads a worked session with no functions used as a real 0, not no data', () => {
    expect(goalMeasure({ type: 'COMMUNICATION_FUNCTIONS' }, { recorded: true })).toBe(0);
    expect(goalMeasure({ type: 'COMMUNICATION_FUNCTIONS' }, {})).toBeNull();
    expect(goalMeasure({ type: 'COMMUNICATION_FUNCTIONS' }, { requestingItemsSpontaneous: 2, commentingSpontaneous: 1 })).toBe(2);
  });

  it('requires the functions target and the uses minimum together when a minimum is set', () => {
    // Two functions and five spontaneous uses in total: met.
    expect(sessionMeetsTarget({ type: 'COMMUNICATION_FUNCTIONS', sessionTargetUses: 5 }, { requestingItemsSpontaneous: 3, commentingSpontaneous: 2 }, 2)).toBe(true);
    // Two functions but only three uses: the uses half is short.
    expect(sessionMeetsTarget({ type: 'COMMUNICATION_FUNCTIONS', sessionTargetUses: 5 }, { requestingItemsSpontaneous: 2, commentingSpontaneous: 1 }, 2)).toBe(false);
    // Five uses of a single function: the functions half is short.
    expect(sessionMeetsTarget({ type: 'COMMUNICATION_FUNCTIONS', sessionTargetUses: 5 }, { requestingItemsSpontaneous: 5 }, 2)).toBe(false);
    // Prompted uses do not count toward the minimum.
    expect(sessionMeetsTarget({ type: 'COMMUNICATION_FUNCTIONS', sessionTargetUses: 5 }, { requestingItemsSpontaneous: 1, commentingSpontaneous: 1, requestingItemsPrompted: 4 }, 2)).toBe(false);
  });

  it('keeps the functions-only check when no uses minimum is set', () => {
    expect(sessionMeetsTarget({ type: 'COMMUNICATION_FUNCTIONS' }, { requestingItemsSpontaneous: 2, commentingSpontaneous: 1 }, 2)).toBe(true);
    expect(sessionMeetsTarget({ type: 'COMMUNICATION_FUNCTIONS' }, { requestingItemsSpontaneous: 2 }, 2)).toBe(false);
    expect(sessionMeetsTarget({ type: 'COMMUNICATION_FUNCTIONS' }, {}, 2)).toBe(false);
  });

  it('counts emerging unprompted forms toward functions used and target uses, while prompted-only is an observed 0', () => {
    // Only prompted uses recorded (even without `recorded: true`): real 0, not no data.
    expect(goalMeasure({ type: 'COMMUNICATION_FUNCTIONS' }, { commentingPrompted: 2, protestingPrompted: 1 })).toBe(0);
    expect(sessionMeetsTarget({ type: 'COMMUNICATION_FUNCTIONS' }, { commentingPrompted: 3 }, 2)).toBe(false);
    // Emerging unprompted uses count alongside spontaneous uses toward distinct functions and minimum total uses.
    expect(goalMeasure({ type: 'COMMUNICATION_FUNCTIONS' }, { requestingItemsSpontaneous: 2, commentingEmerging: 1, protestingPrompted: 3 })).toBe(2);
    expect(sessionMeetsTarget(
      { type: 'COMMUNICATION_FUNCTIONS', sessionTargetUses: 5 },
      { requestingItemsSpontaneous: 2, commentingEmerging: 3 },
      2,
    )).toBe(true);
    // Emerging uses of the same function as spontaneous uses don't double-count the distinct function.
    expect(goalMeasure({ type: 'COMMUNICATION_FUNCTIONS' }, { requestingItemsSpontaneous: 2, requestingItemsEmerging: 3 })).toBe(1);
    expect(sessionMeetsTarget(
      { type: 'COMMUNICATION_FUNCTIONS', sessionTargetUses: 5 },
      { requestingItemsSpontaneous: 2, requestingItemsEmerging: 3 },
      2,
    )).toBe(false);
  });

  it('counts spontaneous, emerging, and combined unprompted functions accurately per session', () => {
    const summary = summarizeCommunicationFunctions({
      requestingItemsSpontaneous: 3,
      requestingItemsEmerging: 1,
      commentingSpontaneous: 2,
      protestingEmerging: 2,
      greetingPrompted: 2,
    });
    expect(summary.functionsUsedSpontaneously).toBe(2);
    expect(summary.functionsUsedEmerging).toBe(2);
    expect(summary.functionsUsedUnprompted).toBe(3);
    expect(summary.spontaneous).toBe(5);
    expect(summary.emerging).toBe(3);
    expect(summary.prompted).toBe(2);
  });
});
