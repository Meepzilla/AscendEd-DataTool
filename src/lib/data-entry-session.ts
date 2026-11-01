import type { Goal, SessionData, SessionGoalData, Student, StudentSessionState } from './types';
import { GOAL_TYPE_FIELDS, captureTypeOf, finalizeBehaviorData } from './goal-constants';

// Data Entry's per-student state (what is entered on each student's card before it is saved), as plain
// functions: blank data for a goal, keeping the state in step with the students' goals, and the session saved.

/** A goal's starting data for its data entry type (a fresh copy). */
export function freshGoalData(goal: Goal): Record<string, any> {
  return JSON.parse(JSON.stringify(GOAL_TYPE_FIELDS[captureTypeOf(goal)] || {}));
}

/** A student's card with nothing entered. */
export function freshStudentState(student: Student): StudentSessionState {
  return {
    studentId: student.id,
    studentName: student.name,
    activity: '',
    notes: '',
    originalGoalHeaders: student.goals,
    goalData: Object.fromEntries(student.goals.map(goal => [goal.id, freshGoalData(goal)])),
  };
}

// Rebuilt when goals are added or removed, and when a goal is edited mid-session (its name, type, data capture
// type, target or archived state), so the cards and the save use the current goal.
// The order doesn't count: goals moved up or down on a card keep their place.
const goalSignature = (goals: Goal[]) =>
  JSON.stringify(goals.map(g => [g.id, g.name, g.type, g.dataCaptureType, g.isArchived, g.sessionTargetValue, g.targetDirection])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))));

/**
 * The cards' states kept in step with the students: a new student gets a state (from the unsaved draft if it has
 * one), a student whose goals changed keeps what was entered for goals that still fit, and students no longer
 * on the device are dropped. Returns `prev` itself when nothing changed.
 */
export function syncSessionStates(
  prev: Record<string, StudentSessionState>,
  students: Student[],
  drafted: Record<string, Pick<StudentSessionState, 'activity' | 'notes' | 'goalData'>> | undefined,
): Record<string, StudentSessionState> {
  const next: Record<string, StudentSessionState> = {};
  let changed = false;
  for (const student of students) {
    const existing = prev[student.id];
    let goals = student.goals || [];
    if (existing && goalSignature(existing.originalGoalHeaders) === goalSignature(goals)) {
      // The same goals, but one may have been edited in a way that keeps its data (its text, blanks, target
      // date, baseline, mastery): the card shows the current goal, in the card's own order.
      const current = new Map(goals.map(g => [g.id, g]));
      const refreshed = existing.originalGoalHeaders.map(g => current.get(g.id) ?? g);
      if (refreshed.some((g, i) => g !== existing.originalGoalHeaders[i])) {
        next[student.id] = { ...existing, originalGoalHeaders: refreshed };
        changed = true;
      } else {
        next[student.id] = existing;
      }
      continue;
    }
    changed = true;
    // Goals keep the order they have on the card (moved up or down there); new goals go at the end.
    if (existing) {
      const position = new Map(existing.originalGoalHeaders.map((g, i) => [g.id, i]));
      goals = [...goals].sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity));
    }
    // A student's first state comes from the unsaved draft, if it has one.
    const draft = existing ? undefined : drafted?.[student.id];
    const goalData = { ...(existing?.goalData || draft?.goalData || {}) };
    const previousGoals = new Map((existing?.originalGoalHeaders || []).map(g => [g.id, g]));
    for (const goal of goals) {
      const previous = previousGoals.get(goal.id);
      // Data entered with another type's inputs doesn't fit the new ones, so that goal starts over.
      const typeChanged = previous && captureTypeOf(previous) !== captureTypeOf(goal);
      if (!goalData[goal.id] || typeChanged) goalData[goal.id] = freshGoalData(goal);
    }
    next[student.id] = {
      studentId: student.id,
      studentName: student.name,
      activity: existing?.activity || draft?.activity || '',
      notes: existing?.notes || draft?.notes || '',
      originalGoalHeaders: goals,
      goalData,
    };
  }
  return changed || Object.keys(prev).length !== students.length ? next : prev;
}

/** The session saved from a student's card: its active goals' data, with running behavior timers stopped. */
export function sessionFromState(
  state: StudentSessionState,
  when: { date: Date; time: string; endTime: string },
): Omit<SessionData, 'sessionId'> {
  const goals: SessionGoalData[] = state.originalGoalHeaders
    .filter(goal => !goal.isArchived)
    .map(goal => ({
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      data: finalizeBehaviorData(captureTypeOf(goal), state.goalData[goal.id] || freshGoalData(goal)),
    }));
  return {
    studentId: state.studentId,
    studentName: state.studentName,
    date: when.date.toISOString(),
    time: when.time,
    endTime: when.endTime,
    activity: state.activity,
    notes: state.notes,
    goals,
    originalGoalHeaders: state.originalGoalHeaders,
  };
}

/** The goal order with one goal moved up or down, or null when it can't move. */
export function moveGoal(goals: Goal[], goalId: string, direction: 'up' | 'down'): Goal[] | null {
  const index = goals.findIndex(g => g.id === goalId);
  if (index === -1) return null;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= goals.length) return null;
  const next = [...goals];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}
