import { describe, expect, it } from 'vitest';
import { medianOf, phaseLines, theilSen, visualAnalysis } from '../visual-analysis';
import { GAS_LEVELS, gasBaselineLevel, gasScaleSummary, gasTargetLevel, gasTimeframeText } from '../gas';
import { assignedGoalChanges } from '../goal-changes';
import { backupFileText, createBackup, parseBackup } from '../backup';
import { summarizeAbc } from '../goal-constants';
import { AssignedGoalEditSchema, type Student } from '../types';
import { goal as goalBuilder } from './helpers';

// The worked example in Sohlberg, Hamilton & Turkstra, ch. 5 (Figures 5.2-5.4, Tables 5.1 and 5.2): ten sessions of
// percent accurate, independent strategy use, and a 1-10 quality rating of the same sessions.
const PERCENT = [30, 40, 30, 50, 40, 60, 60, 80, 70, 80];
const QUALITY = [2, 3, 3, 2, 5, 5, 4, 3, 4, 5];

describe('visual analysis (first half vs second half)', () => {
  it('matches the book\'s level, trend and stability for the worked example', () => {
    const a = visualAnalysis(PERCENT, { direction: 'increase', target: 90 })!;
    expect(a.phaseA).toMatchObject({ first: 0, last: 4, count: 5, median: 40, min: 30, max: 50, range: 20 });
    expect(a.phaseB).toMatchObject({ first: 5, last: 9, count: 5, median: 70, min: 60, max: 80, range: 20 });
    expect(a.phaseA.slope).toBeCloseTo(3.75);
    expect(a.phaseB.slope).toBeCloseTo(5);
    expect(a.averageChange).toBeCloseTo(5);
    expect(a.levelChange).toBe(30);
    expect(a.levelVerdict).toBe('better');
    expect(a.trendVerdict).toBe('better');
    // 80 now, 5 per session: 2 more sessions to 90 (the book estimates 2-3).
    expect(a.sessionsToTarget).toBe(2);
    expect(a.fewSessions).toBe(false);
  });

  it('matches the book\'s trend slopes for the quality ratings (rising, then flat)', () => {
    const a = visualAnalysis(QUALITY, { target: 8 })!;
    expect(a.phaseA.slope).toBeCloseTo(0.583, 2);
    expect(a.phaseB.slope).toBe(0);
    expect(a.phaseA.median).toBe(3);
  });

  it('needs at least four sessions and warns under ten', () => {
    expect(visualAnalysis([1, 2, 3])).toBeNull();
    const a = visualAnalysis([1, 2, 3, 4])!;
    expect(a.fewSessions).toBe(true);
    expect(a.phaseA.count).toBe(2);
  });

  it('puts the middle session of an odd count in the second half', () => {
    const a = visualAnalysis([1, 2, 3, 4, 5])!;
    expect(a.phaseA).toMatchObject({ first: 0, last: 1, count: 2 });
    expect(a.phaseB).toMatchObject({ first: 2, last: 4, count: 3 });
  });

  it('reads a fall as better for a decrease goal and counts sessions down to the target', () => {
    const a = visualAnalysis([8, 7, 7, 6, 5, 4], { direction: 'decrease', target: 2 })!;
    expect(a.levelVerdict).toBe('better');
    expect(a.trendVerdict).toBe('better');
    expect(a.sessionsToTarget).toBeGreaterThan(0);
  });

  it('says when the data are not moving toward the target, and when it is already met', () => {
    expect(visualAnalysis([50, 40, 45, 35, 30, 30], { target: 80 })!.sessionsToTarget).toBeNull();
    expect(visualAnalysis([50, 60, 70, 80], { target: 80 })!.sessionsToTarget).toBe(0);
  });

  it('calls a flat data set flat', () => {
    const a = visualAnalysis([3, 3, 3, 3, 3, 3])!;
    expect(a.levelVerdict).toBe('flat');
    expect(a.trendVerdict).toBe('flat');
  });

  it('ignores values that are not numbers', () => {
    expect(visualAnalysis([NaN, 1, 2, NaN, 3, 4])!.phaseA.count).toBe(2);
  });

  it('gives each session its phase\'s median and trend line for the chart', () => {
    const a = visualAnalysis(PERCENT)!;
    const lines = phaseLines(a, PERCENT.length);
    expect(lines.map(l => l.phase).join('')).toBe('AAAAABBBBB');
    expect(lines[0].median).toBe(40);
    expect(lines[9].median).toBe(70);
    // Second half: intercept 60 at its first session, 5 per session → 80 at the last.
    expect(lines[5].trend).toBeCloseTo(60);
    expect(lines[9].trend).toBeCloseTo(80);
  });

  it('medians and Theil-Sen lines', () => {
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([4, 1, 2, 3])).toBe(2.5);
    expect(theilSen([5])).toEqual({ slope: 0, intercept: 5 });
    // One wild point barely moves the line.
    expect(theilSen([1, 2, 3, 100, 5]).slope).toBe(1);
  });
});

