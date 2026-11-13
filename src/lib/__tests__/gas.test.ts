import { describe, expect, it } from 'vitest';
import { GAS_LEVELS, formatGasLevel, gasLevelDescription, gasLevelLabel, gasLevelText, gasProgress, gasTScore, gasTScoresOverTime } from '../gas';
import { matchTextToTarget } from '../goal-blanks';
import { goalMeasure, goalMeasureInfo, goalResponses } from '../goal-measures';
import { mergeGoalData } from '../session-merge';
import { formatGoalTarget } from '../helpers';
import { measureFormula } from '../report-formulas';
import { builtInGoalStatement } from '../goal-constants/built-in-statements';
import { classifyGoal, goalTarget } from '../student-import';
import { AssignedGoalEditSchema, type Goal, type SessionData } from '../types';
import { goalFromTemplate } from '../goal-templates';
import { GAS_TEMPLATES } from '../goal-constants/gas';
import { backupFileText, createBackup, parseBackup } from '../backup';
import { goal as goalBuilder, session as sessionBuilder } from './helpers';

const gasGoal = (overrides: Partial<Goal> = {}): Goal =>
  goalBuilder({ type: 'GOAL_ATTAINMENT_SCALE', sessionTargetValue: 0, ...overrides });

const gasSession = (date: string, levels: Record<string, number>): SessionData =>
  sessionBuilder({
    date,
    goals: Object.entries(levels).map(([goalId, gasLevel]) => ({
      goalId, goalName: goalId, goalType: 'GOAL_ATTAINMENT_SCALE', data: { gasLevel, recorded: true },
    })),
  });

describe('GAS levels', () => {
  it('has five levels from -2 to +2 with a label and a description each', () => {
    expect(GAS_LEVELS.map(l => l.level)).toEqual([-2, -1, 0, 1, 2]);
    for (const info of GAS_LEVELS) {
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
    }
    expect(GAS_LEVELS[2]).toEqual({ level: 0, label: 'Expected', description: 'Expected outcome', studentWording: 'Where I hope to be after working on it' });
  });
  it('labels a level with its number and generic description', () => {
    expect(gasLevelLabel(-2)).toBe('-2 (much less than expected)');
    expect(gasLevelLabel(-1)).toBe('-1 (less than expected)');
    expect(gasLevelLabel(0)).toBe('0 (expected outcome)');
    expect(gasLevelLabel(1)).toBe('+1 (better than expected)');
    expect(gasLevelLabel(2)).toBe('+2 (much better than expected)');
  });
  it('shows positive levels with a + sign', () => {
    expect(formatGasLevel(2)).toBe('+2');
    expect(formatGasLevel(0)).toBe('0');
    expect(formatGasLevel(-2)).toBe('-2');
  });
});

describe('goal-specific level descriptions', () => {
  const goal = gasGoal({ gasLevelDescriptions: ['', '', 'Uses targeted words on their own in conversation, at least twice in an activity.', '', ''] });
  it('uses the goal\u2019s own description for a level where one is written', () => {
    expect(gasLevelDescription(goal, 0)).toBe('Uses targeted words on their own in conversation, at least twice in an activity.');
    expect(gasLevelText(goal, 0)).toBe('0 (Uses targeted words on their own in conversation, at least twice in an activity.)');
  });
  it('falls back to the generic description for levels left blank', () => {
    expect(gasLevelDescription(goal, 1)).toBe('Better than expected');
    expect(gasLevelText(goal, 1)).toBe('+1 (better than expected)');
    expect(gasLevelText(gasGoal({}), -2)).toBe('-2 (much less than expected)');
  });
});

describe('gasTScore', () => {
  it('matches the standard vectors', () => {
    expect(gasTScore([0])).toBe(50);
    expect(gasTScore([2])).toBe(70);
    expect(gasTScore([-2])).toBe(30);
    expect(gasTScore([1, 1, 1])).toBe(63.7);
  });
  it('combines mixed levels with equal weights', () => {
    expect(gasTScore([1, 0])).toBe(56.2);
    expect(gasTScore([-1, 0])).toBe(43.8);
    expect(gasTScore([2, 2])).toBe(74.8);
  });
  it('is null with no levels yet', () => {
    expect(gasTScore([])).toBeNull();
  });
});

