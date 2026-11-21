import { describe, expect, it } from 'vitest';
import { CUSTOM_MEASURE_KINDS, CustomGoalTypeSchema, type CustomGoalType, type CustomMeasureKind, type Goal } from '../types';
import { CUSTOM_MEASURE_KIND_INFO, customTypeSummary, defaultCustomGoalType, makeCustomDef } from '../goal-types';
import { goalMeasure, goalMeasureInfo, goalResponses, sessionMeetsTarget, usesPromptCounters } from '../goal-measures';
import { formatGoalTarget } from '../helpers';
import { goalAccuracyText } from '../goal-input-logic';
import { mergeGoalData } from '../session-merge';

// The builder's measures modeled on built-in goal types: prompt levels (Prompting), a trial grid (Discrete
// Trials), response time (Response Time) and utterance length (Language Sample).

const type = (kind: CustomMeasureKind, overrides: Partial<CustomGoalType> = {}): CustomGoalType => ({
  ...defaultCustomGoalType('ct-x'), name: 'Test type', kind, defaultTarget: CUSTOM_MEASURE_KIND_INFO[kind].defaultTarget, ...overrides,
});
const goalOf = (ct: CustomGoalType, target?: number): Goal =>
  ({ id: 'g1', name: 'Goal', type: 'CUSTOM', smartGoal: 'Ada will do it.', customType: ct, sessionTargetValue: target, targetDirection: ct.direction } as Goal);

describe('custom measures modeled on built-in goal types', () => {
  it('are offered by the builder and validate', () => {
    for (const kind of ['prompting', 'trials', 'latency', 'utterances'] as const) {
      expect(CUSTOM_MEASURE_KINDS).toContain(kind);
      expect(CUSTOM_MEASURE_KIND_INFO[kind].description).toMatch(/like /);
      expect(CustomGoalTypeSchema.safeParse(type(kind)).success).toBe(true);
      expect(customTypeSummary(type(kind)).length).toBeGreaterThan(0);
    }
    expect(CustomGoalTypeSchema.safeParse(type('trials', { trials: { count: 0 } })).success).toBe(false);
  });

  it('prompt levels: % independent, with the prompt counters always on', () => {
    const ct = type('prompting');
    const goal = goalOf(ct, 80);
    const data = { ...makeCustomDef(ct).initialData(), Independent: 3, Verbal: 1 };
    expect(usesPromptCounters(goal)).toBe(true);
    expect(goalMeasure(goal, data)).toBe(75);
    expect(goalMeasure(goal, makeCustomDef(ct).initialData())).toBeNull();
    expect(goalAccuracyText(goal, data)).toBe('75.0% independent (3/4)');
    expect(formatGoalTarget(goal, 80)).toBe('80%');
    expect(goalMeasureInfo(goal)).toMatchObject({ label: '% independent', max: 100 });
  });

  it('trial grid: starts with the set number of trials and measures % correct', () => {
    const ct = type('trials', { trials: { count: 4 } });
    const goal = goalOf(ct, 80);
    const fresh = makeCustomDef(ct).initialData();
    expect(fresh.trials).toEqual(['untouched', 'untouched', 'untouched', 'untouched']);
    const data = { ...fresh, trials: ['correct', 'approximate', 'incorrect', 'correct'] };
    expect(goalMeasure(goal, data)).toBe(50);
    expect(goalResponses(goal, data)).toEqual({ correct: 2, incorrect: 1, approximate: 1 });
    expect(goalMeasure(goal, fresh)).toBeNull();
    expect(sessionMeetsTarget(goal, { trials: ['correct', 'correct', 'correct', 'correct'] }, 80)).toBe(true);
    expect(mergeGoalData([data, { trials: ['correct'] }]).trials).toHaveLength(5);
  });

  it('response time: average seconds over trials with a response, aiming to come down', () => {
    const ct = type('latency', { direction: 'decrease' });
    const goal = goalOf(ct, 5);
    const data = { ...makeCustomDef(ct).initialData(), latencies: [4, null, 8] };
    expect(goalMeasure(goal, data)).toBe(6);
    expect(goalAccuracyText(goal, data)).toBe('6.0 s average (2 of 3 responded)');
    expect(formatGoalTarget(goal, 5)).toBe('≤ 5 s average');
    expect(sessionMeetsTarget(goal, { latencies: [3, 4] }, 5)).toBe(true);
    expect(sessionMeetsTarget(goal, data, 5)).toBe(false);
    // Saving stops a running cue timer.
    const saved = makeCustomDef(ct).finalizeData({ ...data, cueGivenAt: 1_000 }, 4_000);
    expect(saved.cueGivenAt).toBeNull();
  });

  it('utterance length: the MLU in the type\'s unit', () => {
    const ct = type('utterances', { utterances: { unit: 'morphemes' } });
    const goal = goalOf(ct, 3);
    const data = { ...makeCustomDef(ct).initialData(), utterances: [2, 3, 4, 3] };
    expect(makeCustomDef(ct).initialData().unit).toBe('morphemes');
    expect(goalMeasure(goal, data)).toBe(3);
    expect(goalMeasureInfo(goal).label).toBe('MLU (morphemes)');
    expect(formatGoalTarget(goal, 3)).toBe('MLU ≥ 3 morphemes');
    expect(goalAccuracyText(goal, data)).toBe('MLU 3 morphemes (4 utterances)');
    expect(mergeGoalData([{ utterances: [2] }, { utterances: [4, 5] }]).utterances).toEqual([2, 4, 5]);
  });
});