describe('the GAS scale (book layout)', () => {
  it('names the levels as the book does, with the student\'s own wording', () => {
    expect(GAS_LEVELS.map(l => l.description)).toEqual([
      'Much less than expected', 'Less than expected', 'Expected outcome', 'Better than expected', 'Much better than expected',
    ]);
    expect(GAS_LEVELS.find(l => l.level === -1)!.studentWording).toBe('Where I am now');
  });

  it('finds the target and baseline levels', () => {
    expect(gasTargetLevel({})).toBe(0);
    expect(gasTargetLevel({ sessionTargetValue: 1 })).toBe(1);
    expect(gasTargetLevel({ sessionTargetValue: 80 })).toBe(0);
    expect(gasBaselineLevel({ baseline: -1 })).toBe(-1);
    expect(gasBaselineLevel({})).toBeNull();
    expect(gasBaselineLevel({ baseline: 40 })).toBeNull();
  });

  it('writes the timeframe from the goal, or from its target date and mastery', () => {
    const day = (d: string) => `<${d}>`;
    expect(gasTimeframeText({ gasTimeframe: '  Level 0 by winter break ' }, day)).toBe('Level 0 by winter break');
    expect(gasTimeframeText({ targetDate: '2027-03-01', masterySessions: 2 }, day)).toBe('Level 0 or better in 2 sessions in a row by <2027-03-01>');
    expect(gasTimeframeText({}, day)).toBeNull();
  });

  it('counts sessions at each level and the latest', () => {
    const summary = gasScaleSummary([
      { date: '2026-10-01', value: -1 }, { date: '2026-10-08', value: 0 }, { date: '2026-10-15', value: 1 }, { date: '2026-10-22', value: 0.5 },
    ]);
    expect(summary.counts).toEqual({ [-2]: 0, [-1]: 1, 0: 1, 1: 1, 2: 0 });
    expect(summary.total).toBe(3);
    expect(summary.latest).toEqual({ level: 1, date: '2026-10-15' });
    expect(summary.atTarget).toBe(2);
  });

  it('keeps the scale details through the editor schema, change list and backups', async () => {
    const parsed = AssignedGoalEditSchema.parse({
      name: 'Calls for help', smartGoal: 'Student will ask for help when stuck.',
      gasContext: 'Math block', gasTimeframe: 'By March', gasMeasurementPlan: 'SLP rates each session',
    });
    expect(parsed).toMatchObject({ gasContext: 'Math block', gasTimeframe: 'By March', gasMeasurementPlan: 'SLP rates each session' });

    const original = goalBuilder({ type: 'GOAL_ATTAINMENT_SCALE', gasContext: 'Math block' });
    const changes = assignedGoalChanges(original, { gasContext: 'Reading block', gasTimeframe: '', gasMeasurementPlan: 'Teacher log' });
    expect(changes.map(c => c.label)).toEqual(['GAS context', 'GAS measurement plan']);

    const student = {
      id: 'st1', name: 'Test Student', createdAt: '2026-01-01',
      goals: [{ ...original, gasTimeframe: 'By March', gasMeasurementPlan: 'Teacher log' }],
    } as unknown as Student;
    const restored = parseBackup(await backupFileText(createBackup({ students: [student], goalTemplates: [], sessions: [] })));
    expect(restored.data.students[0].goals[0]).toMatchObject({ gasContext: 'Math block', gasTimeframe: 'By March', gasMeasurementPlan: 'Teacher log' });
    expect(restored.strippedUnknownFields).toBe(false);
  });
});

describe('ABC patterns', () => {
  it('tallies consequences and whole antecedent → behavior → consequence patterns of problem behavior', () => {
    const abc = summarizeAbc({
      incidents: [
        { antecedents: ['Demand'], behaviors: ['Yelling'], consequences: ['Task removed'] },
        { antecedents: ['Demand'], behaviors: ['Yelling'], consequences: ['Task removed'] },
        { antecedents: [], behaviors: ['Hitting'], consequences: ['Attention'] },
        { antecedents: ['Demand'], behaviors: ['Used replacement skill'], consequences: ['Praise'] },
      ],
    });
    expect(abc.sequences).toEqual([['Demand → Yelling → Task removed', 2], ['? → Hitting → Attention', 1]]);
    expect(abc.consequences).toEqual([['Task removed', 2], ['Attention', 1]]);
  });
});