describe('gasTScoresOverTime', () => {
  it('carries each goal’s latest level forward to each session date', () => {
    const sessions = [
      gasSession('2026-11-02', { g1: -1 }),
      gasSession('2026-11-03', { g2: 0 }),
      gasSession('2026-11-04', { g1: 1 }),
    ];
    const points = gasTScoresOverTime(sessions, [{ id: 'g1' }, { id: 'g2' }]);
    expect(points).toEqual([
      { date: '2026-11-02', tScore: 40, levels: { g1: -1 } },
      { date: '2026-11-03', tScore: 43.8, levels: { g1: -1, g2: 0 } },
      { date: '2026-11-04', tScore: 56.2, levels: { g1: 1, g2: 0 } },
    ]);
  });
  it('is null on a date before any level was recorded, and leaves unrecorded goals out', () => {
    const sessions = [gasSession('2026-11-02', { g2: 0 })];
    const points = gasTScoresOverTime(sessions, [{ id: 'g1' }, { id: 'g2' }]);
    expect(points).toEqual([{ date: '2026-11-02', tScore: 50, levels: { g2: 0 } }]);
  });
  it('orders dates oldest first even when sessions arrive out of order', () => {
    const sessions = [
      gasSession('2026-11-04', { g1: 1 }),
      gasSession('2026-11-02', { g1: -1 }),
    ];
    expect(gasTScoresOverTime(sessions, [{ id: 'g1' }]).map(p => p.date)).toEqual(['2026-11-02', '2026-11-04']);
  });
});

describe('GAS as a goal measure', () => {
  it('returns the recorded level, including 0 as a real value, and null with no level yet', () => {
    const goal = gasGoal();
    expect(goalMeasure(goal, { gasLevel: 0, recorded: true })).toBe(0);
    expect(goalMeasure(goal, { gasLevel: 2, recorded: true })).toBe(2);
    expect(goalMeasure(goal, { gasLevel: -1, recorded: true })).toBe(-1);
    expect(goalMeasure(goal, {})).toBeNull();
    expect(goalMeasure(goal, { notes: 'worked on it' })).toBeNull();
  });
  it('rejects a level outside -2 to +2 as bad data', () => {
    expect(goalMeasure(gasGoal(), { gasLevel: 3 })).toBeNull();
    expect(goalMeasure(gasGoal(), { gasLevel: '1' })).toBeNull();
  });
  it('describes the measure from -2 to +2', () => {
    expect(goalMeasureInfo(gasGoal())).toEqual({ label: 'Attainment level', unit: '', max: 2, min: -2 });
  });
  it('is excluded from response totals', () => {
    expect(goalResponses('GOAL_ATTAINMENT_SCALE', { gasLevel: 1 })).toBeNull();
  });
});

describe('merging GAS sessions', () => {
  it('keeps the latest level instead of adding levels', () => {
    expect(mergeGoalData([{ gasLevel: -1 }, { gasLevel: 1 }])).toMatchObject({ gasLevel: 1 });
    expect(mergeGoalData([{ gasLevel: 2 }, { gasLevel: -2 }])).toMatchObject({ gasLevel: -2 });
  });
  it('keeps an earlier level when a later part never recorded one', () => {
    expect(mergeGoalData([{ gasLevel: 1, notes: 'a' }, { notes: 'b' }])).toMatchObject({ gasLevel: 1 });
    expect(mergeGoalData([{ gasLevel: 1 }, { gasLevel: undefined }])).toMatchObject({ gasLevel: 1 });
  });
});

describe('GAS display wording', () => {
  it('renders the target as a level, not a percentage', () => {
    expect(formatGoalTarget('GOAL_ATTAINMENT_SCALE', 0)).toBe('level 0 (expected outcome)');
  });
  it('explains the measure as a -2 to +2 level', () => {
    expect(measureFormula(gasGoal())).toBe('The attainment level recorded in the session, -2 to +2; 0 is the expected outcome.');
  });
  it('never writes "0% accuracy" for a GAS goal statement', () => {
    const statement = builtInGoalStatement({
      name: 'GAS: Participate in a group activity', type: 'GOAL_ATTAINMENT_SCALE',
      smartGoalPrompt: 'Student will participate in a classroom group activity with peers.',
      sessionTargetValue: 0, isDefault: true, generatedSmartGoal: '',
    });
    expect(statement).toContain('attainment level of at least 0 (the expected outcome)');
    expect(statement).not.toContain('% accuracy');
  });
});

