import { describe, expect, it } from 'vitest';
import {
  BEHAVIOR_GOAL_TYPES, COMMUNICATION_MEASURE_TYPES, DEFAULT_GOAL_TEMPLATES, GOAL_TYPE_FIELDS, GOAL_TYPES_WITHOUT_PROMPT_COUNTERS,
  applyDefaultTemplateUpdates, finalizeBehaviorData, goalDirection, hasTargetDirection, toolTypeOf,
} from '../goal-constants';
import { goalMeasure, goalMeasureInfo, goalResponses, meetsTarget } from '../goal-measures';
import { goalAccuracyText } from '../goal-input-logic';
import { applyGoalHotkey } from '../data-entry-hotkeys';
import { formatGoalTarget, goalTypeLabel } from '../helpers';
import { timePatterns, timingMeasure } from '../behavior-timing';
import { measureFormula } from '../report-formulas';
import { goalTarget } from '../student-import';
import { GOAL_TYPE_VALUES, type GoalTemplate, type GoalType } from '../types';
import { goal as goalBuilder, session as sessionBuilder } from './helpers';

// Communication goals measured with the behavior tools (a count, minutes, seconds) or the trial grid
// (opportunities): the same data and the same numbers as the tool, different words and default direction.

const g = (type: GoalType, overrides = {}) => goalBuilder({ type, ...overrides });

describe('communication measure types', () => {
  it('are goal types with their own name, default fields and tool', () => {
    expect(COMMUNICATION_MEASURE_TYPES).toEqual(['COMMUNICATION_COUNT', 'COMMUNICATION_DURATION', 'RESPONSE_TIME', 'COMMUNICATION_OPPORTUNITIES']);
    for (const type of COMMUNICATION_MEASURE_TYPES) {
      expect(GOAL_TYPE_VALUES).toContain(type);
      expect(goalTypeLabel(type)).not.toMatch(/behavior/i);
      // The same starting fields as the tool, so data entry, saving and merging treat both alike.
      expect(Object.keys(GOAL_TYPE_FIELDS[type]).sort()).toEqual(Object.keys(GOAL_TYPE_FIELDS[toolTypeOf(type)]).sort());
      expect(BEHAVIOR_GOAL_TYPES).not.toContain(type);
    }
    expect(toolTypeOf('COMMUNICATION_COUNT')).toBe('BEHAVIOR_FREQUENCY');
    expect(toolTypeOf('COMMUNICATION_DURATION')).toBe('BEHAVIOR_DURATION');
    expect(toolTypeOf('RESPONSE_TIME')).toBe('BEHAVIOR_LATENCY');
    expect(toolTypeOf('COMMUNICATION_OPPORTUNITIES')).toBe('DISCRETE_TRIALS');
    expect(toolTypeOf('ARTICULATION')).toBe('ARTICULATION');
  });

  it('aim up by default, except response time; behavior goals still aim down', () => {
    expect(goalDirection(g('COMMUNICATION_COUNT'))).toBe('increase');
    expect(goalDirection(g('COMMUNICATION_DURATION'))).toBe('increase');
    expect(goalDirection(g('COMMUNICATION_OPPORTUNITIES'))).toBe('increase');
    expect(goalDirection(g('RESPONSE_TIME'))).toBe('decrease');
    expect(goalDirection(g('COMMUNICATION_COUNT', { targetDirection: 'decrease' }))).toBe('decrease');
    expect(goalDirection(g('BEHAVIOR_FREQUENCY'))).toBe('decrease');
    expect(hasTargetDirection('COMMUNICATION_COUNT')).toBe(true);
    expect(hasTargetDirection('RESPONSE_TIME')).toBe(true);
    expect(hasTargetDirection('COMMUNICATION_OPPORTUNITIES')).toBe(false);
    expect(hasTargetDirection('BEHAVIOR_ABC')).toBe(true);
    expect(hasTargetDirection('ARTICULATION')).toBe(false);
  });

  it('measure a count like behavior frequency, met at or above the target', () => {
    const goal = g('COMMUNICATION_COUNT', { sessionTargetValue: 5 });
    expect(goalMeasure(goal, { count: 6 })).toBe(6);
    expect(goalMeasure(goal, { count: 0 })).toBeNull();
    expect(goalMeasure(goal, { count: 0, recorded: true })).toBe(0);
    expect(meetsTarget(goal, 6, 5)).toBe(true);
    expect(meetsTarget(goal, 4, 5)).toBe(false);
    expect(goalMeasureInfo(goal)).toEqual({ label: 'Times', unit: '' });
    expect(formatGoalTarget('COMMUNICATION_COUNT', 5)).toBe('≥ 5 per session');
    expect(formatGoalTarget('COMMUNICATION_COUNT', 3, 'decrease')).toBe('≤ 3 per session');
    expect(measureFormula(goal)).toBe('The number of times counted in the session.');
  });

  it('measure minutes like behavior duration, and stop a running timer when saved', () => {
    const goal = g('COMMUNICATION_DURATION', { sessionTargetValue: 5 });
    expect(goalMeasure(goal, { episodeSeconds: [120, 240] })).toBe(6);
    expect(formatGoalTarget('COMMUNICATION_DURATION', 5)).toBe('≥ 5 min');
    const saved = finalizeBehaviorData('COMMUNICATION_DURATION', { episodeSeconds: [60], episodeStarts: [null], runningSince: 1_000 }, 61_000);
    expect(saved.runningSince).toBeNull();
    expect(saved.episodeSeconds).toEqual([60, 60]);
  });

  it('measure seconds like behavior latency, met at or below the target', () => {
    const goal = g('RESPONSE_TIME', { sessionTargetValue: 5 });
    expect(goalMeasure(goal, { latencies: [2, 4, null] })).toBe(3);
    expect(meetsTarget(goal, 3, 5)).toBe(true);
    expect(meetsTarget(goal, 8, 5)).toBe(false);
    expect(formatGoalTarget('RESPONSE_TIME', 5)).toBe('≤ 5 s average');
    expect(goalMeasureInfo(goal).unit).toBe(' s');
    expect(timingMeasure('RESPONSE_TIME')).toBe('seconds');
    expect(goalTarget('RESPONSE_TIME', 'Student will answer within 8 seconds of the question.')).toBe(8);
  });

  it('score opportunities on the trial grid, as a percentage, with prompt counters', () => {
    const goal = g('COMMUNICATION_OPPORTUNITIES', { sessionTargetValue: 80 });
    const data = { trials: ['correct', 'correct', 'incorrect', 'approximate', 'untouched'] };
    expect(goalResponses('COMMUNICATION_OPPORTUNITIES', data)).toEqual({ correct: 2, incorrect: 1, approximate: 1 });
    expect(goalMeasure(goal, data)).toBe(50);
    expect(goalAccuracyText('COMMUNICATION_OPPORTUNITIES', data)).toBe('50.0% (2/4)');
    expect(goalAccuracyText('COMMUNICATION_OPPORTUNITIES', { trials: ['untouched'] })).toBe('0.0% (0/0)');
    expect(goalMeasureInfo(goal)).toEqual({ label: '% of opportunities', unit: '%', max: 100 });
    expect(formatGoalTarget('COMMUNICATION_OPPORTUNITIES', 80)).toBe('80% of opportunities');
    expect(GOAL_TYPES_WITHOUT_PROMPT_COUNTERS).not.toContain('COMMUNICATION_OPPORTUNITIES');
    expect(GOAL_TYPES_WITHOUT_PROMPT_COUNTERS).toContain('COMMUNICATION_COUNT');
    // The C shortcut fills the next opportunity.
    const next = applyGoalHotkey('COMMUNICATION_OPPORTUNITIES', 'C', { numberOfTrials: 2, trials: ['untouched', 'untouched'] });
    expect(next?.trials).toEqual(['correct', 'untouched']);
  });

  it('the C shortcut counts one more time for a communication count', () => {
    const next = applyGoalHotkey('COMMUNICATION_COUNT', 'C', { count: 1, occurrenceTimes: [null] });
    expect(next?.count).toBe(2);
    expect(next?.occurrenceTimes).toHaveLength(2);
  });

  it('report when it happens from the recorded times', () => {
    const s = sessionBuilder({ date: '2026-10-05', time: '09:00', goals: [] });
    const patterns = timePatterns('COMMUNICATION_COUNT', [{ session: s, data: { count: 2, occurrenceTimes: ['2026-10-05T09:05:00', '2026-10-05T09:20:00'] } }]);
    expect(patterns.eventCount).toBe(2);
    expect(patterns.measure).toBe('count');
  });
});

