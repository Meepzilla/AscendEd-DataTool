import { describe, expect, it } from 'vitest';
import { goalMeasureInfo } from '../goal-measures';
import { goalAccuracyText } from '../goal-input-logic';
import { formatGoalTarget } from '../helpers';
import { assignedGoalChanges, goalTemplateChanges } from '../goal-changes';
import { goalFromTemplate } from '../goal-templates';
import { AssignedGoalEditSchema, GoalTemplateSchema } from '../schemas';
import { backupFileText, createBackup, parseBackup } from '../backup';
import type { Goal, GoalTemplate, Student } from '../types';
import { goal as goalBuilder } from './helpers';

// Communication Functions goals measured by total uses across all functions ("at least 5 times"), as well as
// by different functions (the default).

const usesGoal = () => goalBuilder({ id: 'g1', type: 'COMMUNICATION_FUNCTIONS', sessionTargetValue: 5, commMeasure: 'uses' } as Partial<Goal>);
const functionsGoal = () => goalBuilder({ id: 'g2', type: 'COMMUNICATION_FUNCTIONS', sessionTargetValue: 3 } as Partial<Goal>);

describe('Communication Functions measured by total uses', () => {
  it('names the measure and target in uses, with no top of scale', () => {
    expect(goalMeasureInfo(usesGoal())).toEqual({ label: 'Uses without a prompt (all functions)', unit: '' });
    expect(goalMeasureInfo(functionsGoal()).label).toBe('Functions used without a prompt');
    expect(goalMeasureInfo(functionsGoal()).max).toBeGreaterThan(0);
    expect(formatGoalTarget(usesGoal(), 5)).toBe('at least 5 uses (all functions)');
    expect(formatGoalTarget(functionsGoal(), 3)).toBe('3 functions');
  });

  it('shows the uses in the Data Entry result line', () => {
    const data = { requestingItemsSpontaneous: 2, commentingEmerging: 1, greetingPrompted: 2 };
    expect(goalAccuracyText(usesGoal(), data)).toBe('3 uses without a prompt across 2 functions (2 spontaneous, 1 emerging, 2 prompted)');
    expect(goalAccuracyText(functionsGoal(), data)).toMatch(/^2 of \d+ used without a prompt/);
  });

  it('accepts a uses target above the number of functions, which a functions target refuses', () => {
    const base = { name: 'Communicate', smartGoal: 'Isac will communicate at least 15 times.', dataCaptureType: 'COMMUNICATION_FUNCTIONS' as const };
    expect(AssignedGoalEditSchema.safeParse({ ...base, sessionTargetValue: 15, commMeasure: 'uses' }).success).toBe(true);
    expect(AssignedGoalEditSchema.safeParse({ ...base, sessionTargetValue: 15 }).success).toBe(false);
    const template = { name: 'Communicate', type: 'COMMUNICATION_FUNCTIONS' as const, smartGoalPrompt: 'Communicate at least 15 times.' };
    expect(GoalTemplateSchema.safeParse({ ...template, sessionTargetValue: 15, commMeasure: 'uses' }).success).toBe(true);
  });

  it('lists a change of measure in the editors, and a template passes it to a new student goal', () => {
    expect(assignedGoalChanges(functionsGoal(), { commMeasure: 'uses' })).toEqual([
      { label: 'Measure progress by', from: 'Different functions', to: 'Total uses (all functions)' },
    ]);
    expect(assignedGoalChanges(functionsGoal(), { commMeasure: 'functions' })).toEqual([]);
    const template = { id: 't1', name: 'Communicate', type: 'COMMUNICATION_FUNCTIONS', smartGoalPrompt: 'x', generatedSmartGoal: 'x', sessionTargetValue: 5, commMeasure: 'uses', createdAt: new Date(), isDefault: false } as GoalTemplate;
    expect(goalTemplateChanges(template, { commMeasure: 'functions' }).map(c => c.label)).toEqual(['Measure progress by']);
    expect(goalFromTemplate(template).commMeasure).toBe('uses');
  });

  it('survives a backup round trip', async () => {
    const student = { id: 'isac', name: 'Isac', userId: 'u', createdAt: '2026-01-01', goals: [usesGoal()] } as unknown as Student;
    const text = await backupFileText(createBackup({ students: [student], goalTemplates: [], sessions: [] }));
    expect(parseBackup(text).data.students[0].goals[0].commMeasure).toBe('uses');
  });
});
