import { describe, expect, it } from 'vitest';
import {
  buildCombinedChartSeries,
  buildGoalOutcomeComparison,
  buildGoalTrialSequences,
  buildPromptSummary,
  collectRecordedGoalSessions,
  groupGoalPoints,
} from '../report-chart-views';
import { aimLine } from '../aim-line';
import type { Goal, SessionData } from '../types';
import { goal } from './helpers';
import { defaultCustomGoalType } from '../goal-types';

function makeSession(
  sessionId: string,
  date: string,
  goalEntries: { goalId: string; data: Record<string, any> }[],
): SessionData {
  return {
    sessionId,
    studentId: 'stu-1',
    studentName: 'Alex Rivera',
    date,
    time: '09:00',
    endTime: '09:30',
    activity: 'Therapy',
    notes: '',
    goals: goalEntries.map(g => ({
      goalId: g.goalId,
      goalName: g.goalId,
      goalType: 'ARTICULATION',
      data: g.data,
    })),
    originalGoalHeaders: [],
  };
}

describe('report-chart-views data transformations', () => {
  const articGoal: Goal = goal({
    id: 'g-artic',
    name: 'Produce /r/ in sentences',
    type: 'ARTICULATION',
    sessionTargetValue: 80,
    baseline: 40,
    baselineDate: '2026-10-01',
    targetDate: '2026-12-01',
  });

  const dttGoalA: Goal = goal({
    id: 'g-dtt-a',
    name: 'Identify spatial concepts',
    type: 'DISCRETE_TRIALS',
    sessionTargetValue: 80,
  });

  const dttGoalB: Goal = goal({
    id: 'g-dtt-b',
    name: 'Follow 2-step directions',
    type: 'DISCRETE_TRIALS',
    sessionTargetValue: 75,
  });

  const behaviorGoal: Goal = goal({
    id: 'g-beh',
    name: 'Reduce task refusal',
    type: 'BEHAVIOR_FREQUENCY',
    targetDirection: 'decrease',
    sessionTargetValue: 2,
  });

  it('groups goal points by session, week, and month accurately', () => {
    const sessions = [
      // Week of Oct 4, 2026 (Oct 5 is Mon, Oct 7 is Wed)
      makeSession('s1', '2026-10-05', [{ goalId: 'g-artic', data: { correct: 6, approximate: 1, incorrect: 3, Independent: 4, Visual: 2, notes: 'Warmed up fast' } }]),
      makeSession('s2', '2026-10-07', [{ goalId: 'g-artic', data: { correct: 8, approximate: 0, incorrect: 12, Independent: 7, Verbal: 1 } }]),
      // Week of Nov 1, 2026 (Nov 3 is Tue)
      makeSession('s3', '2026-11-03', [{ goalId: 'g-artic', data: { correct: 9, approximate: 0, incorrect: 1, Independent: 9 } }]),
    ];

    const recorded = collectRecordedGoalSessions(articGoal, sessions);
    const aim = aimLine(articGoal, sessions[0].date);

    const bySession = groupGoalPoints(articGoal, recorded, 'session', aim);
    expect(bySession).toHaveLength(3);
    expect(bySession.map(p => p.value)).toEqual([60, 40, 90]);
    expect(bySession.map(p => p.metTarget)).toEqual([false, false, true]);
    expect(bySession[0].promptsSummary).toBe('Ind 4, Vis 2');
    expect(bySession[0].notes).toBe('Warmed up fast');

    const byWeek = groupGoalPoints(articGoal, recorded, 'week', aim);
    expect(byWeek).toHaveLength(2);
    expect(byWeek[0].label).toBe('Wk of Oct 4');
    expect(byWeek[0].sessionCount).toBe(2);
    // Pooled by denominator: (6 + 8) correct of (10 + 20) responses = 46.7%, not the mean of 60 and 40.
    expect(byWeek[0].value).toBe(46.7);
    expect(byWeek[0].metCount).toBe(0);
    expect(byWeek[0].correct).toBe(14);
    expect(byWeek[0].opportunities).toBe(30);
    expect(byWeek[0].promptsSummary).toBe('Ind 11, Vis 2, V 1');

    const byMonth = groupGoalPoints(articGoal, recorded, 'month', aim);
    expect(byMonth).toHaveLength(2);
    expect(byMonth.map(p => p.label)).toEqual(['Oct', 'Nov']);
    expect(byMonth.map(p => p.value)).toEqual([46.7, 90]);
  });

  it('builds combined series across time groupings with pooled accuracy and independence rate', () => {
    const fluencyGoal: Goal = goal({
      id: 'g-fluency',
      name: 'Smooth speech',
      type: 'FLUENCY_SYLLABLE_STUTTER',
      sessionTargetValue: 95,
    });
    const sessions = [
      makeSession('s1', '2026-10-05', [
        { goalId: 'g-artic', data: { correct: 5, incorrect: 5, Independent: 3, Visual: 2 } },
        { goalId: 'g-fluency', data: { totalSyllables: 100, stutteredSyllables: 10, blocks: 4, repetitions: 6 } },
      ]),
      makeSession('s2', '2026-10-06', [
        { goalId: 'g-artic', data: { correct: 9, incorrect: 1, Independent: 8, Visual: 2 } },
        { goalId: 'g-fluency', data: { totalSyllables: 100, stutteredSyllables: 4, blocks: 1, repetitions: 3 } },
      ]),
    ];

    const perSession = buildCombinedChartSeries(sessions, [articGoal, fluencyGoal], 'session');
    expect(perSession).toHaveLength(2);
    expect(perSession[0].accuracy).toBe(50);
    expect(perSession[0].independenceRate).toBe(60); // 3 / 5
    expect(perSession[0].fluencyPct).toBe(90);
    expect(perSession[1].accuracy).toBe(90);
    expect(perSession[1].weightedTrend).toBe(70); // (5+9)/(10+10) = 14/20 = 70%

    const perWeek = buildCombinedChartSeries(sessions, [articGoal, fluencyGoal], 'week');
    expect(perWeek).toHaveLength(1);
    expect(perWeek[0].sessionCount).toBe(2);
    expect(perWeek[0].accuracy).toBe(70);
    expect(perWeek[0].independenceRate).toBe(73.3); // 11 / 15
    expect(perWeek[0].fluencyPct).toBe(93); // (200 - 14) / 200
  });

  it('consolidates prompt breakdown and ignores non-prompt goals when counting unprompted sessions', () => {
    const sessions = [
      // Session 1: Articulation worked on with 0 prompts, plus Behavior goal
      makeSession('s1', '2026-10-05', [
        { goalId: 'g-artic', data: { correct: 8, incorrect: 2, Independent: 8 } },
        { goalId: 'g-beh', data: { count: 1, recorded: true } },
      ]),
      // Session 2: Articulation worked on with 3 Visual + 1 Verbal prompts
      makeSession('s2', '2026-10-06', [
        { goalId: 'g-artic', data: { correct: 7, incorrect: 3, Independent: 4, Visual: 3, Verbal: 1 } },
      ]),
      // Session 3: Only Behavior goal worked on (should NOT inflate unprompted prompt-goal sessions)
      makeSession('s3', '2026-10-07', [
        { goalId: 'g-beh', data: { count: 0, recorded: true } },
      ]),
    ];

    const summary = buildPromptSummary(sessions, [articGoal, behaviorGoal]);
    expect(summary.totalIndependent).toBe(12);
    expect(summary.totalPrompted).toBe(4);
    expect(summary.totalTallied).toBe(16);
    expect(summary.independenceRate).toBe(75);
    expect(summary.mostUsedPrompt).toEqual({ key: 'Visual', label: 'Visual', count: 3 });
    expect(summary.sessionsWithPromptGoals).toBe(2);
    expect(summary.unpromptedSessions).toBe(1);
    expect(summary.sessionBins.find(b => b.name === '0 prompts')?.count).toBe(1);
    expect(summary.sessionBins.find(b => b.name === '1–5')?.count).toBe(1);
  });

  it('builds side-by-side outcome comparisons for trial-based goals only', () => {
    const sessions = [
      makeSession('s1', '2026-10-05', [
        { goalId: 'g-artic', data: { correct: 7, approximate: 1, incorrect: 2 } },
        { goalId: 'g-dtt-a', data: { trials: ['correct', 'correct', 'incorrect', 'correct', 'untouched'] } },
        { goalId: 'g-beh', data: { count: 2, recorded: true } },
      ]),
    ];

    const comparison = buildGoalOutcomeComparison(sessions, [articGoal, dttGoalA, behaviorGoal]);
    expect(comparison).toHaveLength(2);
    expect(comparison[0]).toMatchObject({
      goalId: 'g-artic',
      correct: 7,
      approximate: 1,
      incorrect: 2,
      opportunities: 10,
      correctPct: 70,
      approximatePct: 10,
      incorrectPct: 20,
      target: 80,
    });
    expect(comparison[1]).toMatchObject({
      goalId: 'g-dtt-a',
      correct: 3,
      approximate: 0,
      incorrect: 1,
      opportunities: 4,
      correctPct: 75,
      target: 80,
    });
  });

  it('separates trial sequences by goal and calculates first-half vs second-half accuracy', () => {
    const sessions = [
      makeSession('s1', '2026-10-05', [
        // 6 trials: first half 3/3 (100%), second half 1/3 (33.3%) -> end-of-session fatigue pattern
        { goalId: 'g-dtt-a', data: { trials: ['correct', 'correct', 'correct', 'correct', 'incorrect', 'incorrect'] } },
        // Different goal in the same session: kept in its own group!
        { goalId: 'g-dtt-b', data: { trials: ['incorrect', 'correct', 'correct', 'correct'] } },
      ]),
    ];

    const groups = buildGoalTrialSequences(sessions, [dttGoalA, dttGoalB]);
    expect(groups).toHaveLength(2);

    expect(groups[0].goalId).toBe('g-dtt-a');
    expect(groups[0].totalTrials).toBe(6);
    expect(groups[0].overallAccuracyPct).toBe(66.7);
    expect(groups[0].firstHalfAccuracyPct).toBe(100);
    expect(groups[0].secondHalfAccuracyPct).toBe(33.3);
    expect(groups[0].sessions[0].trials).toEqual(['correct', 'correct', 'correct', 'correct', 'incorrect', 'incorrect']);

    expect(groups[1].goalId).toBe('g-dtt-b');
    expect(groups[1].totalTrials).toBe(4);
    expect(groups[1].firstHalfAccuracyPct).toBe(50);
    expect(groups[1].secondHalfAccuracyPct).toBe(100);
  });
});

