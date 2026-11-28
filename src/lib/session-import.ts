import type { Goal, GoalType, SessionData, SessionGoalData, Student } from './types';
import { generateUUID, parseDateOnly } from './helpers';
import { byDateDesc, byName } from './data-store';
import { GOAL_TYPE_FIELDS } from './goal-constants';
import { knownGoalType } from './legacy-goal-types';
import { parseDate } from './student-import';
import { missedReasonFromCsv } from './attendance';
import { parseServiceMinutesByType } from './session-csv';

// Adding sessions imported from a CSV file (Reports → Import) to the ones on this device.

/** A goal row read from a CSV file, optionally carrying its separate Data Capture Type. */
export type ImportedSessionGoal = SessionGoalData & { dataCaptureType?: GoalType };

/** A session read from a CSV file: the Session ID it had in the file, without a new one yet. */
export type ImportedSession = Omit<SessionData, 'sessionId' | 'goals'> & {
  goals: ImportedSessionGoal[];
  sourceSessionId?: string;
};

/**
 * A CSV cell as the value it was exported from: lists and objects were written as JSON, numbers and true/false as
 * text. Fields that are text in the goal type's starting values (a target sound, notes) stay text, so "5" or
 * "[1,2]" typed into them comes back unchanged.
 */
function cellValue(raw: string, goalType: string, key: string): unknown {
  const defaults = GOAL_TYPE_FIELDS[goalType as GoalType] as Record<string, unknown> | undefined;
  if (defaults && typeof defaults[key] === 'string') return raw;
  const text = raw.trim();
  if (text.startsWith('[') || text.startsWith('{')) {
    try { return JSON.parse(text); } catch { return raw; }
  }
  if (text === 'true' || text === 'false') return text === 'true';
  if (text === 'null') return null;
  return text !== '' && !Number.isNaN(Number(text)) ? Number(text) : raw;
}

/**
 * Groups parsed CSV rows (from Papa Parse with `header: true`) into ImportedSession records.
 * Supports both identified exports and de-identified exports (where Student Name and Goal Name are omitted),
 * and reads the optional "Data Capture Type" column so goals with a custom capture tool round-trip cleanly.
 */
