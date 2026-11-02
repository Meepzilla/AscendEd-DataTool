// Placeholders in goal text: words in square brackets, such as "By [date], [student] will … in [opportunities]
// opportunities", typed into a goal or template and filled in wherever the goal is shown (goalStatement in
// helpers.ts) from the student and the goal's own settings. The stored text keeps the placeholders, so the shown
// text follows the goal (change the target and the wording changes with it), and one template fits every student.
// Brackets that aren't a placeholder, or one whose value isn't set (a goal without a target date), stay as typed.

export type PlaceholderKey =
  | 'student' | 'fullName' | 'date' | 'target' | 'opportunities' | 'mastery' | 'baseline' | 'baselineDate'
  | 'annualReview' | 'iepDate' | 'reevaluation' | 'serviceMinutes';

export interface Placeholder {
  key: PlaceholderKey;
  /** What is typed (and inserted by the chips). */
  token: string;
  label: string;
  /** What it becomes, for the editor's list. */
  description: string;
  /** Other spellings that work too, lower case, without the brackets. */
  aliases: string[];
}

export const PLACEHOLDERS: Placeholder[] = [
  { key: 'student', token: '[student]', label: 'Student', description: 'The student\'s first name ("the student" in a template)', aliases: ['student', 'name', 'first name', 'student name'] },
  { key: 'fullName', token: '[full name]', label: 'Full name', description: 'The student\'s full name', aliases: ['full name', 'student full name'] },
  { key: 'date', token: '[date]', label: 'Target date', description: 'The goal\'s target date, or the annual review date', aliases: ['date', 'target date', 'goal date'] },
  { key: 'target', token: '[target]', label: 'Target', description: 'The goal\'s target, such as 80% or 3', aliases: ['target', 'accuracy', 'percent', 'criterion'] },
  { key: 'opportunities', token: '[opportunities]', label: 'Opportunities', description: 'The target as opportunities, such as "4 out of 5"', aliases: ['opportunities', 'trials', 'out of'] },
  { key: 'mastery', token: '[sessions]', label: 'Sessions in a row', description: 'Mastery: sessions in a row the target must be met (3 unless set)', aliases: ['sessions', 'mastery', 'consecutive sessions'] },
  { key: 'baseline', token: '[baseline]', label: 'Baseline', description: 'Where the student started, such as 40%', aliases: ['baseline'] },
  { key: 'baselineDate', token: '[baseline date]', label: 'Baseline date', description: 'When the baseline was taken', aliases: ['baseline date'] },
  { key: 'annualReview', token: '[annual review]', label: 'Annual review', description: 'The IEP\'s annual review date', aliases: ['annual review', 'annual review date', 'iep end date', 'iep end'] },
  { key: 'iepDate', token: '[IEP date]', label: 'IEP date', description: 'The date of the current IEP', aliases: ['iep date', 'iep start date', 'iep start'] },
  { key: 'reevaluation', token: '[re-evaluation]', label: 'Re-evaluation', description: 'The re-evaluation due date', aliases: ['re-evaluation', 'reevaluation', 're-evaluation date', 'triennial'] },
  { key: 'serviceMinutes', token: '[service minutes]', label: 'Service minutes', description: 'Required minutes, such as "120 minutes per month"', aliases: ['service minutes', 'minutes', 'service time'] },
];

const BY_ALIAS = new Map(PLACEHOLDERS.flatMap(p => p.aliases.map(a => [a, p.key] as const)));

/** A bracketed word or phrase: "[date]", "[ Target Date ]", "[IEP_date]". */
export const PLACEHOLDER_PATTERN = /\[\s*([A-Za-z][A-Za-z' _/-]{0,30}?)\s*\]/g;

/** Which placeholder a bracketed name is, if any (case, spaces, hyphens and underscores don't matter). */
export function placeholderKey(name: string): PlaceholderKey | undefined {
  const normal = name.toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return BY_ALIAS.get(normal) ?? BY_ALIAS.get(normal.replace(/-/g, ''));
}

/** The text with each known placeholder replaced by its value; unknown or unset ones stay as typed. */
export function replacePlaceholders(text: string, valueOf: (key: PlaceholderKey) => string | undefined): string {
  return text.replace(PLACEHOLDER_PATTERN, (whole, name: string) => {
    const key = placeholderKey(name);
    const value = key ? valueOf(key) : undefined;
    return value === undefined || value === '' ? whole : value;
  });
}
