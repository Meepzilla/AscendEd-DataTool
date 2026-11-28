import { describe, expect, it } from 'vitest';
import { goalDirection } from '../goal-constants';
import { meetsTarget } from '../goal-measures';
import { tidiedUpdate, withFieldsForCaptureType } from '../goal-type-fields';
import { prepareLoadedData } from '../data-migrations';
import { goalFromTemplate } from '../goal-templates';
import { defaultCustomGoalType } from '../goal-types/custom';
import type { Goal, GoalTemplate, Student } from '../types';

// A direction, custom type or negative baseline left over from a goal's earlier data capture method must not change
// how the goal is measured now.
const counter = { ...defaultCustomGoalType('ct-1'), name: 'Hand raises', kind: 'counter' as const, direction: 'decrease' as const };

describe('goal direction', () => {
  it('ignores a decrease left over after switching a behavior goal to Discrete Trials', () => {
    const goal = { type: 'BEHAVIOR_FREQUENCY', dataCaptureType: 'DISCRETE_TRIALS', targetDirection: 'decrease' as const };
    expect(goalDirection(goal)).toBe('increase');
    // 20% against an 80% target is not met.
    expect(meetsTarget(goal as Goal, 20, 80)).toBe(false);
  });

  it('still honours a chosen direction where the method offers one', () => {
    expect(goalDirection({ type: 'COMMUNICATION_COUNT', targetDirection: 'decrease' })).toBe('decrease');
    expect(goalDirection({ type: 'BEHAVIOR_ABC', targetDirection: 'increase' })).toBe('increase');
    expect(goalDirection({ type: 'BEHAVIOR_FREQUENCY' })).toBe('decrease');
  });

  it("uses a custom type's direction when a built-in goal is measured with it", () => {
    expect(goalDirection({ type: 'BEHAVIOR_FREQUENCY', dataCaptureType: 'CUSTOM', customType: counter })).toBe('decrease');
    expect(goalDirection({ type: 'ARTICULATION', dataCaptureType: 'CUSTOM', customType: counter })).toBe('decrease');
  });
});

describe('withFieldsForCaptureType', () => {
  it('drops a direction the method has no choice for, and keeps one it has', () => {
    const tidy = withFieldsForCaptureType({ type: 'BEHAVIOR_FREQUENCY', dataCaptureType: 'DISCRETE_TRIALS', targetDirection: 'decrease' as const });
    expect('targetDirection' in tidy).toBe(false);
    const kept = { type: 'BEHAVIOR_FREQUENCY', targetDirection: 'increase' as const };
    expect(withFieldsForCaptureType(kept)).toBe(kept);
  });

  it('makes a built-in goal measured with a custom type a custom goal, and back', () => {
    expect(withFieldsForCaptureType({ type: 'BEHAVIOR_FREQUENCY', dataCaptureType: 'CUSTOM', customType: counter }).type).toBe('CUSTOM');
    const back = withFieldsForCaptureType({ type: 'CUSTOM', dataCaptureType: 'ARTICULATION', customType: counter });
    expect(back.type).toBe('ARTICULATION');
    expect('customType' in back).toBe(false);
  });

  it('drops a negative baseline unless the goal is Goal Attainment Scaling', () => {
    expect('baseline' in withFieldsForCaptureType({ type: 'ARTICULATION', baseline: -2 })).toBe(false);
    expect(withFieldsForCaptureType({ type: 'GOAL_ATTAINMENT_SCALE', baseline: -2 }).baseline).toBe(-2);
    expect(withFieldsForCaptureType({ type: 'ARTICULATION', baseline: 40 }).baseline).toBe(40);
  });

  it('tidiedUpdate clears the removed fields explicitly so a merge removes them', () => {
    const original: { type: string; dataCaptureType?: string; targetDirection?: 'increase' | 'decrease' } = { type: 'BEHAVIOR_FREQUENCY', targetDirection: 'decrease' };
    const update = tidiedUpdate(original, { dataCaptureType: 'DISCRETE_TRIALS' });
    expect('targetDirection' in update && update.targetDirection === undefined).toBe(true);
    expect({ ...original, ...update }.targetDirection).toBeUndefined();
    expect(tidiedUpdate(original, { targetDirection: 'increase' })).toEqual({ targetDirection: 'increase' });
  });
});

