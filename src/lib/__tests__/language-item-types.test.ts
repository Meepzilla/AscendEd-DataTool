import { describe, expect, it } from 'vitest';
import { GOAL_TYPE_FIELDS, GOAL_TYPES_WITHOUT_PROMPT_COUNTERS } from '../goal-constants';
import { DEFAULT_GOAL_TEMPLATES } from '../goal-constants/seed-bank';
import { goalMeasure, goalMeasureInfo, sessionMeetsTarget } from '../goal-measures';
import { applyGoalHotkey } from '../data-entry-hotkeys';
import { formatGoalTarget, goalTypeLabel } from '../helpers';
import { measureFormula } from '../report-formulas';
import { classifyGoal, goalTarget } from '../student-import';
import { mergeGoalData } from '../session-merge';
import { buildNarrative } from '../report-narrative';
import { goalFromTemplate } from '../goal-templates';
import { assignedGoalChanges } from '../goal-changes';
import { GOAL_TYPE_VALUES, type GoalTemplate } from '../types';
import { AssignedGoalEditSchema } from '../schemas';
import {
  MAX_UTTERANCE_LENGTH, addUtterance, formatSampleLength, languageSampleSummary, lengthDistribution, removeUtterance, sampleUnit,
  sessionSampleUnit, utteranceLengths,
} from '../language-sample';
import {
  ITEM_MASTERY_RUN, itemHistory, itemMasterySummary, itemScores, listItems, masteredOverTime, scoreNextItem, setItemResult,
} from '../item-mastery';
import { goal as goalBuilder, session as sessionBuilder } from './helpers';

const mlu = (overrides = {}) => goalBuilder({ type: 'LANGUAGE_SAMPLE', sessionTargetValue: 3, ...overrides });
const items = (overrides = {}) => goalBuilder({ type: 'ITEM_MASTERY', sessionTargetValue: 80, listItems: ['want', 'more', 'help'], ...overrides });
const marks = (...results: ('correct' | 'incorrect' | '')[]) => ({ items: ['want', 'more', 'help'].map((label, i) => ({ label, result: results[i] ?? '' })) });

describe('language sample and item mastery goal types', () => {
  it('are built-in types with their own fields, names and no prompt counters', () => {
    for (const type of ['LANGUAGE_SAMPLE', 'ITEM_MASTERY'] as const) {
      expect(GOAL_TYPE_VALUES).toContain(type);
      expect(GOAL_TYPE_FIELDS[type]).toBeDefined();
      expect(GOAL_TYPES_WITHOUT_PROMPT_COUNTERS).toContain(type);
    }
    expect(goalTypeLabel('LANGUAGE_SAMPLE')).toBe('Language Sample');
    expect(goalTypeLabel('ITEM_MASTERY')).toBe('Item Mastery');
  });

  it('come with templates that copy their unit and items to the assigned goal', () => {
    const templates = DEFAULT_GOAL_TEMPLATES.filter(t => t.type === 'LANGUAGE_SAMPLE' || t.type === 'ITEM_MASTERY');
    expect(templates.length).toBeGreaterThanOrEqual(4);
    const morph = templates.find(t => t.sampleUnit === 'morphemes')!;
    expect(goalFromTemplate({ ...morph, id: 't1', createdAt: '' } as unknown as GoalTemplate).sampleUnit).toBe('morphemes');
    const core = templates.find(t => t.name.startsWith('Use core vocabulary'))!;
    const assigned = goalFromTemplate({ ...core, id: 't2', createdAt: '' } as unknown as GoalTemplate);
    expect(assigned.listItems).toContain('want');
    expect(assigned.listItems).not.toBe(core.listItems);
  });
});

