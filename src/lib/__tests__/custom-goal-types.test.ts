import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './helpers';
import { BUILT_IN_GOAL_TYPE_VALUES, type CustomGoalType, type Goal, type GoalTemplate, type SessionData, type Student } from '../types';
import { CustomGoalTypeSchema } from '../schemas';
import { BUILT_IN_DEFS, defaultCustomGoalType, getGoalTypeDef } from '../goal-types';
import { goalMeasure, goalMeasureInfo, goalResponses, sessionMeetsTarget, usesPromptCounters } from '../goal-measures';
import { measureFormula } from '../report-formulas';
import { buildNarrative, buildProgressReport } from '../report-narrative';
import { formatGoalTarget, goalTypeLabel } from '../helpers';
import { matchTextToTarget } from '../goal-blanks';
import { goalAccuracyText } from '../goal-input-logic';
import { freshGoalData, sessionFromState } from '../data-entry-session';
import { goalFromTemplate } from '../goal-templates';
import { mergeGoalData } from '../session-merge';
import {
  applyCustomGoalTypeUpdate,
  exportCustomGoalTypesJson,
  findNewerCustomGoalType,
  getCustomGoalTypes,
  saveCustomGoalTypes,
} from '../custom-goal-types';
import { parseCustomGoalTypesImport } from '../custom-goal-types-import';
import { createBackup, parseBackup } from '../backup';
import { restoreBackupSettings } from '../restore';

function sampleCustomType(overrides: Partial<CustomGoalType> = {}): CustomGoalType {
  return {
    ...defaultCustomGoalType('ct-1'),
    name: 'Peer interaction quality',
    description: 'Quality of peer interactions during structured play.',
    color: '#6b46c1',
    ...overrides,
  };
}

describe('Phase 1: GoalTypeDefinition registry for built-in goal types', () => {
  it('registers a complete definition for every built-in goal type', () => {
    for (const type of BUILT_IN_GOAL_TYPE_VALUES) {
      const def = BUILT_IN_DEFS[type];
      expect(def, `Missing BUILT_IN_DEFS entry for ${type}`).toBeDefined();
      expect(def.key).toBe(type);
      expect(def.label.length).toBeGreaterThan(0);
      const goal = { type } as const;
      expect(goalMeasureInfo(goal)).toEqual(def.measureInfo(goal));
      expect(measureFormula(goal)).toBe(def.formulaText(goal));
      expect(usesPromptCounters(type)).toBe(def.usesPromptCounters);
    }
  });
});