export function parseSessionCsvRows(rows: Record<string, any>[]): ImportedSession[] {
  if (rows.length === 0) {
    throw new Error('CSV file is empty or contains no data rows.');
  }

  const sessionsMap = new Map<string, ImportedSession>();

  for (const row of rows) {
    const sessionId = row['Session ID'];
    if (!sessionId) {
      // No row content here: a row is one student's session data, including their name.
      console.warn('Skipping row with missing Session ID.');
      continue;
    }

    let sessionEntry = sessionsMap.get(sessionId);

    // If it's the first time seeing this session ID, create the base session object.
    if (!sessionEntry) {
      if (!row['Date'] || (!row['Student ID'] && !row['Student Name'])) {
        // No session ID in the message: it is shown in the toast below.
        throw new Error('A row is missing required fields (Date, and Student ID or Student Name).');
      }
      // The date is read as the written day (YYYY-MM-DD, M/D/YYYY, "Aug 1, 2026"...) and stored as YYYY-MM-DD; a
      // day that doesn't exist (11/31/2026) or text that isn't a date fails the import, not a broken session.
      const date = parseDate(row['Date']);
      if (!date) throw new Error(`A row has a date that isn't a real date ("${String(row['Date']).slice(0, 30)}"), so the file can't be imported.`);
      sessionEntry = {
        studentId: row['Student ID'] || '',
        studentName: row['Student Name'] || '',
        date,
        time: row['Start Time'] || '',
        endTime: row['End Time'] && row['End Time'] !== 'N/A' ? row['End Time'] : undefined,
        activity: row['Activity'] || '',
        notes: row['Session Notes'] || '',
        goals: [],
        originalGoalHeaders: [], // Not in the file; Edit Session uses the student's goals instead.
        sourceSessionId: sessionId,
      };
      // A missed session comes back missed, with its reason (the export's Attendance column).
      const missedReason = missedReasonFromCsv(row['Attendance']);
      if (missedReason) sessionEntry.missed = { reason: missedReason };
      // The export's by-type minutes come back as the session's split. The column repeats on
      // every goal row of the session; this first row's value is the one used.
      const serviceMinutes = parseServiceMinutesByType(row['Service Minutes by Type']);
      if (serviceMinutes) sessionEntry.serviceMinutes = serviceMinutes;
      sessionsMap.set(sessionId, sessionEntry);
    }

    // Process goal rows for both identified exports (Goal ID + Goal Name) and de-identified exports (Goal ID only).
    const hasGoalRow = Boolean(row['Goal ID'] || (row['Goal Name'] && row['Goal Type']));
    if (hasGoalRow) {
      // A goal type this app doesn't know would make a goal that can't be measured or charted.
      const goalType = knownGoalType(row['Goal Type']);
      if (!goalType) throw new Error(`A row has a goal type this app doesn't know ("${String(row['Goal Type']).slice(0, 40)}"), so the file can't be imported.`);

      const rawCaptureType = row['Data Capture Type'];
      let dataCaptureType: GoalType | undefined;
      if (rawCaptureType) {
        const parsedCaptureType = knownGoalType(rawCaptureType);
        if (!parsedCaptureType) {
          throw new Error(`A row has a data capture type this app doesn't know ("${String(rawCaptureType).slice(0, 40)}"), so the file can't be imported.`);
        }
        if (parsedCaptureType !== goalType) dataCaptureType = parsedCaptureType;
      }
      const effectiveCaptureType = dataCaptureType ?? goalType;

      const goalData: SessionGoalData['data'] = {};
      for (const key in row) {
        if (key.startsWith('Goal Data: ')) {
          const dataKeyRaw = key.replace('Goal Data: ', '');
          // Export spaced the key out before each capital ("Partial Physical", "total Syllables"), keeping
          // the first letter's case, so joining the words back gives the original key.
          const camelCaseKey = dataKeyRaw.replace(/\s+(.)/g, (_match: string, letter: string) => letter.toUpperCase()).trim();
          if (!camelCaseKey || camelCaseKey === '__proto__' || camelCaseKey === 'prototype' || camelCaseKey === 'constructor') continue;

          const rawValue = row[key];
          // Columns from other goal types are empty for this goal.
          if (rawValue === undefined || rawValue === null || rawValue === '') continue;
          goalData[camelCaseKey] = cellValue(String(rawValue), effectiveCaptureType, camelCaseKey);
        }
      }

      const sessionGoal: ImportedSessionGoal = {
        goalId: row['Goal ID'] || '',
        goalName: row['Goal Name'] || '',
        goalType,
        ...(dataCaptureType ? { dataCaptureType } : {}),
        data: goalData,
      };

      // Avoid duplicating goals if they appear in multiple rows for the same session.
      const duplicateGoal = sessionGoal.goalId
        ? sessionEntry.goals.some(g => g.goalId === sessionGoal.goalId)
        : sessionEntry.goals.some(g => g.goalName === sessionGoal.goalName && g.goalType === sessionGoal.goalType);
      if (!duplicateGoal) {
        sessionEntry.goals.push(sessionGoal);
      }
    }
  }

  return Array.from(sessionsMap.values());
}

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
 * (duplicateCount) when that id is on this device, or when a session of the same student, day, start and end
 * time, activity and missed status with the same data is (sessions imported before ids were kept). Importing
 * a file twice adds nothing.
 */
