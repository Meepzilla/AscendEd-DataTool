import { describe, expect, it } from 'vitest';
import { scoreNextStep, setStepLevel, stepScores, taskAnalysisSummary } from '../task-analysis';

const steps = ['Turn on water', 'Wet hands', 'Get soap'];

describe('task analysis', () => {
  it('scores the next unscored step, then stops when all are scored', () => {
    let data: Record<string, any> | null = {};
    data = scoreNextStep(data, steps, 'Independent')!;
    data = scoreNextStep(data, steps, 'Verbal')!;
    data = scoreNextStep(data, steps, 'NotDone')!;
    expect(stepScores(data, steps).map(s => s.level)).toEqual(['Independent', 'Verbal', 'NotDone']);
    expect(scoreNextStep(data, steps, 'Independent')).toBeNull();
  });
  it('clears a step when the same level is chosen again', () => {
    const data = setStepLevel({}, steps, 1, 'Gestural');
    expect(stepScores(setStepLevel(data, steps, 1, 'Gestural'), steps)[1].level).toBe('');
  });
  it('measures % of scored steps done independently', () => {
    const data = { steps: [{ label: 'a', level: 'Independent' }, { label: 'b', level: 'Verbal' }, { label: 'c', level: '' }, { label: 'd', level: 'Independent' }] };
    expect(taskAnalysisSummary(data)).toEqual({ scored: 3, independent: 2, percent: (2 / 3) * 100 });
    expect(taskAnalysisSummary({}).percent).toBeNull();
  });
  it('does not count NotDone as a scored step', () => {
    const data = { steps: [{ label: 'a', level: 'Independent' }, { label: 'b', level: 'NotDone' }, { label: 'c', level: 'NotDone' }] };
    expect(taskAnalysisSummary(data)).toEqual({ scored: 1, independent: 1, percent: 100 });
    expect(taskAnalysisSummary({ steps: [{ label: 'a', level: 'NotDone' }] })).toEqual({ scored: 0, independent: 0, percent: null });
  });
  it('keeps the step labels a session saved, even when the goal\'s steps changed', () => {
    const saved = [{ label: 'Old name', level: 'Verbal' }, { label: 'Second', level: 'Independent' }];
    expect(stepScores({ steps: saved }, ['Renamed', 'Second', 'Added'])).toEqual(saved);
    expect(stepScores({}, ['Turn on water', 'Wet hands'])).toEqual([
      { label: 'Turn on water', level: '' }, { label: 'Wet hands', level: '' },
    ]);
  });
});
