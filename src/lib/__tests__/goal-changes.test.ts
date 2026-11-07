import { describe, expect, it } from 'vitest';
import { assignedGoalChanges, goalTemplateChanges } from '../goal-changes';
import type { Goal, GoalTemplate } from '../types';
import { goal as goalBuilder } from './helpers';

const assigned = (overrides: Partial<Goal> = {}): Goal =>
  goalBuilder({
    name: 'Say hello',
    smartGoal: 'By May, the student will greet a peer.',
    sessionTargetValue: 80,
    targetDate: '2026-05-15',
    baseline: 40,
    baselineDate: '2026-09-01',
    masterySessions: 3,
    dataCaptureType: 'SEQUENCED_TRIALS',
    ...overrides,
  });

const template = (overrides: Partial<GoalTemplate> = {}): GoalTemplate =>
  ({
    id: 't1',
    name: 'Greeting',
    type: 'ARTICULATION',
    dataCaptureType: 'SEQUENCED_TRIALS',
    smartGoalPrompt: 'Student will greet a peer.',
    generatedSmartGoal: 'By [date], the student will greet a peer.',
    sessionTargetValue: 80,
    createdAt: new Date('2026-01-01'),
    isDefault: false,
    ...overrides,
  }) as GoalTemplate;

describe('assignedGoalChanges', () => {
  it('lists nothing when nothing changed', () => {
    const original = assigned();
    expect(assignedGoalChanges(original, {
      name: 'Say hello', smartGoal: 'By May, the student will greet a peer.',
      sessionTargetValue: 80, targetDate: '2026-05-15', baseline: 40, baselineDate: '2026-09-01',
      masterySessions: 3, dataCaptureType: 'SEQUENCED_TRIALS',
    })).toEqual([]);
  });

  it('lists numbers, dates and the capture method old to new', () => {
    const changes = assignedGoalChanges(assigned(), {
      sessionTargetValue: 90, targetDate: '2026-06-01', baseline: '', baselineDate: '',
      dataCaptureType: 'BEHAVIOR_FREQUENCY',
    });
    expect(changes).toEqual([
      { label: 'Data capture method', from: 'Sequenced Trials', to: 'Behavior Frequency' },
      { label: 'Session target', from: '80', to: '90' },
      { label: 'Target date', from: 'May 15, 2026', to: 'Jun 1, 2026' },
      { label: 'Baseline', from: '40', to: 'No target' },
      { label: 'Baseline date', from: 'Sep 1, 2026', to: 'Not set' },
    ]);
  });

  it('lists a changed GAS level description and a blank fill, and ignores untouched levels', () => {
    const original = assigned({ type: 'GOAL_ATTAINMENT_SCALE', gasLevelDescriptions: ['', '', 'Does it sometimes', '', ''], blankFills: ['peers'] });
    const changes = assignedGoalChanges(original, {
      gasLevelDescriptions: ['', '', 'Does it sometimes', '', 'Does it every time'],
      blankFills: ['teachers'],
    });
    expect(changes).toEqual([
      { label: 'Level +2 description', from: '(blank)', to: 'Does it every time' },
      { label: 'Blank 1 fill', from: 'peers', to: 'teachers' },
    ]);
  });

  it('counts task steps and flags a rewording with the same count', () => {
    const original = assigned({ taskSteps: ['Turn on water', 'Wet hands'] });
    expect(assignedGoalChanges(original, { taskSteps: 'Turn on water\nWet hands\nGet soap' })).toEqual([
      { label: 'Task steps', from: '2 steps', to: '3 steps' },
    ]);
    expect(assignedGoalChanges(original, { taskSteps: 'Turn on tap\nWet hands' })).toEqual([
      { label: 'Task steps', from: '2 steps (reworded)', to: '2 steps (reworded)' },
    ]);
  });

  it('lists archive and direction changes', () => {
    const changes = assignedGoalChanges(assigned({ isArchived: false }), { isArchived: true, targetDirection: 'decrease' });
    expect(changes).toEqual([
      { label: 'Goal direction', from: 'Default for this goal type', to: 'Decrease (target is a maximum)' },
      { label: 'Archived', from: 'No', to: 'Yes' },
    ]);
  });
});

describe('goalTemplateChanges', () => {
  it('lists nothing when nothing changed', () => {
    const original = template();
    expect(goalTemplateChanges(original, {
      name: 'Greeting', type: 'ARTICULATION', dataCaptureType: 'SEQUENCED_TRIALS',
      smartGoalPrompt: 'Student will greet a peer.',
      generatedSmartGoal: 'By [date], the student will greet a peer.', sessionTargetValue: 80,
    })).toEqual([]);
  });

  it('lists a renamed template, a new category and a cleared target', () => {
    const changes = goalTemplateChanges(template(), {
      name: 'Greeting a peer', type: 'LANGUAGE', sessionTargetValue: '',
    });
    expect(changes).toEqual([
      { label: 'Template name', from: 'Greeting', to: 'Greeting a peer' },
      { label: 'Clinical goal category', from: 'Articulation', to: 'Language' },
      { label: 'Session target', from: '80', to: 'No target' },
    ]);
  });

  it('lists a changed GAS level description', () => {
    const original = template({ gasLevelDescriptions: ['', '', 'Does it sometimes', '', ''] });
    const changes = goalTemplateChanges(original, {
      gasLevelDescriptions: ['', '', 'Does it sometimes', '', 'Does it every time'],
    });
    expect(changes).toEqual([
      { label: 'Level +2 description', from: '(blank)', to: 'Does it every time' },
    ]);
  });
});
