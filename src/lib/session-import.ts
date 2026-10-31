import type { SessionData, SessionGoalData, Student } from './types';
import { generateUUID } from './helpers';
import { byDateDesc, byName } from './data-store';

// Adding sessions imported from a CSV file (Reports → Import) to the ones on this device.

/** A session read from a CSV file: the Session ID it had in the file, without a new one yet. */
export type ImportedSession = Omit<SessionData, 'sessionId'> & { sourceSessionId?: string };

export interface ImportPlan {
  /** The students with any goals the import added (sorted); save them when addedGoalCount > 0. */
  students: Student[];
  /** All sessions with the new ones added (newest first); save them when newCount > 0. */
  sessions: SessionData[];
  newCount: number;
  duplicateCount: number;
  unmatchedCount: number;
  addedGoalCount: number;
}

/**
 * Ids differ between devices, so each session's student is found by id, then by name, and its goals by id, then
 * by name and type; a goal the student doesn't have is added to them (otherwise its data would be stored but
 * never shown). Sessions for students not on this device are skipped (unmatchedCount). A session keeps the
 * Session ID it had in the file, so a later backup merge recognizes it. It is skipped as already here
 * (duplicateCount) when that id is on this device, or when a session of the same student, day and start time
 * with the same data is (sessions imported before ids were kept). Importing a file twice adds nothing.
 */
export function planSessionImport(currentStudents: Student[], currentSessions: SessionData[], toImport: ImportedSession[], userId: string): ImportPlan {
  const contentKey = (s: { studentId?: string; date?: string; time?: string; notes?: string; goals?: SessionGoalData[] }) => {
    const day = new Date(s.date ?? '');
    const goals = (s.goals || []).map(g => [g.goalId, g.data]).sort((x, y) => String(x[0]).localeCompare(String(y[0])));
    return JSON.stringify([s.studentId, Number.isNaN(day.getTime()) ? s.date : day.toDateString(), s.time ?? '', s.notes ?? '', goals]);
  };
  const nameKey = (name?: string) => (name || '').trim().toLowerCase();
  const students = currentStudents.map(st => ({ ...st, goals: [...(st.goals || [])] }));
  const findStudent = (s: ImportedSession) =>
    students.find(st => st.id === s.studentId) ?? students.find(st => nameKey(st.name) === nameKey(s.studentName));
  const ids = new Set(currentSessions.map(s => s.sessionId));
  const contents = new Set(currentSessions.map(contentKey));
  const newSessions: SessionData[] = [];
  let duplicateCount = 0;
  let unmatchedCount = 0;
  let addedGoalCount = 0;
  for (const { sourceSessionId, ...s } of toImport) {
    const student = findStudent(s as ImportedSession);
    if (!student) { unmatchedCount++; continue; }
    const goals = (s.goals || []).map(g => {
      let goal = student.goals.find(sg => sg.id === g.goalId)
        ?? student.goals.find(sg => nameKey(sg.name) === nameKey(g.goalName) && sg.type === g.goalType);
      if (!goal) {
        goal = { id: g.goalId || generateUUID(), name: g.goalName, type: g.goalType, smartGoal: '' };
        student.goals.push(goal);
        addedGoalCount++;
      }
      return { ...g, goalId: goal.id, goalName: goal.name };
    });
    const session = { ...s, studentId: student.id, studentName: student.name, goals };
    if ((sourceSessionId && ids.has(sourceSessionId)) || contents.has(contentKey(session))) { duplicateCount++; continue; }
    const sessionId = sourceSessionId && !ids.has(sourceSessionId) ? sourceSessionId : generateUUID();
    ids.add(sessionId);
    contents.add(contentKey(session));
    newSessions.push({ ...session, sessionId, userId });
  }
  return {
    students: students.sort(byName),
    sessions: [...currentSessions, ...newSessions].sort(byDateDesc),
    newCount: newSessions.length, duplicateCount, unmatchedCount, addedGoalCount,
  };
}
