import { describe, expect, it } from 'vitest';
import { freshGoalData, freshStudentState, moveGoal, sessionFromState, syncSessionStates } from '../data-entry-session';
import { goal } from './helpers';
import type { Student } from '../types';

const artic = goal({ id: 'g1', type: 'ARTICULATION' });
const freq = goal({ id: 'g2', type: 'BEHAVIOR_FREQUENCY', name: 'Calling out' });
const ava = (goals = [artic, freq]) => ({ id: 'ava', name: 'Ava', goals }) as unknown as Student;

describe('Data Entry student state', () => {
  it('starts each goal from its type\'s blank data, as a fresh copy', () => {
    const a = freshGoalData(artic);
    a.correct = 9;
    expect(freshGoalData(artic).correct).toBe(0);
    expect(freshStudentState(ava()).goalData.g2).toMatchObject({ count: 0 });
  });

  it('keeps what was entered when nothing about the goals changed (same object)', () => {
    const prev = syncSessionStates({}, [ava()], undefined);
    expect(syncSessionStates(prev, [ava()], undefined)).toBe(prev);
  });

  it('starts from the unsaved draft the first time', () => {
    const states = syncSessionStates({}, [ava()], { ava: { activity: 'cards', notes: '', goalData: { g1: { correct: 3 } } } });
    expect(states.ava.activity).toBe('cards');
    expect(states.ava.goalData.g1).toEqual({ correct: 3 });
    expect(states.ava.goalData.g2).toMatchObject({ count: 0 });
  });

  it('keeps entries when a goal is added, and starts a goal over when its type changes', () => {
    const prev = syncSessionStates({}, [ava([artic])], undefined);
    prev.ava.goalData.g1 = { correct: 4 };
    const added = syncSessionStates(prev, [ava([artic, freq])], undefined);
    expect(added.ava.goalData.g1).toEqual({ correct: 4 });
    const retyped = syncSessionStates(added, [ava([{ ...artic, type: 'AAC' }, freq])], undefined);
    expect(retyped.ava.goalData.g1).toMatchObject({ correct: 0, approximate: 0 });
  });

  it('drops students no longer on the device', () => {
    const prev = syncSessionStates({}, [ava(), { ...ava(), id: 'ben', name: 'Ben' }], undefined);
    expect(Object.keys(syncSessionStates(prev, [ava()], undefined))).toEqual(['ava']);
  });

  it('saves active goals only, with running timers stopped', () => {
    const state = freshStudentState(ava([artic, { ...freq, isArchived: true }, goal({ id: 'g3', type: 'BEHAVIOR_DURATION' })]));
    state.goalData.g3 = { ...state.goalData.g3, runningSince: Date.now() - 5000 };
    const session = sessionFromState(state, { date: new Date('2026-10-05T09:00:00Z'), time: '09:00', endTime: '09:30' });
    expect(session.goals.map(g => g.goalId)).toEqual(['g1', 'g3']);
    expect(session.goals[1].data.runningSince).toBeNull();
    expect(session.goals[1].data.episodeSeconds).toHaveLength(1);
    expect(session).toMatchObject({ studentId: 'ava', date: '2026-10-05T09:00:00.000Z', time: '09:00', endTime: '09:30' });
  });

  it('moves goals up and down within the list', () => {
    const g = [artic, freq, goal({ id: 'g3' })];
    expect(moveGoal(g, 'g2', 'up')!.map(x => x.id)).toEqual(['g2', 'g1', 'g3']);
    expect(moveGoal(g, 'g1', 'up')).toBeNull();
    expect(moveGoal(g, 'g3', 'down')).toBeNull();
    expect(g.map(x => x.id)).toEqual(['g1', 'g2', 'g3']);
  });
});

describe('Data Entry cards follow goal edits', () => {
  it('shows an edited goal (text, blanks, date) and keeps what was entered and the card\'s goal order', () => {
    const second = goal({ id: 'g2', type: 'ARTICULATION', name: 'Second' });
    const prev = syncSessionStates({}, [ava([artic, second])], undefined);
    prev.ava.goalData.g1 = { correct: 3 };
    prev.ava.originalGoalHeaders = [second, artic]; // moved on the card
    const edited = { ...artic, smartGoal: 'Using ___ in ___ out of ___ trials.', blankFills: ['a talker'], targetDate: '2027-01-15' };
    const next = syncSessionStates(prev, [ava([edited, second])], undefined);
    expect(next.ava.originalGoalHeaders.map(g => g.id)).toEqual(['g2', 'g1']);
    expect(next.ava.originalGoalHeaders[1]).toBe(edited);
    expect(next.ava.goalData.g1).toEqual({ correct: 3 });
  });
});

it('keeps the card\'s goal order when a goal is renamed, and adds new goals at the end', () => {
  const second = goal({ id: 'g2', type: 'ARTICULATION', name: 'Second' });
  const prev = syncSessionStates({}, [ava([artic, second])], undefined);
  prev.ava.originalGoalHeaders = [second, artic];
  const next = syncSessionStates(prev, [ava([{ ...artic, name: 'Renamed' }, second, goal({ id: 'g3' })])], undefined);
  expect(next.ava.originalGoalHeaders.map(g => g.id)).toEqual(['g2', 'g1', 'g3']);
  expect(next.ava.originalGoalHeaders[1].name).toBe('Renamed');
});
