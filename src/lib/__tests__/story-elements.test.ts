import { describe, expect, it } from 'vitest';
import { averageStoryPart, scoreStory, storyPartScore, STORY_PART_NOT_ASSESSED } from '../goal-constants';
import { goalAccuracyText } from '../goal-input-logic';
import { goalMeasure } from '../goal-measures';
import { mergeGoalData } from '../session-merge';

const NA = STORY_PART_NOT_ASSESSED;
// The session in the screenshot that prompted this: Character 2, Setting 1, Problem 1, Feeling 2, Action 1, Ending 2,
// End Feeling 0 = 9 of 14 points.
const allScored = { character: 2, setting: 1, problem: 1, feeling: 2, action: 1, ending: 2, endFeeling: 0 };

describe('story parts marked not assessed', () => {
  it('count every part when all are scored', () => {
    expect(scoreStory(allScored)).toMatchObject({ points: 9, maxPoints: 14, notAssessed: 0 });
    expect(scoreStory(allScored).percent).toBeCloseTo(64.29, 2);
  });

  it('are left out of the points possible', () => {
    // End Feeling not assessed: 9 of 12 points.
    const story = scoreStory({ ...allScored, endFeeling: NA });
    expect(story).toMatchObject({ points: 9, maxPoints: 12, notAssessed: 1, partsIncluded: 6 });
    expect(story.percent).toBe(75);
  });

  it('read as a score of null; other values stay within 0-2', () => {
    expect(storyPartScore(NA)).toBeNull();
    expect(storyPartScore(undefined)).toBe(0);
    expect(storyPartScore(5)).toBe(2);
  });

  it('show on the Data Entry card', () => {
    expect(goalAccuracyText('STORY_ELEMENTS', { ...allScored, endFeeling: NA })).toBe('75.0% (9/12 points, 1 not assessed)');
    expect(goalAccuracyText('STORY_ELEMENTS', allScored)).toBe('64.3% (9/14 points)');
  });

  it('give no score to chart when no part was assessed', () => {
    const none = Object.fromEntries(Object.keys(allScored).map(k => [k, NA]));
    expect(scoreStory(none)).toMatchObject({ maxPoints: 0, percent: 0 });
    expect(goalAccuracyText('STORY_ELEMENTS', none)).toBe('N/A (no story parts assessed)');
    expect(goalMeasure({ type: 'STORY_ELEMENTS' }, { ...none, wordBecause: 2 })).toBeNull();
    expect(goalMeasure({ type: 'STORY_ELEMENTS' }, { ...allScored, endFeeling: NA })).toBe(75);
  });

  it('are left out of a part\'s average over sessions', () => {
    expect(averageStoryPart([{ setting: 2 }, { setting: NA }, { setting: 1 }], 'setting')).toBe(1.5);
    expect(averageStoryPart([{ setting: NA }, { setting: NA }], 'setting')).toBeNull();
  });

  it('give way to a real score when sessions are merged', () => {
    expect(mergeGoalData([{ setting: NA, problem: 1 }, { setting: 0, problem: NA }])).toEqual({ setting: 0, problem: 1 });
    expect(mergeGoalData([{ setting: NA }, { setting: NA }])).toEqual({ setting: NA });
  });
});
