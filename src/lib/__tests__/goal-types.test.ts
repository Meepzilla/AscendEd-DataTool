import { describe, expect, it } from 'vitest';
import { currentGoalType, reviveGoalTypes } from '../legacy-goal-types';
import { applyAssignedGoalRenames, applyDefaultTemplateRenames, DEFAULT_GOAL_TEMPLATES, GOAL_TYPE_FIELDS, GOAL_TYPES_WITHOUT_PROMPT_COUNTERS } from '../goal-constants';
import { goalTypeLabel } from '../helpers';
import type { GoalTemplate, Student } from '../types';
import { GOAL_TYPE_VALUES } from '../types';

// The earlier story key and template names are built here rather than written out.
const EARLIER_KEY = ['STORY', 'OLD'].join('_');
const EARLIER_PREFIX = 'Program Name: ';

describe('earlier goal type keys', () => {
  it('reads an earlier story key as STORY_ELEMENTS and leaves current keys alone', () => {
    expect(currentGoalType(EARLIER_KEY)).toBe('STORY_ELEMENTS');
    expect(currentGoalType('ARTICULATION')).toBe('ARTICULATION');
    expect(currentGoalType(undefined)).toBeUndefined();
  });
  it('converts type fields when parsing JSON, and nothing else', () => {
    const json = JSON.stringify({ type: EARLIER_KEY, goals: [{ goalType: EARLIER_KEY, data: { note: EARLIER_KEY } }] });
    const parsed = JSON.parse(json, reviveGoalTypes);
    expect(parsed.type).toBe('STORY_ELEMENTS');
    expect(parsed.goals[0].goalType).toBe('STORY_ELEMENTS');
    expect(parsed.goals[0].data.note).toBe(EARLIER_KEY);
  });
  it('labels goal types from their keys', () => {
    expect(goalTypeLabel('STORY_ELEMENTS')).toBe('Story Elements');
    expect(goalTypeLabel('BEHAVIOR_ABC')).toBe('Behavior ABC');
  });
});

describe('GOAL_ATTAINMENT_SCALE type', () => {
  it('is a goal type with its label and fields, and hides the prompt counters', () => {
    expect(GOAL_TYPE_VALUES).toContain('GOAL_ATTAINMENT_SCALE');
    expect(goalTypeLabel('GOAL_ATTAINMENT_SCALE')).toBe('Goal Attainment Scale');
    expect(GOAL_TYPE_FIELDS.GOAL_ATTAINMENT_SCALE).toEqual({ gasLevel: undefined, notes: '' });
    expect(GOAL_TYPES_WITHOUT_PROMPT_COUNTERS).toContain('GOAL_ATTAINMENT_SCALE');
  });
  it('seeds built-in templates at the expected level with baseline -2', () => {
    const gas = DEFAULT_GOAL_TEMPLATES.filter(t => t.type === 'GOAL_ATTAINMENT_SCALE');
    expect(gas.length).toBeGreaterThanOrEqual(3);
    for (const t of gas) {
      expect(t.sessionTargetValue).toBe(0);
      expect(t.baseline).toBe(-2);
      // The goal statement names an attainment level, never "0% accuracy".
      expect(t.generatedSmartGoal).toContain('attainment level');
      expect(t.generatedSmartGoal).not.toContain('0% accuracy');
    }
  });
});

describe('renamed story templates', () => {
  const current = DEFAULT_GOAL_TEMPLATES.find(t => t.name === 'Story elements: Retell a story without picture icons')!;
  const earlierPrompt = current.smartGoalPrompt.replace('a model story', 'a Program Name model story');

  it('renames a stored built-in template and its untouched wording', () => {
    const stored = { id: 't', isDefault: true, type: 'STORY_ELEMENTS', name: EARLIER_PREFIX + 'Retell a story without picture icons', smartGoalPrompt: earlierPrompt } as unknown as GoalTemplate;
    const [renamed] = applyDefaultTemplateRenames([stored]).templates;
    expect(renamed.name).toBe(current.name);
    expect(renamed.smartGoalPrompt).toBe(current.smartGoalPrompt);
  });
  it('renames assigned goals but keeps wording the user changed', () => {
    const student = { id: 's', name: 'Ava', goals: [
      { id: 'a', type: 'STORY_ELEMENTS', name: EARLIER_PREFIX + 'Retell a story without picture icons', smartGoal: earlierPrompt },
      { id: 'b', type: 'STORY_ELEMENTS', name: EARLIER_PREFIX + 'Retell a story without picture icons', smartGoal: 'My own wording' },
      { id: 'c', type: 'ARTICULATION', name: 'Other: Retell a story without picture icons', smartGoal: 'x' },
    ] } as unknown as Student;
    const goals = applyAssignedGoalRenames([student]).students[0].goals;
    expect(goals[0]).toMatchObject({ name: current.name, smartGoal: current.smartGoalPrompt });
    expect(goals[1]).toMatchObject({ name: current.name, smartGoal: 'My own wording' });
    expect(goals[2].name).toBe('Other: Retell a story without picture icons');
  });
});
