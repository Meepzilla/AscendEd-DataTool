import Papa from 'papaparse';
import type { SessionData } from './types';
import { formatDate } from './helpers';

// Session export as CSV, one row per goal in each session (one row for a session without goals). Goal data
// fields become "Goal Data: ..." columns; the import (import-data-modal) reads this same layout back.

function sessionRows(sessions: SessionData[]): Record<string, unknown>[] {
  return sessions.flatMap(session => {
    const base = {
      'Session ID': session.sessionId,
      'Student ID': session.studentId,
      'Student Name': session.studentName,
      'Date': formatDate(session.date),
      'Start Time': session.time,
      'End Time': session.endTime || 'N/A',
      'Activity': session.activity,
      'Session Notes': session.notes,
    };
    if (!session.goals || session.goals.length === 0) return [{ ...base, 'Goal Name': 'N/A (No goals recorded)' }];
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

/** Downloads the sessions as a CSV file named for the student. */
export function downloadSessionsCsv(sessions: SessionData[], studentName: string) {
  const rows = sessionRows(sessions);
  // Every column any row has (goal types have different data fields), not just the first row's.
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const csv = Papa.unparse(rows, { columns });
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `sessions_${studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