describe('goal bank goals moved to the communication measure types', () => {
  const bank = DEFAULT_GOAL_TEMPLATES.filter(t => t.bankId);
  const count = (type: GoalType) => bank.filter(t => t.type === type).length;

  it('moves the replacement, timed and counted communication goals off the behavior types', () => {
    expect(count('COMMUNICATION_OPPORTUNITIES')).toBe(15);
    expect(count('COMMUNICATION_DURATION')).toBe(5);
    expect(count('COMMUNICATION_COUNT')).toBe(4);
    expect(count('BEHAVIOR_ABC')).toBe(0);
    expect(count('BEHAVIOR_DURATION')).toBe(0);
    // The one count of a problem behavior to reduce stays a behavior goal.
    expect(bank.filter(t => t.type === 'BEHAVIOR_FREQUENCY').map(t => t.generatedSmartGoal)).toEqual([expect.stringContaining('profanity')]);
    expect(bank.filter(t => t.category === 'Behavior Replacement & Regulation').every(t => t.type === 'COMMUNICATION_OPPORTUNITIES')).toBe(true);
    // The two redirection goals still aim down.
    expect(bank.filter(t => t.type === 'COMMUNICATION_COUNT' && t.targetDirection === 'decrease')).toHaveLength(2);
  });

  it('updates a stored copy of a built-in template that still has the old type, and leaves changed ones alone', () => {
    const current = bank.find(t => t.type === 'COMMUNICATION_OPPORTUNITIES')!;
    const stored = (type: GoalType, extra: Partial<GoalTemplate> = {}) =>
      ({ ...current, id: 't1', createdAt: new Date(), type, targetDirection: 'increase', ...extra }) as GoalTemplate;

    for (const oldType of ['BEHAVIOR_ABC', 'DISCRETE_TRIALS'] as GoalType[]) {
      const { templates, changed } = applyDefaultTemplateUpdates([stored(oldType)]);
      expect(changed).toBe(true);
      expect(templates[0].type).toBe('COMMUNICATION_OPPORTUNITIES');
      expect(templates[0].targetDirection).toBeUndefined();
    }
    // A type the user chose themselves, and a template they made, are not touched.
    expect(applyDefaultTemplateUpdates([stored('QUALITATIVE_OBSERVATION')]).changed).toBe(false);
    expect(applyDefaultTemplateUpdates([stored('BEHAVIOR_ABC', { isDefault: false })]).changed).toBe(false);
  });
});