describe('language sample (MLU)', () => {
  it('measures the mean length of utterance and ignores lengths out of range', () => {
    const data = { utterances: [2, 3, 4, 'x', 0, MAX_UTTERANCE_LENGTH + 1, 3] };
    expect(utteranceLengths(data)).toEqual([2, 3, 4, 3]);
    expect(languageSampleSummary(data)).toEqual({ utterances: 4, total: 12, mlu: 3, longest: 4 });
    expect(goalMeasure(mlu(), data)).toBe(3);
    expect(goalMeasure(mlu(), { utterances: [] })).toBeNull();
    expect(sessionMeetsTarget(mlu(), data, 3)).toBe(true);
    expect(sessionMeetsTarget(mlu(), { utterances: [1, 2] }, 3)).toBe(false);
  });

  it('adds and removes utterances, keeping the unit the session was counted in', () => {
    let data: Record<string, any> = { utterances: [], notes: '' };
    data = addUtterance(data, 3, 'morphemes');
    data = addUtterance(data, 5, 'words'); // the session already counts morphemes
    data = addUtterance(data, 0, 'words'); // ignored
    expect(data.utterances).toEqual([3, 5]);
    expect(sessionSampleUnit(data)).toBe('morphemes');
    expect(removeUtterance(data).utterances).toEqual([3]);
    expect(removeUtterance(data, 0).utterances).toEqual([5]);
  });

  it('is worded in the goal\'s unit', () => {
    expect(sampleUnit(mlu())).toBe('words');
    expect(goalMeasureInfo(mlu({ sampleUnit: 'morphemes' })).label).toBe('MLU (morphemes)');
    expect(formatGoalTarget(mlu(), 3.5)).toBe('MLU ≥ 3.5 words');
    expect(formatGoalTarget(mlu({ sampleUnit: 'morphemes' }), 1)).toBe('MLU ≥ 1 morpheme');
    expect(formatSampleLength(2.456, 'words')).toBe('2.46 words');
    expect(measureFormula(mlu())).toMatch(/words in all the utterances/);
  });

  it('counts utterances by length, with the longest ones together', () => {
    const rows = lengthDistribution([1, 1, 2, 12, 10], 10);
    expect(rows[0]).toMatchObject({ label: '1', count: 2 });
    expect(rows[9]).toMatchObject({ label: '10+', count: 2 });
  });

  it('joins the utterances of a session saved in parts', () => {
    expect(mergeGoalData([{ utterances: [2, 3], unit: 'words' }, { utterances: [4], unit: 'words' }]).utterances).toEqual([2, 3, 4]);
  });

  it('is recognized from IEP wording, with the MLU as the target', () => {
    expect(classifyGoal('By June, Ada will increase her MLU to 3.5 words during play.').type).toBe('LANGUAGE_SAMPLE');
    expect(classifyGoal('Ada will use a mean length of utterance of 4 morphemes in conversation.').type).toBe('LANGUAGE_SAMPLE');
    expect(goalTarget('LANGUAGE_SAMPLE', 'increase her MLU to 3.5 words')).toBe(3.5);
    expect(goalTarget('LANGUAGE_SAMPLE', 'longer utterances')).toBe(3);
  });

  it('adds the sample to the narrative', () => {
    const goal = mlu({ id: 'g1', name: 'MLU' });
    const sessions = [
      sessionBuilder({ date: '2026-10-01', goals: [{ goalId: 'g1', goalName: 'MLU', goalType: 'LANGUAGE_SAMPLE', data: { utterances: [2, 2, 3] } }] }),
      sessionBuilder({ date: '2026-10-08', goals: [{ goalId: 'g1', goalName: 'MLU', goalType: 'LANGUAGE_SAMPLE', data: { utterances: [3, 4, 5] } }] }),
    ];
    const text = buildNarrative({ student: { id: 'st1', name: 'Test Student Ada', goals: [goal], createdAt: '' } as any, goals: [goal], sessions });
    expect(text).toMatch(/6 utterances were sampled/);
    expect(text).toMatch(/longest utterance was 5 words/);
    expect(text).toMatch(/from 2.33 words in the first sample to 4 words/);
  });

  it('keeps the narrative MLU and progress report to samples counted in the goal\u2019s current unit (C1)', () => {
    const goal = mlu({ id: 'g1', name: 'MLU', sampleUnit: 'morphemes' });
    const sessions = [
      sessionBuilder({ date: '2026-10-01', goals: [{ goalId: 'g1', goalName: 'MLU', goalType: 'LANGUAGE_SAMPLE', data: { unit: 'words', utterances: [2, 2] } }] }),
      sessionBuilder({ date: '2026-10-08', goals: [{ goalId: 'g1', goalName: 'MLU', goalType: 'LANGUAGE_SAMPLE', data: { unit: 'morphemes', utterances: [3, 5] } }] }),
    ];
    const student = { id: 'st1', name: 'Test Student Ada', goals: [goal], createdAt: '' } as any;
    const text = buildNarrative({ student, goals: [goal], sessions });
    expect(text).toContain('This summary covers 1 session with Test');
    expect(text).toContain('Data were recorded in 1 session');
    expect(text).not.toMatch(/averaged 3 morphemes/);
    expect(text).toMatch(/2 utterances were sampled/);
    expect(text).toMatch(/overall MLU of 4 morphemes/);
    expect(text).toMatch(/1 sample counted in words is not included/);
  });
});

