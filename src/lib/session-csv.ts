import Papa from 'papaparse';
import type { SessionData } from './types';
import { formatDateOnly } from './helpers';
import { MISSED_REASON_SHORT } from './attendance';
import { sessionMinutes } from './student-overview';

// Session export as CSV, one row per goal in each session (one row for a session without goals). Goal data
// fields become "Goal Data: ..." columns; the import (import-data-modal) reads this same layout back.

// CSV formula injection (CWE-1236): a cell that starts with = + - @, a tab or a carriage return is run as a formula
// by Excel, Numbers and Sheets, so a note such as =HYPERLINK(...) could act when the export is opened. Those cells
// are written with a leading apostrophe, which spreadsheets show as text. A plain number (a GAS level of -1, say)
// isn't a formula and stays as it is.
export const CSV_FORMULA_START = /^(?:[=+@\t\r]|-(?!\d+(?:\.\d+)?$))/;

/** Undoes the export's formula escape when a CSV is imported, so a note exported and imported again is unchanged. */
export function unescapeCsvFormula(value: string): string {
  return value.startsWith("'") && CSV_FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

function sessionRows(sessions: SessionData[]): Record<string, unknown>[] {
  return sessions.flatMap(session => {
    const base = {
      'Session ID': session.sessionId,
      'Student ID': session.studentId,
      'Student Name': session.studentName,
      'Date': formatDateOnly(session.date),
      'Start Time': session.time,
      'End Time': session.endTime || 'N/A',
      'Activity': session.activity,
      'Session Notes': session.notes,
      'Attendance': session.missed ? `Missed: ${MISSED_REASON_SHORT[session.missed.reason]}` : 'Held',
    };
    if (!session.goals || session.goals.length === 0) return [{ ...base, 'Goal Name': session.missed ? 'N/A (Missed session)' : 'N/A (No goals recorded)' }];
    return session.goals.map(goalData => {
      const goalFields: Record<string, unknown> = {};
      Object.entries(goalData.data || {}).forEach(([key, value]) => {
        // Lists and objects (trials, incidents, ...) are stored as JSON.
        goalFields[`Goal Data: ${key.replace(/([A-Z])/g, ' $1').trim()}`] = value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
      });
      return { ...base, 'Goal ID': goalData.goalId, 'Goal Name': goalData.goalName, 'Goal Type': goalData.goalType, ...goalFields };
    });
  });
}

export interface SessionCsvOptions {
  /** IDs only: no student names, no notes, no free-text fields, and no student name in the file name. */
  deidentified?: boolean;
}

// Only numbers, booleans, and arrays of those survive a de-identified export: every string or object
// in goal data is free text (or could hold it), so it is dropped rather than guessed at.
function deidentifiedGoalValue(value: unknown): unknown {
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value) && value.every(v => v === null || typeof v === 'number' || typeof v === 'boolean')) {
    return JSON.stringify(value);
  }
  return undefined;
}

/** One row per goal in each session, with IDs only: no names, notes, activity, or free-text goal data. */
export function deidentifiedSessionRows(sessions: SessionData[]): Record<string, unknown>[] {
  return sessions.flatMap(session => {
    const base = {
      'Session ID': session.sessionId,
      'Student ID': session.studentId,
      'Date': formatDateOnly(session.date),
      'Start Time': session.time,
      'End Time': session.endTime || 'N/A',
      'Minutes': sessionMinutes(session),
      'Attendance': session.missed ? `Missed: ${MISSED_REASON_SHORT[session.missed.reason]}` : 'Held',
    };
    if (!session.goals || session.goals.length === 0) return [{ ...base, 'Goal ID': '' }];
    return session.goals.map(goalData => {
      const goalFields: Record<string, unknown> = {};
      Object.entries(goalData.data || {}).forEach(([key, value]) => {
        const kept = deidentifiedGoalValue(value);
        if (kept !== undefined) goalFields[`Goal Data: ${key.replace(/([A-Z])/g, ' $1').trim()}`] = kept;
      });
      return { ...base, 'Goal ID': goalData.goalId, 'Goal Type': goalData.goalType, ...goalFields };
    });
  });
}

function localDateStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The CSV file name. De-identified exports never contain a student name. */
export function sessionsCsvFileName(studentName: string, options: SessionCsvOptions = {}, date = new Date()): string {
  if (options.deidentified) return `sessions_deidentified_${localDateStamp(date)}.csv`;
  // Identified name kept as-is (UTC date stamp); only the de-identified name is new.
  return `sessions_${studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${date.toISOString().split('T')[0]}.csv`;
}

/** The CSV text and file name for a session export, without touching the DOM (so it is unit-testable). */
export function buildSessionsCsv(
  sessions: SessionData[],
  studentName: string,
  options: SessionCsvOptions = {},
  date = new Date(),
): { csv: string; fileName: string } {
  const rows = options.deidentified ? deidentifiedSessionRows(sessions) : sessionRows(sessions);
  // Every column any row has (goal types have different data fields), not just the first row's.
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return { csv: Papa.unparse(rows, { columns, escapeFormulae: CSV_FORMULA_START }), fileName: sessionsCsvFileName(studentName, options, date) };
}

/** Downloads the sessions as a CSV file named for the student (or de-identified, with no name in it). */
export function downloadSessionsCsv(sessions: SessionData[], studentName: string, options: SessionCsvOptions = {}) {
  const { csv, fileName } = buildSessionsCsv(sessions, studentName, options);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
