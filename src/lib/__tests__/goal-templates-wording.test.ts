import { describe, expect, it } from 'vitest';
import { prepareLoadedData } from '../data-migrations';
import { DEFAULT_GOAL_TEMPLATES, textHash } from '../goal-constants';
import { matchTextToTarget } from '../goal-blanks';
import { goalFromTemplate } from '../goal-templates';
import type { GoalTemplate, Student } from '../types';

const stored = (t: Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>, overrides: Partial<GoalTemplate> = {}): GoalTemplate =>
  ({ ...t, id: `id-${t.name}`, createdAt: new Date('2026-01-01'), userId: 'u', defaultKey: t.name, ...overrides }) as GoalTemplate;
const fresh = () => prepareLoadedData([], [], 'u').templates;

describe('built-in template wording', () => {
  it('gives every built-in template a goal statement in one form', () => {
    for (const t of DEFAULT_GOAL_TEMPLATES) {
      // Partner goals are about the communication partner, measured with a fidelity checklist.
      expect(t.generatedSmartGoal, t.name).toMatch(/^By \[date\], .*\b(the student|communication partners?)\b.*\bmeasured (by|with) .+\.$/);
      expect(t.generatedSmartGoal, t.name).not.toMatch(/\bSTUDENT\b|HIS\/HER|HE\/SHE|\[[xX]\]|\bi\.g\.|"|\s[,.]\s|\s{2}/);
    }
  });

  it('hashes text the same way as the importer', () => {
    // From fnv1a in scripts/import-goal-bank.py.
    expect(textHash('By [date], STUDENT will say “hi” — ŋ 😀')).toBe('1d54ab95');
  });

  it('states ratings and functions so they follow the target', () => {
    const rating = DEFAULT_GOAL_TEMPLATES.find(t => t.name === 'Cognitive: Recall 3-step directions')!;
    expect(rating.generatedSmartGoal).toContain('with a rating of at least 4 out of 5');
    expect(matchTextToTarget(rating.generatedSmartGoal, { ...rating, sessionTargetValue: 3 })).toContain('at least 3 out of 5');
    expect(matchTextToTarget('use at least 4 different communicative functions', { type: 'COMMUNICATION_FUNCTIONS', sessionTargetValue: 3 }))
      .toBe('use at least 3 different communicative functions');
  });
});

describe('updating stored templates to the current wording', () => {
  const current = DEFAULT_GOAL_TEMPLATES.find(t => t.bankId === 'bank-0432')!;
  const oldName = 'Identify if HIS/HER speech is “bumpy” or “smooth”';
  const oldText = 'By [date], given a 2 minute tape-recording of HIS/HER reading or conversational speech with “bumpy” or “smooth” speech, STUDENT will identify if HIS/HER speech is “bumpy” or “smooth” with 80% accuracy in 4 out of 5 opportunities, as measured by SLP or teacher observation and data collection.';

  it('renames and rewords a goal bank template still in its earlier wording, without adding it twice', () => {
    expect(current.name).toBe('Identify if their speech is “bumpy” or “smooth”');
    const old = stored(current, { name: oldName, defaultKey: oldName, generatedSmartGoal: oldText });
    const templates = [...fresh().filter(t => t.bankId !== 'bank-0432'), old];
    const prepared = prepareLoadedData([], templates, 'u');
    const matches = prepared.templates.filter(t => t.bankId === 'bank-0432');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ id: old.id, name: current.name, defaultKey: current.name, generatedSmartGoal: current.generatedSmartGoal });
    expect(prepared.templatesChanged).toBe(true);
  });

  it('keeps goal text the user edited, and a name the user changed', () => {
    const edited = stored(current, { name: 'My name', defaultKey: oldName, generatedSmartGoal: `${oldText} Edited.` });
    const prepared = prepareLoadedData([], [...fresh().filter(t => t.bankId !== 'bank-0432'), edited], 'u');
    expect(prepared.templates.find(t => t.id === edited.id)).toMatchObject({ name: 'My name', defaultKey: current.name, generatedSmartGoal: `${oldText} Edited.` });
  });

  it('fills in the goal statement of an original built-in template stored without one', () => {
    const plural = DEFAULT_GOAL_TEMPLATES.find(t => t.name === 'Use regular plural -s')!;
    const prepared = prepareLoadedData([], [...fresh().filter(t => t.name !== plural.name), stored(plural, { generatedSmartGoal: '' })], 'u');
    expect(prepared.templates.find(t => t.name === plural.name)!.generatedSmartGoal)
      .toBe('By [date], the student will use regular plural -s in phrases or sentences with 85% accuracy across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.');
  });

  it('gives goals assigned with a placeholder statement their template\'s statement, and leaves other goals alone', () => {
    const templates = fresh();
    const plural = templates.find(t => t.name === 'Use regular plural -s')!;
    const placeholder = { ...goalFromTemplate({ ...plural, generatedSmartGoal: '' }), id: 'g1' };
    expect(placeholder.smartGoal).toBe('SMART goal for Use regular plural -s');
    const own = { ...placeholder, id: 'g2', smartGoal: 'My own goal text for plurals.' };
    const ava = { id: 's', name: 'Ava', userId: 'u', createdAt: '2026-01-01', goals: [placeholder, own] } as Student;
    const prepared = prepareLoadedData([ava], templates, 'u');
    const goals = prepared.linkedStudents![0].goals;
    expect(goals[0].smartGoal).toBe(plural.generatedSmartGoal);
    expect(goals[1].smartGoal).toBe('My own goal text for plurals.');
    // Nothing left to change on the next load.
    expect(prepareLoadedData(prepared.linkedStudents!, prepared.templates, 'u').linkedStudents).toBeNull();
  });
});

describe('task analysis templates', () => {
  it('update a stored copy still in the earlier wording, description included', () => {
    const current = DEFAULT_GOAL_TEMPLATES.find(t => t.name === 'Complete the handwashing routine (task analysis)')!;
    const earlier = 'By [date], STUDENT will independently complete the steps of the handwashing routine in 80% of steps across 3 consecutive sessions, as measured by staff observation and data collection.';
    const old = stored(current, { smartGoalPrompt: earlier, generatedSmartGoal: earlier });
    const prepared = prepareLoadedData([], [...fresh().filter(t => t.name !== current.name), old], 'u');
    expect(prepared.templates.find(t => t.id === old.id)).toMatchObject({ smartGoalPrompt: current.smartGoalPrompt, generatedSmartGoal: current.generatedSmartGoal });
    expect(current.generatedSmartGoal).toContain('By [date], the student will');
  });
});

describe('built-in names in sentence case', () => {
  it('renames a stored template and an assigned goal without adding the template again', () => {
    const current = DEFAULT_GOAL_TEMPLATES.find(t => t.name === 'Reduce fronting of /k/ and /g/')!;
    const old = stored(current, { name: 'Reduce Fronting of /k, g/', defaultKey: 'Reduce Fronting of /k, g/' });
    const ava = { id: 's', name: 'Ava', userId: 'u', createdAt: '2026-01-01', goals: [{ id: 'g', name: 'Reduce Fronting of /k, g/', type: 'PHONOLOGICAL_PROCESSES', smartGoal: 'My text.' }] } as Student;
    const prepared = prepareLoadedData([ava], [...fresh().filter(t => t.name !== current.name), old], 'u');
    expect(prepared.templates.filter(t => t.name === current.name)).toHaveLength(1);
    expect(prepared.templates.some(t => t.name === 'Reduce Fronting of /k, g/')).toBe(false);
    expect(prepared.students[0].goals[0]).toMatchObject({ name: current.name, smartGoal: 'My text.' });
  });
});
