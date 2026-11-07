import { describe, expect, it } from 'vitest';
import { averageWorking, goalStatExplanations, measureFormula, responsesWorking, summaryExplanations } from '../report-formulas';
import { aimLine } from '../aim-line';
import { goal } from './helpers';

describe('how report figures are worked out', () => {
  it('describes each goal type\'s measure', () => {
    expect(measureFormula(goal({ type: 'ARTICULATION' }))).toMatch(/^Correct ÷ \(correct \+ approximate \+ incorrect\) × 100/);
    expect(measureFormula(goal({ type: 'FEEDING_SWALLOWING' }))).toMatch(/accepted/);
    expect(measureFormula(goal({ type: 'BEHAVIOR_ABC', targetDirection: 'decrease' }))).toMatch(/incidents with problem behavior/);
    expect(measureFormula(goal({ type: 'BEHAVIOR_ABC', targetDirection: 'increase' }))).toMatch(/replacement skill was used ÷ all incidents/);
    // A goal entered with another type's inputs is described by those.
    expect(measureFormula(goal({ type: 'LANGUAGE_EXPRESSION', dataCaptureType: 'PROMPTING' }))).toMatch(/^Independent ÷/);
    // Fluency counts prolongations as dysfluent, as the narrative does.
    expect(measureFormula(goal({ type: 'FLUENCY_SYLLABLE_STUTTER' }))).toMatch(/prolongations/);
  });

  it('works through a session\'s responses and an average with the numbers', () => {
    expect(responsesWorking({ correct: 8, approximate: 1, incorrect: 1 })).toBe('8 correct ÷ 10 responses (8 + 1 approximate + 1 incorrect) × 100 = 80%');
    expect(responsesWorking({ correct: 3, approximate: 0, incorrect: 1 }, true)).toBe('3 accepted ÷ 4 trials (3 + 1 refused) × 100 = 75%');
    expect(responsesWorking({ correct: 0, approximate: 0, incorrect: 0 })).toBeNull();
    expect(averageWorking([80, 70, 90], '%')).toBe('(80 + 70 + 90) ÷ 3 = 80%');
    expect(averageWorking(Array(10).fill(5), ' min')).toBe('50 (the 10 sessions added up) ÷ 10 = 5 min');
    expect(averageWorking([], '%')).toBeNull();
  });

  it('explains a goal card\'s figures from its sessions', () => {
    const g = goal({ type: 'ARTICULATION', sessionTargetValue: 80, baseline: 40, baselineDate: '2026-09-01', targetDate: '2026-12-01', masterySessions: 3 });
    const recorded = [
      { date: '2026-10-01T15:00:00.000Z', value: 60, data: { correct: 6, incorrect: 4, approximate: 0 } },
      { date: '2026-10-15T15:00:00.000Z', value: 85, data: { correct: 17, incorrect: 2, approximate: 1 } },
    ];
    const e = goalStatExplanations(g, recorded, aimLine(g), 3);
    expect(e.latest).toContain('That session: 17 correct ÷ 20 responses (17 + 1 approximate + 2 incorrect) × 100 = 85%.');
    expect(e.average).toContain('(60 + 85) ÷ 2 = 72.5%');
    expect(e.metTarget).toBe('Sessions where the accuracy was at or above the target (80%): 1 of 2. Mastery is the target met in 3 sessions in a row.');
    expect(e.aimLine).toMatch(/from the baseline \(40% on .*\) to the target \(80% by .*\).*Behind when the last 3 sessions are all below it/);
    expect(e.aimLine).toMatch(/In the latest session the aim line was at 59\.\d% and the accuracy was 85%\./);
  });

  it('shows a stored date-only latest session on its own day (America/Los_Angeles)', () => {
    const g = goal({ type: 'ARTICULATION', sessionTargetValue: 80 });
    const e = goalStatExplanations(g, [{ date: '2026-10-15', value: 85, data: { correct: 17, incorrect: 2, approximate: 1 } }], null, 3);
    expect(e.latest).toContain('(Oct 15, 2026)');
    expect(e.latest).not.toContain('Oct 14');
  });

  it('explains a decrease goal\'s target the other way round', () => {
    const g = goal({ type: 'BEHAVIOR_FREQUENCY', targetDirection: 'decrease', sessionTargetValue: 2 });
    const e = goalStatExplanations(g, [{ date: '2026-10-01T15:00:00.000Z', value: 1, data: { count: 1, recorded: true } }], null, 3);
    expect(e.metTarget).toMatch(/^Sessions where the occurrences was at or below the target \(≤ 2 per session\): 1 of 1\./);
    expect(e.aimLine).toBe('');
  });

  it('explains the Data Summary with the totals', () => {
    const e = summaryExplanations({ correct: 45, incorrect: 10, approximate: 5, opportunities: 60 }, false);
    expect(e.accuracy).toMatch(/^Total correct ÷ total opportunities × 100 = 45 ÷ 60 × 100 = 75%\./);
    expect(e.opportunities).toMatch(/^Correct \+ approximate \+ incorrect = 45 \+ 5 \+ 10 = 60\./);
    expect(summaryExplanations({ correct: 0, incorrect: 0, approximate: 0, opportunities: 0 }, true).accuracy).toMatch(/^No responses/);
  });
});
