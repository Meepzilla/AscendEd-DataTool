import { describe, expect, it } from 'vitest';
import { ABC_REPLACEMENT_BEHAVIOR, incidentChoices, incidentFunctions, isReplacementIncident, summarizeAbc, type AbcIncident } from '../goal-constants';
import { behaviorEvents } from '../behavior-timing';

const time = '2026-11-01T17:00:00.000Z';
const multi = (antecedents: string[], behaviors: string[], consequences: string[], fns: AbcIncident['fns'] = []): AbcIncident => ({
  time, antecedent: antecedents.join(', '), behavior: behaviors.join(', '), consequence: consequences.join(', '),
  antecedents, behaviors, consequences, fn: fns[0] ?? null, fns,
});

describe('ABC incidents with several choices', () => {
  it('counts each choice, one incident each, and each function once per incident', () => {
    const summary = summarizeAbc({ incidents: [
      multi(['Transition', 'Peer interaction'], ['Aggression', 'Verbal outburst'], ['Adult attention', 'Peer attention', 'Break given'], ['Attention', 'Escape']),
      multi(['Transition'], ['Aggression'], ['Break given'], ['Escape']),
      multi(['Transition'], [ABC_REPLACEMENT_BEHAVIOR], []),
    ] });
    expect(summary).toMatchObject({ incidentCount: 3, problemCount: 2, replacementCount: 1 });
    expect(summary.antecedents).toEqual([['Transition', 2], ['Peer interaction', 1]]);
    expect(summary.behaviors).toEqual([['Aggression', 2], ['Verbal outburst', 1]]);
    expect(summary.functions).toEqual([['Escape', 2], ['Attention', 1]]);
  });

  it('reads incidents recorded with one of each', () => {
    const old = { time, antecedent: 'Transition', behavior: 'Elopement', consequence: 'Adult attention' } as AbcIncident;
    expect(incidentChoices(old)).toEqual({ antecedents: ['Transition'], behaviors: ['Elopement'], consequences: ['Adult attention'] });
    expect(incidentFunctions(old)).toEqual(['Attention']);
    expect(incidentFunctions({ ...old, fn: null })).toEqual([]);
    expect(incidentChoices({ ...old, antecedent: '' }).antecedents).toEqual([]);
    expect(isReplacementIncident({ ...old, behavior: ABC_REPLACEMENT_BEHAVIOR })).toBe(true);
  });

  it('leaves replacement-skill incidents out of when problem behavior happens', () => {
    const events = behaviorEvents('BEHAVIOR_ABC', { incidents: [multi(['Transition'], ['Aggression', 'Elopement'], ['Redirected']), multi([], [ABC_REPLACEMENT_BEHAVIOR], [])] }, new Date(time));
    expect(events).toHaveLength(1);
    expect(events[0].detail).toBe('Transition → Aggression, Elopement → Redirected');
  });
});
