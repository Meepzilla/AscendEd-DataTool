import { describe, expect, it } from 'vitest';
import { freshStudentState, restoreAfterFailedSave } from '../data-entry-session';
import type { Student, StudentSessionState } from '../types';

const student = {
  id: 'st-1', name: 'Test Student Ada', createdAt: '2026-09-01',
  goals: [
    { id: 'g1', name: 'Says s sound', type: 'ARTICULATION', smartGoal: '' },
    { id: 'g2', name: 'Requests items', type: 'COMMUNICATION_COUNT', smartGoal: '' },
  ],
} as unknown as Student;

/** A card with entries: g1 scored and an activity. */
function entered(): StudentSessionState {
  const s = freshStudentState(student);
  return { ...s, activity: 'Cards', goalData: { ...s.goalData, g1: { ...s.goalData.g1, correct: 5, recorded: true } } };
}

describe('restoreAfterFailedSave', () => {
  it('puts everything back when nothing was entered during the save', () => {
    const snapshot = entered();
    const cleared = freshStudentState(student);
    expect(restoreAfterFailedSave(cleared, cleared, snapshot)).toEqual({ state: snapshot, lost: [] });
  });

  it('puts back untouched goals and fields, and keeps what was entered during the save', () => {
    const snapshot = entered();
    const cleared = freshStudentState(student);
    // During the save: a tap on the other goal, and notes typed.
    const current = { ...cleared, notes: 'new note', goalData: { ...cleared.goalData, g2: { ...cleared.goalData.g2, count: 1, recorded: true } } };
    const { state, lost } = restoreAfterFailedSave(current, cleared, snapshot);
    expect(state.goalData.g1).toBe(snapshot.goalData.g1);
    expect(state.goalData.g2).toBe(current.goalData.g2);
    expect(state.activity).toBe('Cards');
    expect(state.notes).toBe('new note');
    expect(lost).toEqual([]);
  });

  it('says which entries could not be put back because the same goal was scored again during the save', () => {
    const snapshot = entered();
    const cleared = freshStudentState(student);
    const current = { ...cleared, goalData: { ...cleared.goalData, g1: { ...cleared.goalData.g1, correct: 1, recorded: true } } };
    const { state, lost } = restoreAfterFailedSave(current, cleared, snapshot);
    expect(state.goalData.g1).toBe(current.goalData.g1);
    expect(lost).toEqual(['g1']);
  });

  it('restores the snapshot when the card is gone, and skips goals removed meanwhile', () => {
    const snapshot = entered();
    const cleared = freshStudentState(student);
    expect(restoreAfterFailedSave(undefined, cleared, snapshot).state).toBe(snapshot);
    const { g1: _, ...rest } = cleared.goalData;
    const current = { ...cleared, goalData: rest };
    expect(restoreAfterFailedSave(current, cleared, snapshot).state.goalData).toEqual(rest);
  });
});
