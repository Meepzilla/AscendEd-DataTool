// The student last chosen on Reports (and the Progress Report), remembered on this device so the page opens on
// the same student after switching to another page, closing the app or reloading. Only the student's id is
// kept (a random id, not a name). A remembered student who has since been archived or deleted is ignored.

const KEY = 'ascended_report_student';

export function rememberReportStudent(studentId: string): void {
  try {
    window.localStorage.setItem(KEY, studentId);
  } catch {
    // Not remembered; the page still works for this visit.
  }
}

/** The remembered student if they are still in `activeStudentIds`, else the first of them (undefined when there are none). */
export function defaultReportStudent(activeStudentIds: string[]): string | undefined {
  let remembered: string | null = null;
  try {
    remembered = window.localStorage.getItem(KEY);
  } catch {
    remembered = null;
  }
  return remembered && activeStudentIds.includes(remembered) ? remembered : activeStudentIds[0];
}
