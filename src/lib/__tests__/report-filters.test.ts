import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  customRangeChoice, quickRangeDates, rangeChoiceDates, readGoalChartView, readGoalChoice, readRangeChoice,
  readReportTab, readTimeGrouping, rememberGoalChartView, rememberGoalChoice, rememberRangeChoice,
  rememberReportTab, rememberTimeGrouping,
} from '../report-filters';
import { memoryStorage } from './helpers';

const NOW = new Date('2026-11-15T10:00:00');
const day = (d?: Date) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined);

describe('Reports filters remembered on the device', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => { storage = memoryStorage(); vi.stubGlobal('window', { localStorage: storage }); vi.stubGlobal('localStorage', storage); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('works out a quick range from today', () => {
    expect(day(quickRangeDates('last-30', NOW)?.from)).toBe('2026-10-16');
    expect(day(quickRangeDates('last-9-weeks', NOW)?.from)).toBe('2026-09-13');
    expect(quickRangeDates('last-9-weeks', NOW)?.to).toBe(NOW);
    expect(quickRangeDates('all', NOW)).toBeUndefined();
    const year = quickRangeDates('school-year', NOW)!;
    expect(year.from!.getTime()).toBeLessThan(NOW.getTime());
  });

  it('remembers a quick range and recomputes it on a later day', () => {
    rememberRangeChoice({ quick: 'last-30' });
    const choice = readRangeChoice();
    expect(choice).toEqual({ quick: 'last-30' });
    expect(day(rangeChoiceDates(choice, new Date('2026-12-01T09:00:00'))?.from)).toBe('2026-11-01');
  });

  it('remembers custom dates as the days picked', () => {
    const choice = customRangeChoice({ from: new Date('2026-09-01T00:00'), to: new Date('2026-10-31T00:00') });
    expect(choice).toEqual({ from: '2026-09-01', to: '2026-10-31' });
    rememberRangeChoice(choice);
    const dates = rangeChoiceDates(readRangeChoice(), NOW)!;
    expect([day(dates.from), day(dates.to)]).toEqual(['2026-09-01', '2026-10-31']);
    // A start date only.
    expect(customRangeChoice({ from: new Date('2026-09-01T00:00') })).toEqual({ from: '2026-09-01' });
    expect(customRangeChoice(undefined)).toBeNull();
  });

  it('treats All, nothing stored and unreadable values as no filter', () => {
    expect(readRangeChoice()).toBeNull();
    rememberRangeChoice({ quick: 'last-30' });
    rememberRangeChoice({ quick: 'all' });
    expect(readRangeChoice()).toBeNull();
    rememberRangeChoice({ quick: 'last-30' });
    rememberRangeChoice(null);
    expect(readRangeChoice()).toBeNull();
    for (const bad of ['not json', '{"quick":"next-century"}', '{"from":"yesterday"}', '[1,2]', '"text"']) {
      storage.setItem('ascended_report_range', bad);
      expect(readRangeChoice()).toBeNull();
    }
    expect(rangeChoiceDates(null)).toBeUndefined();
  });

  it('remembers the goal chosen for each student, while it is still one of their goals', () => {
    rememberGoalChoice('st1', 'g2');
    rememberGoalChoice('st2', 'g9');
    expect(readGoalChoice('st1', ['g1', 'g2'])).toBe('g2');
    expect(readGoalChoice('st2', ['g9'])).toBe('g9');
    // Archived or removed since: all goals.
    expect(readGoalChoice('st1', ['g1'])).toBeUndefined();
    expect(readGoalChoice('st3', ['g1'])).toBeUndefined();
    // Back to all goals for one student leaves the other's choice.
    rememberGoalChoice('st1', undefined);
    expect(readGoalChoice('st1', ['g1', 'g2'])).toBeUndefined();
    expect(readGoalChoice('st2', ['g9'])).toBe('g9');
    rememberGoalChoice('st2', undefined);
    expect(storage.getItem('ascended_report_goals')).toBeNull();
  });

  it('remembers report tab, date grouping, and goal chart view, falling back cleanly on defaults or bad values', () => {
    expect(readReportTab()).toBe('progress');
    expect(readTimeGrouping()).toBe('session');
    expect(readGoalChartView()).toBe('line');

    rememberReportTab('prompts');
    rememberTimeGrouping('week');
    rememberGoalChartView('table');
    expect(readReportTab()).toBe('prompts');
    expect(readTimeGrouping()).toBe('week');
    expect(readGoalChartView()).toBe('table');

    rememberReportTab('progress');
    rememberTimeGrouping('session');
    rememberGoalChartView('line');
    expect(storage.getItem('ascended_report_tab')).toBeNull();
    expect(storage.getItem('ascended_report_grouping')).toBeNull();
    expect(storage.getItem('ascended_report_goal_view')).toBeNull();

    storage.setItem('ascended_report_tab', '"unknown"');
    storage.setItem('ascended_report_grouping', '{corrupt');
    storage.setItem('ascended_report_goal_view', '123');
    expect(readReportTab()).toBe('progress');
    expect(readTimeGrouping()).toBe('session');
    expect(readGoalChartView()).toBe('line');
  });

  it('still works when storage is unavailable', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    vi.stubGlobal('window', { localStorage: blocked });
    expect(() => rememberRangeChoice({ quick: 'last-30' })).not.toThrow();
    expect(() => rememberGoalChoice('st1', 'g1')).not.toThrow();
    expect(() => rememberReportTab('trials')).not.toThrow();
    expect(() => rememberTimeGrouping('month')).not.toThrow();
    expect(() => rememberGoalChartView('bar')).not.toThrow();
    expect(readRangeChoice()).toBeNull();
    expect(readGoalChoice('st1', ['g1'])).toBeUndefined();
    expect(readReportTab()).toBe('progress');
    expect(readTimeGrouping()).toBe('session');
    expect(readGoalChartView()).toBe('line');
  });
});