describe('reports accuracy fixes (C1, C2, C5)', () => {
  it('C1: keeps MLU series to sessions counted in the goal\u2019s current unit', () => {
    const mluGoal: Goal = goal({
      id: 'g-mlu', name: 'MLU in morphemes', type: 'LANGUAGE_SAMPLE',
      sampleUnit: 'morphemes', sessionTargetValue: 3,
    } as Partial<Goal>);
    const sessions = [
      makeSession('s1', '2026-10-05', [{ goalId: 'g-mlu', data: { unit: 'words', utterances: [2, 2] } }]), // MLU 2 in words
      makeSession('s2', '2026-10-07', [{ goalId: 'g-mlu', data: { unit: 'morphemes', utterances: [3, 5] } }]), // MLU 4 in morphemes
      makeSession('s3', '2026-10-09', [{ goalId: 'g-mlu', data: { utterances: [4] } }]), // no stored unit: the goal's (morphemes)
    ];
    const recorded = collectRecordedGoalSessions(mluGoal, sessions);
    expect(recorded.map(r => r.value)).toEqual([4, 4]); // the words session is left out, not pooled in
  });

  it('C1: applies the same unit filter to custom utterances types', () => {
    const ct = {
      ...defaultCustomGoalType('ct-mlu'), name: 'MLU words', kind: 'utterances' as const,
      utterances: { unit: 'words' as const },
    };
    const customGoal = {
      id: 'g-cmlu', name: 'Custom MLU', type: 'CUSTOM', customType: ct, sessionTargetValue: 3,
    } as unknown as Goal;
    const sessions = [
      makeSession('s1', '2026-10-05', [{ goalId: 'g-cmlu', data: { unit: 'morphemes', utterances: [6, 6] } }]),
      makeSession('s2', '2026-10-07', [{ goalId: 'g-cmlu', data: { unit: 'words', utterances: [2, 4] } }]),
    ];
    const recorded = collectRecordedGoalSessions(customGoal, sessions);
    expect(recorded.map(r => r.value)).toEqual([3]); // only the words session, MLU (2 + 4) / 2
  });

  it('C2: pools grouped MLU by utterance count, not by session', () => {
    const mluGoal: Goal = goal({
      id: 'g-mlu2', name: 'MLU in words', type: 'LANGUAGE_SAMPLE',
      sampleUnit: 'words', sessionTargetValue: 3,
    } as Partial<Goal>);
    const sessions = [
      makeSession('s1', '2026-10-05', [{ goalId: 'g-mlu2', data: { unit: 'words', utterances: [10] } }]), // MLU 10, 1 utterance
      makeSession('s2', '2026-10-07', [{ goalId: 'g-mlu2', data: { unit: 'words', utterances: Array(99).fill(2) } }]), // MLU 2, 99 utterances
    ];
    const recorded = collectRecordedGoalSessions(mluGoal, sessions);
    const byWeek = groupGoalPoints(mluGoal, recorded, 'week', null);
    expect(byWeek).toHaveLength(1);
    expect(byWeek[0].value).toBe(2.1); // (10 + 99 x 2) / 100 pooled, not the mean of 10 and 2
  });

  it('C5: ignores prompt fields carried on goals that do not use prompt counters', () => {
    const behaviorGoal: Goal = goal({
      id: 'g-beh', name: 'Reduce task refusal', type: 'BEHAVIOR_FREQUENCY', targetDirection: 'decrease', sessionTargetValue: 2,
    });
    const sessions = [
      makeSession('s1', '2026-10-05', [
        { goalId: 'g-beh', data: { count: 1, recorded: true, Independent: 5, Visual: 5 } },
      ]),
    ];
    const summary = buildPromptSummary(sessions, [behaviorGoal]);
    expect(summary.totalTallied).toBe(0);
    expect(summary.independenceRate).toBeNull();
    expect(summary.sessionsWithPromptGoals).toBe(0);

    const rows = buildCombinedChartSeries(sessions, [behaviorGoal], 'session');
    expect(rows).toHaveLength(1);
    expect(rows[0].totalPromptTallies).toBe(0);
    expect(rows[0].independenceRate).toBeNull();
  });
});