describe('item mastery', () => {
  it('reads the goal\'s items without blanks or repeats', () => {
    expect(listItems({ listItems: [' want', '', 'Want', 'more'] })).toEqual(['want', 'more']);
  });

  it('measures the percentage of items tried that were correct', () => {
    expect(itemMasterySummary(marks('correct', 'incorrect', ''))).toEqual({ tried: 2, correct: 1, percent: 50 });
    expect(goalMeasure(items(), marks('correct', 'correct', 'incorrect'))).toBeCloseTo(66.67, 1);
    expect(goalMeasure(items(), marks('', '', ''))).toBeNull();
    expect(formatGoalTarget(items(), 80)).toBe('80% of items correct');
  });

  it('marks and clears items, and marks the next one from the keyboard', () => {
    const list = ['want', 'more', 'help'];
    let data: Record<string, any> = { items: [] };
    data = setItemResult(data, list, 1, 'correct');
    expect(itemScores(data, list).map(s => s.result)).toEqual(['', 'correct', '']);
    expect(itemScores(setItemResult(data, list, 1, 'correct'), list)[1].result).toBe('');
    data = scoreNextItem(data, list, 'incorrect')!;
    expect(itemScores(data, list)[0].result).toBe('incorrect');
    expect(applyGoalHotkey('ITEM_MASTERY', 'C', data, list)!.items[2].result).toBe('correct');
    expect(scoreNextItem({ items: list.map(label => ({ label, result: 'correct' })) }, list, 'correct')).toBeNull();
  });

  it(`counts an item as mastered when it is correct ${ITEM_MASTERY_RUN} sessions in a row`, () => {
    const sessions = [
      marks('correct', 'incorrect', 'correct'),
      marks('correct', 'correct', ''),
      marks('correct', 'correct', 'incorrect'),
      marks('', 'correct', 'correct'),
    ];
    const history = itemHistory(sessions, ['want', 'more', 'help']);
    expect(history.map(h => h.mastered)).toEqual([true, true, false]);
    expect(history[0]).toMatchObject({ tries: 3, correct: 3, masteredAt: 2 });
    expect(history[1].masteredAt).toBe(3);
    expect(masteredOverTime(history, sessions.length)).toEqual([0, 0, 1, 2]);
  });

  it('loses mastery after an incorrect try and keeps items only in past sessions', () => {
    const sessions = [
      marks('correct'), marks('correct'), marks('correct'), marks('incorrect'),
      { items: [{ label: 'Bye', result: 'correct' }] },
    ];
    const history = itemHistory(sessions, ['want']);
    expect(history[0].mastered).toBe(false);
    expect(history.map(h => h.label)).toEqual(['want', 'Bye']);
  });

  it('keeps each item\'s latest mark when a session saved in parts is merged', () => {
    const merged = mergeGoalData([marks('incorrect', 'correct', ''), marks('correct', '', '')]);
    expect(merged.items).toEqual([
      { label: 'want', result: 'correct' },
      { label: 'more', result: 'correct' },
      { label: 'help', result: '' },
    ]);
  });

  it('lists mastered items and those that need practice in the narrative', () => {
    const goal = items({ id: 'g2', name: 'Core words' });
    const sessions = [1, 2, 3].map(n => sessionBuilder({
      date: `2026-10-0${n}`,
      goals: [{ goalId: 'g2', goalName: 'Core words', goalType: 'ITEM_MASTERY', data: marks('correct', 'incorrect', 'correct') }],
    }));
    const text = buildNarrative({ student: { id: 'st1', name: 'Test Student Ada', goals: [goal], createdAt: '' } as any, goals: [goal], sessions });
    expect(text).toMatch(/has mastered 2 of 3 items/);
    expect(text).toMatch(/"want", "help"/);
    expect(text).toMatch(/most need practice: "more"/);
  });

  it('takes its items from Edit Goal, one per line, and lists the change', () => {
    const parsed = AssignedGoalEditSchema.parse({ name: 'Core words', smartGoal: 'Ada will use core words.', dataCaptureType: 'ITEM_MASTERY', listItems: 'want\n\nmore\n' });
    expect(parsed.listItems).toEqual(['want', 'more']);
    expect(assignedGoalChanges(items(), { listItems: 'want\nmore' }).map(c => c.label)).toEqual(['Items']);
    expect(assignedGoalChanges(mlu(), { sampleUnit: 'morphemes' })).toEqual([{ label: 'Count utterances in', from: 'words', to: 'morphemes' }]);
  });
});