export function planSessionImport(currentStudents: Student[], currentSessions: SessionData[], toImport: ImportedSession[], userId: string): ImportPlan {
  const contentKey = (s: { studentId?: string; date?: string; time?: string; endTime?: string; activity?: string; missed?: { reason: string } | null; notes?: string; goals?: SessionGoalData[] }) => {
    const day = parseDateOnly(s.date ?? ''); // a date-only CSV date is that local day, like the stored session's
    const goals = (s.goals || []).map(g => [g.goalId, g.data]).sort((x, y) => String(x[0]).localeCompare(String(y[0])));
    // End time, activity and missed status are part of what makes a session distinct: two sessions on a day
    // with the same start, notes and goals but different ends, activities, or one held and one missed are not
    // the same session.
    return JSON.stringify([s.studentId, Number.isNaN(day.getTime()) ? s.date : day.toDateString(), s.time ?? '', s.endTime ?? '', s.activity ?? '', s.missed ? s.missed.reason : '', s.notes ?? '', goals]);
  };
  const nameKey = (name?: string) => (name || '').trim().toLowerCase();
  const students = currentStudents.map(st => ({ ...st, goals: [...(st.goals || [])] }));
  const findStudent = (s: ImportedSession) => {
    const key = nameKey(s.studentName);
    return students.find(st => st.id === s.studentId) ?? (key ? students.find(st => nameKey(st.name) === key) : undefined);
  };
  const ids = new Set(currentSessions.map(s => s.sessionId));
  const contents = new Set(currentSessions.map(contentKey));
  const newSessions: SessionData[] = [];
  let duplicateCount = 0;
  let unmatchedCount = 0;
  let addedGoalCount = 0;
  // Goals a session needs that its student doesn't have. They are added only with a session that is imported, so
  // a skipped duplicate never brings back a goal (e.g. one deleted after the first import).
  const pendingGoals = new Map<string, Goal>();
  const pendingKey = (studentId: string, g: ImportedSessionGoal) =>
    `${studentId}\u0000${nameKey(g.goalName) || g.goalId}\u0000${g.goalType}\u0000${g.dataCaptureType ?? g.goalType}`;
  for (const { sourceSessionId, ...s } of toImport) {
    const student = findStudent(s as ImportedSession);
    if (!student) { unmatchedCount++; continue; }
    const needed: Goal[] = [];
    // The goal as the session recorded it, with the row's Data Capture Type: a session saved in Data Entry keeps
    // these (originalGoalHeaders), and the CSV export reads each goal's capture type from them. Without them an
    // imported session exported again lost a capture type that differs from the goal type.
    const headers: Goal[] = [];
    const goals: SessionGoalData[] = (s.goals || []).map(g => {
      const { dataCaptureType, ...goalFields } = g;
      const gNameKey = nameKey(goalFields.goalName);
      let goal = student.goals.find(sg => sg.id === goalFields.goalId)
        ?? (gNameKey ? student.goals.find(sg => nameKey(sg.name) === gNameKey && sg.type === goalFields.goalType) : undefined);
      if (!goal) {
        const key = pendingKey(student.id, g);
        const fallbackName = (goalFields.goalName || '').trim() || goalFields.goalType;
        goal = pendingGoals.get(key) ?? {
          id: goalFields.goalId || generateUUID(),
          name: fallbackName,
          type: goalFields.goalType,
          ...(dataCaptureType && dataCaptureType !== goalFields.goalType ? { dataCaptureType } : {}),
          smartGoal: '',
        };
        pendingGoals.set(key, goal);
        needed.push(goal);
      }
      headers.push(dataCaptureType && dataCaptureType !== goal.dataCaptureType ? { ...goal, dataCaptureType } : { ...goal });
      return { ...goalFields, goalId: goal.id, goalName: goal.name };
    });
    const session = { ...s, studentId: student.id, studentName: student.name, goals, ...(headers.length ? { originalGoalHeaders: headers } : {}) };
    if ((sourceSessionId && ids.has(sourceSessionId)) || contents.has(contentKey(session))) { duplicateCount++; continue; }
    for (const goal of needed) {
      if (student.goals.includes(goal)) continue;
      student.goals.push(goal);
      addedGoalCount++;
    }
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