describe('GAS import classification', () => {
  it('classifies GAS wording and targets the expected level', () => {
    expect(classifyGoal('By June, the student will use their device to request, measured on the goal attainment scale.').type).toBe('GOAL_ATTAINMENT_SCALE');
    expect(classifyGoal('The student will reach the expected attainment level in 4 out of 5 sessions.').type).toBe('GOAL_ATTAINMENT_SCALE');
    expect(goalTarget('GOAL_ATTAINMENT_SCALE', 'anything with 80% in it')).toBe(0);
  });
});

describe('GAS goal editing', () => {
  it('keeps five level descriptions through the edit schema', () => {
    const parsed = AssignedGoalEditSchema.parse({
      name: 'GAS goal', smartGoal: 'Student will participate in group work.',
      gasLevelDescriptions: ['No participation', 'Watches only', 'Joins with prompts', 'Joins independently', 'Leads the group'],
    });
    expect(parsed.gasLevelDescriptions).toHaveLength(5);
    expect(parsed.gasLevelDescriptions?.[2]).toBe('Joins with prompts');
  });
  it('allows a -2 baseline (the GAS starting point) and rejects -3', () => {
    const base = { name: 'GAS goal', smartGoal: 'Student will participate in group work.', dataCaptureType: 'GOAL_ATTAINMENT_SCALE' as const };
    expect(AssignedGoalEditSchema.parse({ ...base, baseline: -2 }).baseline).toBe(-2);
    expect(() => AssignedGoalEditSchema.parse({ ...base, baseline: -3 })).toThrow();
  });
  it('keeps a GAS target to the scale, and other goals to baselines of 0 or more', () => {
    const gas = { name: 'GAS goal', smartGoal: 'Student will participate in group work.', dataCaptureType: 'GOAL_ATTAINMENT_SCALE' as const };
    expect(AssignedGoalEditSchema.parse({ ...gas, sessionTargetValue: 1 }).sessionTargetValue).toBe(1);
    expect(() => AssignedGoalEditSchema.parse({ ...gas, sessionTargetValue: 3 })).toThrow(/level from -2 to \+2/);
    const percent = { name: 'Produce /s/', smartGoal: 'Student will produce /s/ in words.', dataCaptureType: 'ARTICULATION' as const };
    expect(AssignedGoalEditSchema.parse({ ...percent, baseline: 40 }).baseline).toBe(40);
    expect(() => AssignedGoalEditSchema.parse({ ...percent, baseline: -2 })).toThrow(/0 or greater/);
  });
  it('passes a template baseline of -2 to the assigned goal', () => {
    const template = { ...GAS_TEMPLATES[0], id: 't1', createdAt: new Date() };
    const assigned = goalFromTemplate(template);
    expect(assigned.baseline).toBe(-2);
    expect(assigned.sessionTargetValue).toBe(0);
  });
});

describe('GAS backup round-trip', () => {
  it('keeps the level descriptions and the template baseline', async () => {
    const student = {
      id: 'ava', name: 'Ava', userId: 'u', createdAt: '2026-01-01',
      goals: [{ id: 'g1', name: 'GAS goal', type: 'GOAL_ATTAINMENT_SCALE', smartGoal: 'Student will participate.',
        gasLevelDescriptions: ['', '', 'Joins with prompts', '', ''] }],
    };
    const backup = createBackup({
      students: [student as unknown as import('../types').Student],
      goalTemplates: [{ ...GAS_TEMPLATES[0], id: 't1', createdAt: new Date() }],
      sessions: [],
    });
    const parsed = parseBackup(await backupFileText(backup));
    expect(parsed.data.students[0].goals[0].gasLevelDescriptions?.[2]).toBe('Joins with prompts');
    expect(parsed.data.goalTemplates[0].baseline).toBe(-2);
    expect(parsed.strippedUnknownFields).toBe(false);
  });
});