describe('Phase 2: Custom goal type measurement methods', () => {
  it('measures accuracy custom types and respects custom labels and approximate toggle', () => {
    const ct = sampleCustomType({
      kind: 'accuracy',
      accuracy: { correctLabel: 'Spontaneous', incorrectLabel: 'Missed', approximate: true },
      defaultTarget: 80,
      direction: 'increase',
    });
    const goal: Goal = {
      id: 'g-acc',
      name: 'Initiate peer greeting',
      type: 'CUSTOM',
      smartGoal: 'Student will initiate peer greeting with 80% accuracy.',
      sessionTargetValue: 80,
      customType: ct,
    };

    expect(goalTypeLabel(goal)).toBe('Peer interaction quality');
    expect(formatGoalTarget(goal, 80)).toBe('80%');
    expect(goalMeasureInfo(goal)).toEqual({ label: 'Accuracy', unit: '%', max: 100 });
    expect(goalMeasure(goal, { correct: 0, incorrect: 0, approximate: 0 })).toBeNull();
    expect(goalMeasure(goal, { correct: 4, incorrect: 1, approximate: 0 })).toBe(80);
    expect(goalResponses(goal, { correct: 4, incorrect: 1, approximate: 1 })).toEqual({
      correct: 4,
      incorrect: 1,
      approximate: 1,
    });
    expect(goalAccuracyText(goal, { correct: 3, incorrect: 1, approximate: 0 })).toBe('75.0% (3/4)');
    expect(measureFormula(goal)).toContain('Spontaneous responses ÷ all responses × 100.');
    expect(matchTextToTarget('Student will greet peers with 80% accuracy.', { ...goal, sessionTargetValue: 90 })).toContain('90%');
  });

  it('measures counter custom types (count and rate per minute) and ignores untouched sessions', () => {
    const ct = sampleCustomType({
      kind: 'counter',
      name: 'Self-advocacy requests',
      counter: { label: 'Requests', perMinute: false },
      defaultTarget: 5,
      direction: 'increase',
    });
    const goal: Goal = {
      id: 'g-cnt',
      name: 'Ask for help',
      type: 'CUSTOM',
      smartGoal: 'Ask for help at least 5 times per session.',
      sessionTargetValue: 5,
      customType: ct,
    };

    expect(goalMeasureInfo(goal)).toEqual({ label: 'Requests', unit: '' });
    expect(formatGoalTarget(goal, 5)).toBe('≥ 5 per session');
    // Untouched 0 is null; recorded 0 is 0.
    expect(goalMeasure(goal, { count: 0 })).toBeNull();
    expect(goalMeasure(goal, { count: 0, recorded: true })).toBe(0);
    expect(goalMeasure(goal, { count: 6 })).toBe(6);
    expect(sessionMeetsTarget(goal, { count: 5 }, 5)).toBe(true);

    // Rate per minute variant
    const rateGoal: Goal = {
      ...goal,
      customType: { ...ct, counter: { label: 'Requests', perMinute: true } },
    };
    expect(goalMeasureInfo(rateGoal)).toEqual({ label: 'Requests per minute', unit: '/min' });
    expect(goalMeasure(rateGoal, { count: 10, observationMinutes: '20', recorded: true })).toBe(0.5);
    expect(formatGoalTarget(rateGoal, 0.5)).toBe('≥ 0.5/min');
  });

  it('measures timer custom types in minutes and stops running timers on save', () => {
    const ct = sampleCustomType({
      kind: 'timer',
      name: 'Engaged play',
      timer: { label: 'Play time' },
      defaultTarget: 10,
      direction: 'increase',
    });
    const goal: Goal = {
      id: 'g-tmr',
      name: 'Sustained peer play',
      type: 'CUSTOM',
      smartGoal: 'Sustain peer play for 10 minutes.',
      sessionTargetValue: 10,
      customType: ct,
    };

    expect(goalMeasureInfo(goal)).toEqual({ label: 'Play time (minutes)', unit: ' min' });
    expect(formatGoalTarget(goal, 10)).toBe('≥ 10 min');
    expect(goalMeasure(goal, { episodeSeconds: [], totalSeconds: 0 })).toBeNull();
    expect(goalMeasure(goal, { episodeSeconds: [180, 120] })).toBe(5);

    // A timer left running when a session is saved is finalized into episodeSeconds.
    const startedAt = Date.now() - 120_000;
    const finalized = getGoalTypeDef(goal).finalizeData(
      { episodeSeconds: [60], episodeStarts: [null], runningSince: startedAt },
      startedAt + 120_000,
    );
    expect(finalized.runningSince).toBeNull();
    expect(finalized.episodeSeconds).toEqual([60, 120]);
    expect(finalized.totalSeconds).toBe(180);
  });

  it('measures custom rating scales with custom bounds and level labels', () => {
    const ct = sampleCustomType({
      kind: 'rating',
      rating: { min: 1, max: 4, levelLabels: ['Absent', 'Emerging', 'Developing', 'Consistent'] },
      defaultTarget: 3,
      direction: 'increase',
    });
    const goal: Goal = {
      id: 'g-rat',
      name: 'Turn-taking quality',
      type: 'CUSTOM',
      smartGoal: 'Demonstrate turn-taking at level 3 out of 4.',
      sessionTargetValue: 3,
      customType: ct,
    };

    expect(goalMeasureInfo(goal)).toEqual({ label: 'Rating (1-4)', unit: '', min: 1, max: 4 });
    expect(formatGoalTarget(goal, 3)).toBe('3 out of 4');
    expect(goalMeasure(goal, {})).toBeNull();
    expect(goalMeasure(goal, { rating: 3 })).toBe(3);
    // Clamps out-of-range stored values to [min, max]
    expect(goalMeasure(goal, { rating: 9 })).toBe(4);
    expect(goalAccuracyText(goal, { rating: 3 })).toBe('3 out of 4 (Developing)');
    // Does not rewrite "80%" in text when the goal is a rating scale
    expect(matchTextToTarget('With 80% accuracy.', { ...goal, sessionTargetValue: 3 })).toBe('With 80% accuracy.');
  });

  it('measures checklist custom types and merges boolean step arrays across session parts', () => {
    const ct = sampleCustomType({
      kind: 'checklist',
      name: 'Morning routine',
      checklist: { steps: ['Greets peer', 'Takes turn', 'Shares materials', 'Ends politely'] },
      defaultTarget: 75,
      direction: 'increase',
    });
    const goal: Goal = {
      id: 'g-chk',
      name: 'Play routine checklist',
      type: 'CUSTOM',
      smartGoal: 'Complete 75% of routine steps.',
      sessionTargetValue: 75,
      customType: ct,
    };

    expect(freshGoalData(goal).steps).toEqual([false, false, false, false]);
    expect(goalMeasure(goal, { steps: [false, false, false, false] })).toBeNull();
    expect(goalMeasure(goal, { steps: [false, false, false, false], recorded: true })).toBe(0);
    expect(goalMeasure(goal, { steps: [true, true, false, true] })).toBe(75);
    expect(goalAccuracyText(goal, { steps: [true, true, false, false] })).toBe('50.0% (2/4 steps)');

    const merged = mergeGoalData([
      { steps: [true, false, false, false], recorded: true },
      { steps: [false, true, true, false], recorded: true },
    ]);
    expect(merged.steps).toEqual([true, true, true, false]);
  });

  it('measures yes/no custom types as 100% or 0%', () => {
    const ct = sampleCustomType({
      kind: 'yesno',
      name: 'Daily check-in',
      yesno: { question: 'Completed check-in independently?' },
      defaultTarget: 80,
      direction: 'increase',
    });
    const goal: Goal = {
      id: 'g-yn',
      name: 'Daily check-in',
      type: 'CUSTOM',
      smartGoal: 'Complete daily check-in in 80% of sessions.',
      sessionTargetValue: 80,
      customType: ct,
    };

    expect(goalMeasure(goal, { met: null })).toBeNull();
    expect(goalMeasure(goal, { met: true })).toBe(100);
    expect(goalMeasure(goal, { met: false })).toBe(0);
    expect(goalAccuracyText(goal, { met: true })).toBe('Yes (100%)');
  });

  it('validates custom goal type schemas', () => {
    const valid = sampleCustomType({
      kind: 'rating',
      rating: { min: 1, max: 4, levelLabels: ['A', 'B', 'C', 'D'] },
      defaultTarget: 3,
    });
    expect(CustomGoalTypeSchema.safeParse(valid).success).toBe(true);

    const badTarget = { ...valid, defaultTarget: 6 };
    expect(CustomGoalTypeSchema.safeParse(badTarget).success).toBe(false);

    const emptyChecklist = sampleCustomType({
      kind: 'checklist',
      checklist: { steps: [] },
    });
    expect(CustomGoalTypeSchema.safeParse(emptyChecklist).success).toBe(false);
  });
});