describe('stored data', () => {
  const template = (extra: Partial<GoalTemplate>): GoalTemplate => ({
    id: 't1', name: 'Switched template', type: 'GOAL_ATTAINMENT_SCALE', smartGoalPrompt: 'p', generatedSmartGoal: 'g',
    createdAt: new Date(0), isDefault: false, userId: 'u', ...extra,
  });

  it('a goal assigned from a switched GAS template has no -2 baseline', () => {
    const goal = goalFromTemplate(template({ type: 'ARTICULATION', baseline: -2 }));
    expect(goal.baseline).toBeUndefined();
  });

  it('is tidied when the app loads, and loading again changes nothing', () => {
    const student: Student = {
      id: 's1', name: 'Test Student Ada', createdAt: new Date(0).toISOString(), userId: 'u',
      goals: [{ id: 'g1', name: 'Was behavior', type: 'BEHAVIOR_FREQUENCY', dataCaptureType: 'DISCRETE_TRIALS', targetDirection: 'decrease', smartGoal: 's' } as Goal],
    } as Student;
    const first = prepareLoadedData([student], [template({ type: 'ARTICULATION', baseline: -2 })], 'u');
    expect(first.studentsChanged).toBe(true);
    expect(first.templatesChanged).toBe(true);
    expect(first.students[0].goals[0].targetDirection).toBeUndefined();
    expect(first.templates.find(t => t.id === 't1')?.baseline).toBeUndefined();
    const second = prepareLoadedData(first.students, first.templates, 'u');
    expect(second.studentsChanged).toBe(false);
    expect(second.templatesChanged).toBe(false);
  });
});

describe('wording', () => {
  it('says "1 second", not "1 seconds"', async () => {
    const { getGoalTypeDef } = await import('../goal-types/registry');
    const goal = { type: 'RESPONSE_TIME' } as Goal;
    expect(getGoalTypeDef(goal).formatValue(goal, 1)).toBe('1 second');
    expect(getGoalTypeDef(goal).formatValue(goal, 2.5)).toBe('2.5 seconds');
  });
});

describe('targets and baselines above the scale', () => {
  it('are refused for the goal type, also when saved with Ctrl+Enter (schema check)', async () => {
    const { AssignedGoalEditSchema, GoalTemplateSchema } = await import('../schemas');
    const goal = { name: 'Test goal', smartGoal: 'Test Student Ada will say /s/ in words.' };
    expect(AssignedGoalEditSchema.safeParse({ ...goal, dataCaptureType: 'ARTICULATION', sessionTargetValue: 800 }).success).toBe(false);
    expect(AssignedGoalEditSchema.safeParse({ ...goal, dataCaptureType: 'ARTICULATION', sessionTargetValue: 80, baseline: 400 }).success).toBe(false);
    expect(AssignedGoalEditSchema.safeParse({ ...goal, dataCaptureType: 'COGNITIVE', sessionTargetValue: 9 }).success).toBe(false);
    expect(AssignedGoalEditSchema.safeParse({ ...goal, dataCaptureType: 'ARTICULATION', sessionTargetValue: 80, baseline: 40 }).success).toBe(true);
    // Counts have no top: 150 hits is fine.
    expect(AssignedGoalEditSchema.safeParse({ ...goal, dataCaptureType: 'COMMUNICATION_COUNT', sessionTargetValue: 150 }).success).toBe(true);
    const template = { name: 'Test template', type: 'ARTICULATION', smartGoalPrompt: 'Student will say /s/ in words.' };
    expect(GoalTemplateSchema.safeParse({ ...template, sessionTargetValue: 150 }).success).toBe(false);
    expect(GoalTemplateSchema.safeParse({ ...template, sessionTargetValue: 90 }).success).toBe(true);
  });
});