describe('default GAS goals by area', () => {
  const areas = ['vocabulary in conversation', 'questions about a story', 'Ask for help', 'Comment to share', 'Combine words to describe', 'Retell a story', 'calm-down strategy', 'Transition between activities', 'Take turns in a conversation', 'Stay on topic', 'Use AAC to comment', 'Use AAC to ask a question', 'Ask for a break', 'do not understand', 'morning routine', 'Pack up belongings'];
  it('every built-in GAS template targets level 0 from a -2 baseline', () => {
    expect(GAS_TEMPLATES.length).toBeGreaterThanOrEqual(20);
    for (const template of GAS_TEMPLATES) {
      expect(template.type).toBe('GOAL_ATTAINMENT_SCALE');
      expect(template.sessionTargetValue).toBe(0);
      expect(template.baseline).toBe(-2);
    }
  });
  it('each area goal carries five written level descriptions, -2 first', () => {
    for (const name of areas) {
      const template = GAS_TEMPLATES.find(t => t.name.includes(name));
      expect(template, name).toBeDefined();
      expect(template!.gasLevelDescriptions).toHaveLength(5);
      for (const text of template!.gasLevelDescriptions!) expect(text.trim().length).toBeGreaterThan(0);
    }
  });
  it('assigning an area goal copies its descriptions and baseline to the student goal', () => {
    const template = { ...GAS_TEMPLATES.find(t => t.name.includes('calm-down strategy'))!, id: 't1', createdAt: new Date() };
    const assigned = goalFromTemplate(template);
    expect(assigned.gasLevelDescriptions).toHaveLength(5);
    expect(assigned.gasLevelDescriptions?.[2]).toContain('on their own after a reminder');
    expect(assigned.baseline).toBe(-2);
  });
  it('a template\'s level descriptions survive a backup round-trip', async () => {
    const template = { ...GAS_TEMPLATES.find(t => t.name.includes('Retell a story'))!, id: 't1', createdAt: new Date() };
    const backup = createBackup({ students: [], goalTemplates: [template], sessions: [] });
    const parsed = parseBackup(await backupFileText(backup));
    expect(parsed.data.goalTemplates[0].gasLevelDescriptions).toHaveLength(5);
    expect(parsed.data.goalTemplates[0].gasLevelDescriptions?.[2]).toContain('beginning, middle, and end');
    expect(parsed.strippedUnknownFields).toBe(false);
  });
});

describe('GAS review fixes', () => {
  it('shows progress toward the target level instead of 0% or a negative share', () => {
    expect(gasProgress(-2, 0)).toBe(0);
    expect(gasProgress(-1, 0)).toBe(50);
    expect(gasProgress(0, 0)).toBe(100);
    expect(gasProgress(2, 0)).toBe(100);
    expect(gasProgress(0, 2)).toBe(50);
    expect(gasProgress(-2, -2)).toBe(100);
  });

  it('does not rewrite the percentage in a GAS goal\'s text to its level target', () => {
    const text = 'Student will join group work with 80% accuracy.';
    expect(matchTextToTarget(text, { type: 'GOAL_ATTAINMENT_SCALE', sessionTargetValue: 0 })).toBe(text);
  });

  it('treats the word "gas" in ordinary goal text as not a GAS goal', () => {
    expect(classifyGoal('Student will identify safety signs such as gas, poison and exit with 80% accuracy').type).not.toBe('GOAL_ATTAINMENT_SCALE');
    expect(classifyGoal('STUDENT WILL IDENTIFY SAFETY SIGNS SUCH AS GAS AND POISON WITH 80% ACCURACY').type).not.toBe('GOAL_ATTAINMENT_SCALE');
    expect(classifyGoal('GAS: Student will take turns in a group game').type).toBe('GOAL_ATTAINMENT_SCALE');
    expect(classifyGoal('Student will reach attainment level 0 when joining group work').type).toBe('GOAL_ATTAINMENT_SCALE');
  });

  it('carries earlier levels forward, so a later date range still counts every goal', () => {
    const g1 = gasGoal({ id: 'g1' });
    const g2 = gasGoal({ id: 'g2' });
    const history = [gasSession('2026-09-01', { g1: -1, g2: -2 }), gasSession('2026-09-08', { g1: 0 })];
    const points = gasTScoresOverTime(history, [g1, g2]);
    const last = points[points.length - 1];
    expect(last.levels).toEqual({ g1: 0, g2: -2 });
    expect(last.tScore).toBe(gasTScore([0, -2]));
  });
});