describe('Copy isolation, versioning, storage, export/import, backup and narrative', () => {
  beforeEach(() => {
    const storage = memoryStorage();
    vi.stubGlobal('window', { dispatchEvent: vi.fn(), localStorage: storage });
    vi.stubGlobal('localStorage', storage);
  });

  it('keeps a copy of customType on templates and goals so library edits do not alter existing goals until updated', () => {
    const v1 = sampleCustomType({
      id: 'ct-peer',
      version: 1,
      name: 'Peer rating',
      kind: 'rating',
      rating: { min: 1, max: 4, levelLabels: ['1', '2', '3', '4'] },
      defaultTarget: 3,
    });
    saveCustomGoalTypes('u1', [v1]);

    const template: GoalTemplate = {
      id: 't1',
      name: 'Peer play template',
      type: 'CUSTOM',
      customType: v1,
      smartGoalPrompt: 'Peer play',
      generatedSmartGoal: 'Student will engage in peer play.',
      sessionTargetValue: 3,
      createdAt: new Date(),
      isDefault: false,
    };
    const assigned = goalFromTemplate(template);
    expect(assigned.customType).toEqual(v1);
    expect(assigned.customType).not.toBe(v1);

    // Edit the custom type in the library to a 1-5 scale (version 2)
    const v2: CustomGoalType = {
      ...v1,
      version: 2,
      rating: { min: 1, max: 5, levelLabels: ['1', '2', '3', '4', '5'] },
    };
    saveCustomGoalTypes('u1', [v2]);

    // Existing goal still uses its v1 snapshot (1-4 scale)
    expect(goalMeasureInfo(assigned).max).toBe(4);
    expect(findNewerCustomGoalType(assigned, getCustomGoalTypes('u1'))).toEqual(v2);

    // Explicit update brings the goal to v2 (1-5 scale)
    const updatedGoal = applyCustomGoalTypeUpdate(assigned, v2);
    expect(goalMeasureInfo(updatedGoal).max).toBe(5);
    expect(findNewerCustomGoalType(updatedGoal, getCustomGoalTypes('u1'))).toBeNull();
  });

  it('exports and imports custom goal types JSON', () => {
    const ct = sampleCustomType({ id: 'ct-exp', name: 'Exported Counter', kind: 'counter' });
    const json = exportCustomGoalTypesJson([ct]);
    const imported = parseCustomGoalTypesImport(json);
    expect(imported).toEqual([ct]);
  });

  it('round-trips custom goal types and custom goals through backup and restore', () => {
    const ct = sampleCustomType({
      id: 'ct-bkp',
      name: 'Backup Checklist',
      kind: 'checklist',
      checklist: { steps: ['Step A', 'Step B'] },
    });
    const goal: Goal = {
      id: 'g1',
      name: 'Follow checklist',
      type: 'CUSTOM',
      customType: ct,
      smartGoal: 'Complete checklist steps.',
      sessionTargetValue: 100,
    };
    const student: Student = { id: 's1', name: 'Ava', goals: [goal], createdAt: '2026-10-01T00:00:00.000Z', userId: 'u-restore' };
    const session: SessionData = {
      sessionId: 'sess-1',
      studentId: 's1',
      studentName: 'Ava',
      date: '2026-11-10T10:00:00.000Z',
      time: '10:00',
      endTime: '10:30',
      activity: 'Group',
      notes: '',
      goals: [{ goalId: 'g1', goalName: 'Follow checklist', goalType: 'CUSTOM', data: { steps: [true, false], recorded: true } }],
      originalGoalHeaders: [goal],
    };

    const backup = createBackup(
      { students: [student], goalTemplates: [], sessions: [session] },
      { customGoalTypes: [ct] },
    );
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.droppedRecords).toEqual([]);
    expect(parsed.droppedSettings).toEqual([]);
    expect(parsed.strippedUnknownFields).toBe(false);
    expect(parsed.data.students[0].goals[0].customType).toEqual(ct);
    expect(parsed.settings?.customGoalTypes).toEqual([ct]);

    const errors: unknown[] = [];
    restoreBackupSettings(parsed, 'replace', 'u-restore', e => errors.push(e));
    expect(errors).toEqual([]);
    expect(getCustomGoalTypes('u-restore')).toEqual([ct]);
  });

  it('builds progress report and narrative sentences for custom goals', () => {
    const ct = sampleCustomType({
      id: 'ct-nar',
      name: 'Peer interaction quality',
      kind: 'rating',
      rating: { min: 1, max: 4, levelLabels: ['Absent', 'Emerging', 'Developing', 'Consistent'] },
      defaultTarget: 3,
      direction: 'increase',
    });
    const goal: Goal = {
      id: 'g-nar',
      name: 'Interact with peers',
      type: 'CUSTOM',
      customType: ct,
      smartGoal: 'Interact with peers at a rating of 3 out of 4.',
      sessionTargetValue: 3,
    };
    const student: Student = { id: 's1', name: 'Ava', goals: [goal], createdAt: '2026-10-01T00:00:00.000Z', userId: 'u1' };
    const sessions: SessionData[] = [
      {
        sessionId: 's-1',
        studentId: 's1',
        studentName: 'Ava',
        date: '2026-11-01T10:00:00.000Z',
        time: '10:00',
        activity: '',
        notes: '',
        goals: [{ goalId: 'g-nar', goalName: goal.name, goalType: 'CUSTOM', data: { rating: 2, recorded: true } }],
        originalGoalHeaders: [goal],
      },
      {
        sessionId: 's-2',
        studentId: 's1',
        studentName: 'Ava',
        date: '2026-11-08T10:00:00.000Z',
        time: '10:00',
        activity: '',
        notes: '',
        goals: [{ goalId: 'g-nar', goalName: goal.name, goalType: 'CUSTOM', data: { rating: 4, recorded: true } }],
        originalGoalHeaders: [goal],
      },
    ];

    const progress = buildProgressReport({ student, goals: [goal], sessions });
    expect(progress[0].typeLabel).toBe('Peer interaction quality');
    expect(progress[0].targetLabel).toBe('3 out of 4');
    expect(progress[0].average).toBe('3 out of 4');
    expect(progress[0].latest).toBe('4 out of 4');

    const narrative = buildNarrative({ student, goals: [goal], sessions, rangeLabel: 'Nov 2026' });
    expect(narrative).toContain('Peer interaction quality; target 3 out of 4');
    expect(narrative).toContain('the rating averaged 3 out of 4');

    // sessionFromState finalizes custom goal data cleanly
    const savedSession = sessionFromState(
      {
        studentId: 's1',
        studentName: 'Ava',
        activity: '',
        notes: '',
        originalGoalHeaders: [goal],
        goalData: { 'g-nar': { rating: 3, recorded: true } },
      },
      { date: new Date('2026-11-15T10:00:00.000Z'), time: '10:00', endTime: '10:30' },
    );
    expect(savedSession.goals[0].goalType).toBe('CUSTOM');
    expect(savedSession.goals[0].data.rating).toBe(3);
  });
});
