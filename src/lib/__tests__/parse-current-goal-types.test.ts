import { describe, expect, it } from 'vitest';
import { parseWithCurrentGoalTypes, reviveGoalTypes } from '../legacy-goal-types';

describe('parseWithCurrentGoalTypes', () => {
  const same = (text: string) => expect(parseWithCurrentGoalTypes(text)).toEqual(JSON.parse(text, reviveGoalTypes));

  it('parses current data exactly as the reviver does', () => {
    same(JSON.stringify([{ id: 'g1', type: 'ARTICULATION', goals: [{ goalType: 'COMMUNICATION_COUNT', data: { type: 'other' } }] }]));
    same('[]');
    same(JSON.stringify([{ notes: 'text with "type":"STORY_OLD" in it', type: 'ARTICULATION' }]));
  });

  it('still reads earlier goal type keys as the current ones', () => {
    const text = JSON.stringify([{ id: 'g1', type: 'STORY_RETELL_OLD' }, { sessionId: 'x', goals: [{ goalType: 'STORY_X', dataCaptureType: 'STORY_Y' }] }]);
    same(text);
    expect(JSON.stringify(parseWithCurrentGoalTypes(text))).toContain('"STORY_ELEMENTS"');
  });

  it('falls back to the reviver for a type written with escapes', () => {
    same('[{"type":"STORY\\u005fOLD"}]');
    same('[{"type" : "STORY_OLD"}]');
  });
});
