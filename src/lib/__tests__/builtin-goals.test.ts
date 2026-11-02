import { describe, it, expect } from 'vitest';
import { visibleTemplates, deletedBuiltInTemplates, restoreBuiltInTemplates } from '../builtin-goals';
import { prepareLoadedData } from '../data-migrations';
import { DEFAULT_GOAL_TEMPLATES, defaultTemplateKey } from '../goal-constants';
import type { GoalTemplate } from '../types';

const builtIn = (id: string, name: string, extra: Partial<GoalTemplate> = {}): GoalTemplate => ({
  id, name, type: 'ARTICULATION', smartGoalPrompt: 'p', generatedSmartGoal: 'g', createdAt: new Date(0),
  isDefault: true, userId: 'u', defaultKey: name, ...extra,
});
const custom = (id: string, name: string): GoalTemplate => ({
  id, name, type: 'ARTICULATION', smartGoalPrompt: 'p', generatedSmartGoal: 'g', createdAt: new Date(0), isDefault: false, userId: 'u',
});

describe('built-in goals the user deleted', () => {
  const list = [
    builtIn('a', 'Alpha goal'),
    builtIn('b', 'Beta goal', { deleted: true, isArchived: true }),
    custom('c', 'My goal'),
  ];

  it('are left out of the visible library', () => {
    expect(visibleTemplates(list).map(t => t.id)).toEqual(['a', 'c']);
  });

  it('are listed for restoring, by name', () => {
    expect(deletedBuiltInTemplates(list).map(t => t.id)).toEqual(['b']);
  });

  it('come back as not deleted and not archived when restored', () => {
    const restored = restoreBuiltInTemplates(list, ['b']);
    expect(restored.find(t => t.id === 'b')).toMatchObject({ deleted: false, isArchived: false });
    expect(visibleTemplates(restored).map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('only restore built-in templates', () => {
    const odd = [{ ...custom('x', 'Custom'), deleted: true }];
    expect(restoreBuiltInTemplates(odd, ['x'])[0].deleted).toBe(true);
  });

  it('are not added back when the app loads', () => {
    const name = DEFAULT_GOAL_TEMPLATES[0].name;
    const tombstone = builtIn('gone', name, { deleted: true, isArchived: true });
    const prepared = prepareLoadedData([], [tombstone], 'u');
    const copies = prepared.templates.filter(t => defaultTemplateKey(t) === name);
    expect(copies).toHaveLength(1);
    expect(copies[0].id).toBe('gone');
    expect(copies[0].deleted).toBe(true);
  });

  it('a missing built-in template is still added on load', () => {
    const prepared = prepareLoadedData([], [], 'u');
    expect(prepared.templates.filter(t => t.isDefault).length).toBe(DEFAULT_GOAL_TEMPLATES.length);
  });
});
