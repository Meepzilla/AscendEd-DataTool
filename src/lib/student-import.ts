import type { Goal, GoalType, ServicePer, Student, StudentIep, TargetDirection } from './types';
import type { CellValue } from './xlsx-read';
import { generateUUID } from './helpers';
import { COMMUNICATION_FUNCTIONS } from './goal-constants';

// Importing students from a spreadsheet (an "IEP at a glance" with one row per student): the student's name,
// IEP dates, required service minutes and goals. Each goal is given the goal type that fits what it measures
// (worked out from its wording, and shown for review before anything is saved), a target, and a target date.

export interface ImportGoal {
  name: string;
  /** The goal as written in the spreadsheet. */
  smartGoal: string;
  type: GoalType;
  target: number;
  direction?: TargetDirection;
  /** YYYY-MM-DD: the month in "by Oct 2026" (its last day), else the IEP end date. */
  targetDate?: string;
  /** The student already has this goal (the same or nearly the same wording), so it isn't added unless chosen. */
  duplicate?: boolean;
}

export interface ImportStudent {
  /** Spreadsheet row number (1-based), for messages. */
  row: number;
  name: string;
  /** The existing student this row updates (same name), if any. */
  existingId?: string;
  /** That student's name, when it isn't written the same way (the file has "Jeremy Taylor", the app "Jeremy"). */
  existingName?: string;
  iep: StudentIep;
  goals: ImportGoal[];
}

export interface ImportPreview {
  students: ImportStudent[];
  /** Rows that were skipped, and why. */
  warnings: string[];
}

// --- Columns ---

type Column = 'name' | 'iepDate' | 'annualReviewDate' | 'reevaluationDate' | 'service' | 'goals';
const COLUMN_PATTERNS: [Column, RegExp][] = [
  ['reevaluationDate', /re-?eval|triennial|3[- ]?year/i],
  ['annualReviewDate', /\bend\b|annual|review|expir|due/i],
  ['iepDate', /start|begin|iep date|meeting date|initiat/i],
  ['service', /service|minutes/i],
  ['goals', /goal|objective/i],
  ['name', /student|name/i],
];

/** Which column holds what, from the header row. Goals can be spread over several columns. */
function findColumns(header: CellValue[]): Map<Column, number[]> {
  const columns = new Map<Column, number[]>();
  header.forEach((cell, index) => {
    const text = String(cell ?? '').trim();
    if (!text) return;
    const match = COLUMN_PATTERNS.find(([, pattern]) => pattern.test(text));
    if (!match) return;
    const [column] = match;
    if (column !== 'goals' && columns.has(column)) return;
    columns.set(column, [...(columns.get(column) ?? []), index]);
  });
  return columns;
}

// --- Values ---

const pad = (n: number) => String(n).padStart(2, '0');

/** A date cell as YYYY-MM-DD: already that form (from an .xlsx), M/D/YYYY or M/D/YY, or a written date. */
export function parseDate(value: CellValue): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const text = String(value).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31 ? `${year}-${pad(+m[1])}-${pad(+m[2])}` : undefined;
  }
  // "Oct 29, 2025", "October 29 2025" or "29 Oct 2025": read here, since browsers parse written dates differently.
  m = /^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(text) ?? null;
  const day = m ? +m[2] : 0;
  let month = m ? MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) : -1;
  let year = m ? +m[3] : 0;
  if (!m) {
    const dayFirst = /^(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})$/i.exec(text);
    if (!dayFirst) return undefined;
    month = MONTHS.indexOf(dayFirst[2].slice(0, 3).toLowerCase());
    year = +dayFirst[3];
    return month >= 0 && +dayFirst[1] >= 1 && +dayFirst[1] <= 31 ? `${year}-${pad(month + 1)}-${pad(+dayFirst[1])}` : undefined;
  }
  return month >= 0 && day >= 1 && day <= 31 ? `${year}-${pad(month + 1)}-${pad(day)}` : undefined;
}

/** The first "N min/week|month|year" in a service description ("120 min/month Related + 240 min/year …"). */
export function parseService(value: CellValue): Pick<StudentIep, 'serviceMinutes' | 'servicePer'> {
  const m = /(\d+)\s*(?:min(?:ute)?s?)\.?\s*(?:\/|per|a|each)\s*(week|wk|month|mo|year|yr)/i.exec(String(value ?? ''));
  if (!m) return {};
  const unit = m[2].toLowerCase();
  const per: ServicePer = unit.startsWith('w') ? 'week' : unit.startsWith('m') ? 'month' : 'year';
  return { serviceMinutes: Number(m[1]), servicePer: per };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "by Oct 2026" in a goal as the last day of that month. */
export function goalTargetDate(text: string): string | undefined {
  const m = /\bby\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/i.exec(text);
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  const year = Number(m[2]);
  return `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;
}

// --- Goals ---

/** One goal per " | " (or line) in a goal cell, without labels such as "Goal 2:" or "Speech:" (kept as the area). */
export function splitGoals(cell: CellValue): { area?: string; text: string }[] {
  return String(cell ?? '')
    .split(/\s*\|\s*|\r?\n+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const label = /^([A-Za-z][A-Za-z0-9 &/-]{0,30}?)\s*:\s+(?=\S)/.exec(part);
      if (!label) return { text: part };
      // Without a leading list letter ("Language: a. Given …").
      const text = part.slice(label[0].length).trim().replace(/^[a-h][.)]\s+/, '');
      return /^goal\s*\d*$/i.test(label[1]) ? { text } : { area: label[1].trim(), text };
    })
    .filter(goal => goal.text.length > 0);
}

const has = (text: string, ...patterns: RegExp[]) => patterns.some(p => p.test(text));
const FUNCTION_WORDS = /\b(request|reject|protest|comment|greet|socializ|share info|information exchange|info exchange|ask|answer|direct attention|regulat)/g;

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
/** Lower case, with numbers written as words as digits ("at least two functions" → "at least 2 functions"). */
const forMatching = (text: string) => text.toLowerCase()
  .replace(new RegExp(`\\b(${NUMBER_WORDS.join('|')})\\b(?=\\s+(?:different|new|times?|functions|instances|opportunities|trials)\\b)`, 'g'), w => String(NUMBER_WORDS.indexOf(w)));

/** How many communicative functions a goal asks for ("at least 4 functions", "2 different functions"). */
const functionCount = (t: string) => {
  const m = /(\d+)\s+(?:\(?[a-z\s]*\)?\s*)?(?:different\s+|new\s+|language\s+|communicative\s+|communication\s+)*functions\b/.exec(t)
    ?? /at least (\d+) (?:different )?(?:language |communicative |communication )?functions/.exec(t);
  return m ? Number(m[1]) : null;
};

/** "at least 5 times", "3 instances per session", "3 multiword utterances per session", "at least once". */
const timesCount = (t: string) => {
  // Counted per session or period ("in a 20-minute period"), not once in each trial or task.
  const perPeriod = has(t, /\b(per|within|in|during) (a |an |each )?(session|\d+[- ]minute|period|observation|activity)/);
  if (/\bat least once\b/.test(t)) return perPeriod ? 1 : null;
  // "3times": PDFs sometimes run words together.
  const m = /(?:at least\s+)?(\d+)\s*(?:times?|instances|(?:multi-?word |novel |spontaneous )?(?:utterances|initiations|requests|comments))\b/.exec(t);
  return m && (perPeriod || /at least \d+\s*times/.test(t)) ? Number(m[1]) : null;
};

/** The goal type that fits what a goal measures, from its wording (and its label, such as "Speech"). */
export function classifyGoal(text: string, area = ''): { type: GoalType } {
  const t = forMatching(text);
  const a = area.toLowerCase();
  const opportunities = has(t, /\d+\s+(?:out\s+)?of\s+\d+/, /\d+\s*\/\s*\d+\s+(?:opportunit|trials|attempts)/, /\d+\s*%/, /accuracy/);

  if (has(t, /replacement (skill|behavior)/)) return { type: 'BEHAVIOR_ABC' };
  if (has(t, /\b(aggress|tantrum|elop|self-injur|hitting|kicking|disruptive|problem behavior)/) && has(t, /\b(reduce|decrease|no more than|fewer than)\b/)) {
    return { type: 'BEHAVIOR_FREQUENCY' };
  }
  if (has(t, /\b(on-task|off-task)\b/) && has(t, /interval/)) return { type: 'BEHAVIOR_INTERVAL' };
  // Not "feeding" alone: routines such as "play, feedings, diaper changes" are where a skill is practised.
  if (has(t, /\b(swallow|chew|bolus|oral intake|oral[- ]motor feeding|accept[a-z]* (?:\w+ )?(?:bites|textures|sips|foods?))/) || a.includes('feeding')) {
    return { type: 'FEEDING_SWALLOWING' };
  }
  if (has(t, /\b(stutter|disfluen|dysfluen|fluency|easy onset|fluent)/) || a.includes('fluency')) return { type: 'FLUENCY_SYLLABLE_STUTTER' };
  if (has(t, /(syllable deletion|consonant deletion|glottal replacement|fronting|stopping|cluster reduction|gliding|phonological process)/)) {
    return { type: 'PHONOLOGICAL_PROCESSES' };
  }
  // A breakdown strategy (restating, volume, rate, articulation) is used or not at each breakdown.
  if (has(t, /breakdown|repair strateg/)) return { type: 'DISCRETE_TRIALS' };
  // A sound in slashes (/s/), but not "he/she/they".
  if (has(t, /articulat|speech sounds?\b|(?:^|[\s(])\/[a-z]{1,3}\/(?=[\s,.)]|$)|multisyllabic|syllables within|intelligib/) || a === 'speech' || a === 'articulation') {
    return { type: 'ARTICULATION' };
  }
  if (has(t, /\bstory\b|narrative|retell|literary elements|story grammar|story elements/)) return { type: 'STORY_ELEMENTS' };

  // Communication counted by function ("at least 3 functions") or across listed functions with no count of times.
  const functionsListed = new Set(t.match(FUNCTION_WORDS) ?? []).size;
  if (functionCount(t) !== null || (has(t, /\bfunctions\b/) && functionsListed >= 2 && timesCount(t) === null)) {
    return { type: 'COMMUNICATION_FUNCTIONS' };
  }
  // A number of times per session or period.
  if (timesCount(t) !== null && !has(t, /\d+\s+(?:out\s+)?of\s+\d+/, /\d+\s*\/\s*\d+\s+(?:opportunit|trials|attempts)/)) return { type: 'BEHAVIOR_FREQUENCY' };
  if (has(t, /for (\d+) (?:consecutive )?minutes/) && !opportunities) return { type: 'BEHAVIOR_DURATION' };

  if (has(t, /\baac\b|device|voice[- ]output|switch|eye gaze|core board|speech[- ]generating|\bsgd\b|light-tech|high-tech|choice icon|picture exchange|\bpecs\b/) || a === 'aac') {
    return { type: 'AAC' };
  }
  if (has(t, /problem solv|reasoning|memory|recall|executive|attention to task/) || a.includes('problem solving') || a.includes('cogniti')) {
    return { type: opportunities ? 'DISCRETE_TRIALS' : 'COGNITIVE' };
  }
  // Grammar is expressive, even when the goal also asks to identify ("use present progressive -ing … identify verb").
  if (has(t, /verb tense|present progressive|past tense|\bplurals?\b|pronouns?\b|\barticles\b|\(-ing\)|possessive/)) return { type: 'LANGUAGE_EXPRESSION' };
  if (has(t, /\b(identify|answer[a-z]* (?:\S+ ){0,2}questions|follow(?:ing)? (?:\S+ )?directions|comprehen|understand|point to|receptive|vocabulary)/)) {
    return { type: 'LANGUAGE_COMPREHENSION' };
  }
  if (has(t, /\b(sentence|utterance|verb|tense|plural|pronoun|article|describe|label|grammar|morpholog|word combinations|phrases?)\b/) || a === 'language') {
    return { type: 'LANGUAGE_EXPRESSION' };
  }
  return { type: 'DISCRETE_TRIALS' };
}

/** Whether a behavior goal aims to raise or lower its count or time; other types use their usual direction. */
export function goalDirectionFor(type: GoalType, text: string): TargetDirection | undefined {
  if (type !== 'BEHAVIOR_FREQUENCY' && type !== 'BEHAVIOR_DURATION') return undefined;
  return /\b(reduce|decrease|no more than|fewer than)\b/i.test(text) ? 'decrease' : 'increase';
}

/** The goal's target in its type's measure: a percentage, a count, a number of functions, minutes or a 1-5 rating. */
export function goalTarget(type: GoalType, text: string): number {
  const t = forMatching(text);
  switch (type) {
    case 'COMMUNICATION_FUNCTIONS':
      return Math.min(COMMUNICATION_FUNCTIONS.length, functionCount(t) ?? 2);
    case 'BEHAVIOR_FREQUENCY': {
      if (/\b(no more than|fewer than|reduce|decrease)\b/.test(t)) {
        const m = /(?:no more than|fewer than|to)\s+(\d+)/.exec(t);
        return m ? Number(m[1]) : 2;
      }
      return timesCount(t) ?? 3;
    }
    case 'BEHAVIOR_DURATION': {
      const m = /for (\d+) (?:consecutive )?minutes/.exec(t);
      return m ? Number(m[1]) : 5;
    }
    case 'QUALITATIVE_OBSERVATION':
    case 'COGNITIVE':
      return 4;
    default: {
      const percent = /(\d{1,3})\s*%/.exec(t);
      if (percent) return Math.min(100, Number(percent[1]));
      const ratio = /(\d+)\s+(?:out\s+)?of\s+(\d+)/.exec(t);
      if (ratio && Number(ratio[2]) > 0 && Number(ratio[1]) <= Number(ratio[2])) return Math.round((Number(ratio[1]) / Number(ratio[2])) * 100);
      const trials = /(\d+)\s*\/\s*(\d+)\s+(?:trials|opportunit|attempts)/.exec(t);
      if (trials && Number(trials[2]) > 0) return Math.round((Number(trials[1]) / Number(trials[2])) * 100);
      return 80;
    }
  }
}

const INTRO = /^(given|when|during|following|after|while|using|with|in|at|on|across|by)\b/i;
const MAX_NAME = 60;

/** A short name for a goal: what the student will do, without the conditions before it or the criteria after. */
export function goalName(text: string): string {
  // Without list markers ("i. … ii. … iii. and …").
  let s = text.replace(/\b(?:i{1,3}|iv|vi{0,3})\.\s+/g, '').replace(/\s+/g, ' ').replace(/,\s*(?:and\s+)?(?=,)/g, '').trim();
  const will = /\bwill:?\s+(?:i\.\s*)?(.*)$/i.exec(s);
  if (will) s = will[1];
  else {
    s = s.replace(/^by\s+[a-z]+\.?\s+\d{4},?\s*/i, '');
    // "Given unrestricted AAC access, modeling, and 10s wait-time, use …": the conditions end where the list does.
    const parts = s.split(/,\s+/);
    if (parts.length > 1 && INTRO.test(parts[0])) {
      // The list of conditions ends with its "and …" item when there is one among the first few parts.
      const last = parts.slice(1, 5).findIndex(p => /^(and|or)\b/i.test(p));
      s = parts.slice(last >= 0 && last + 2 < parts.length ? last + 2 : 1).join(', ');
    }
  }
  const full = s;
  s = s
    .split(/,?\s+(?:as measured|with \d+\s*%|in \d+\s+(?:out\s+)?of\s+\d+|in \d+\s*%|across \d+|over \d+|over \d+\s*%|by (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{4}|given\b|during a \d+|within a \d+|at least \d+ times)/i)[0]
    .replace(/^(independently|appropriately|accurately)\s+/i, '')
    .replace(/^demonstrate (?:an |the )?ability to\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s,.;:]+$/, '');
  // Too little left without the criteria ("Communicate"): keep the wording up to the length limit instead.
  if (s.split(' ').length < 3) s = full.replace(/^(independently|appropriately|accurately)\s+/i, '').replace(/[\s,.;:]+$/, '');
  if (s.length > MAX_NAME) s = `${s.slice(0, MAX_NAME).replace(/\s+\S*$/, '').replace(/[\s,;(]+$/, '')}…`;
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Goal';
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// --- Reading the sheet ---

/**
 * The students in a spreadsheet's rows. The header row is the first one with a column for the student's name;
 * rows without a name are skipped.
 */
export function readStudentRows(rows: CellValue[][]): ImportPreview {
  const headerIndex = rows.slice(0, 10).findIndex(row => findColumns(row).has('name'));
  if (headerIndex < 0) throw new Error('No "Student Name" column was found. The first row should have column headings, such as Student Name, IEP Start Date, IEP End Date and Goals.');
  const columns = findColumns(rows[headerIndex]);
  const cell = (row: CellValue[], column: Column) => { const index = columns.get(column)?.[0]; return index === undefined ? null : row[index] ?? null; };

  const students: ImportStudent[] = [];
  const warnings: string[] = [];
  rows.slice(headerIndex + 1).forEach((row, i) => {
    const rowNumber = headerIndex + i + 2;
    if (!row.some(value => value !== null && String(value).trim() !== '')) return;
    const name = String(cell(row, 'name') ?? '').replace(/\s+/g, ' ').trim();
    if (!name) { warnings.push(`Row ${rowNumber} was skipped: it has no student name.`); return; }

    const iep: StudentIep = {
      ...(parseDate(cell(row, 'iepDate')) ? { iepDate: parseDate(cell(row, 'iepDate')) } : {}),
      ...(parseDate(cell(row, 'annualReviewDate')) ? { annualReviewDate: parseDate(cell(row, 'annualReviewDate')) } : {}),
      ...(parseDate(cell(row, 'reevaluationDate')) ? { reevaluationDate: parseDate(cell(row, 'reevaluationDate')) } : {}),
      ...parseService(cell(row, 'service')),
    };
    const goalTexts = (columns.get('goals') ?? []).flatMap(index => splitGoals(row[index] ?? null));
    const names = new Map<string, number>();
    const goals = goalTexts.map(({ area, text }): ImportGoal => {
      const { type } = classifyGoal(text, area);
      const direction = goalDirectionFor(type, text);
      let goalNameText = goalName(text);
      const seen = names.get(goalNameText) ?? 0;
      names.set(goalNameText, seen + 1);
      if (seen) goalNameText = `${goalNameText} (${seen + 1})`;
      return {
        name: goalNameText, smartGoal: text, type, target: goalTarget(type, text),
        ...(direction ? { direction } : {}),
        ...((goalTargetDate(text) ?? iep.annualReviewDate) ? { targetDate: goalTargetDate(text) ?? iep.annualReviewDate } : {}),
      };
    });
    students.push({ row: rowNumber, name, iep, goals });
  });

  // Two rows with the same name are different students: the later ones are numbered so they can be told apart.
  const counts = new Map<string, number>();
  for (const s of students) {
    const key = normalize(s.name);
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n > 1) s.name = `${s.name} (${n})`;
  }
  return { students, warnings };
}

// --- IEP at a Glance PDF ---

const PDF_HEADINGS = ['Student Name', 'IEP Start Date', 'IEP End Date', 'Re-evaluation Date', 'Service Time(s)', 'Goals'];
/** Page headers and footers, and the form's other sections, which aren't imported. */
const PDF_SKIP = /^(iep at a glance|student information:?|©|slp ?toolkit$)|copyright \d{4}|\bpage \d+ of \d+$/i;
const PDF_SECTION_END = /^(this student has|testing accommodations|classroom accommodations|equipment needed|case manager|accommodations|notes?:)/i;

/**
 * The students in an "IEP at a Glance" PDF (one student per page or two, as SLP Toolkit makes them), as rows
 * with the same headings as the spreadsheet, so they're read the same way. Each student starts at "Name:".
 */
export function iepGlanceRows(pages: string[][]): CellValue[][] {
  const lines = pages.flat().map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l && !PDF_SKIP.test(l));
  type Entry = { name: string; start: string; end: string; reeval: string; service: string; goals: string[] };
  const entries: Entry[] = [];
  let current: Entry | null = null;
  let inGoals = false;
  // A field's value runs up to the next label on the same line ("Name: … Eligibility: …").
  const field = (line: string, label: RegExp) => {
    const m = new RegExp(`(?:${label.source})\\s*:?\\s*(.*?)(?=\\s+(?:eligibility|iep start date|iep end date|annual review|re-?evaluation|triennial|case manager|grade|school|dob|date of birth)\\b.*:|$)`, 'i').exec(line);
    return m ? m[1].trim() : null;
  };

  for (const line of lines) {
    const name = /^(?:student )?name\s*:/i.test(line) ? field(line, /^(?:student )?name/) : null;
    if (name !== null) {
      current = { name, start: '', end: '', reeval: '', service: '', goals: [] };
      entries.push(current);
      inGoals = false;
      continue;
    }
    if (!current) continue;
    if (inGoals) {
      if (PDF_SECTION_END.test(line)) { inGoals = false; continue; }
      // "2. …" starts the next goal (only the next number, so a wrapped "2026." isn't taken for one).
      const item = /^(\d{1,2})[.)]\s+(.*)$/.exec(line);
      if (item && Number(item[1]) === current.goals.length + 1) { current.goals.push(item[2]); continue; }
      if (current.goals.length === 0) { current.goals.push(line); continue; }
      const last = current.goals.length - 1;
      // A word broken over two lines with a hyphen ("computer-" / "generated") keeps the hyphen, without a space.
      current.goals[last] += /-$/.test(current.goals[last]) ? line : ` ${line}`;
      continue;
    }
    const start = field(line, /iep start date|start date|iep date|meeting date/);
    if (start !== null && /start|iep date|meeting/i.test(line)) current.start ||= start;
    const end = field(line, /iep end date|end date|annual review(?: date)?/);
    if (end !== null) current.end ||= end;
    const reeval = field(line, /re-?evaluation(?: date)?|triennial(?: date)?/);
    if (reeval !== null) current.reeval ||= reeval;
    const service = /^service(?: time)?(?:\(s\))?s?\s*:\s*(.*)$/i.exec(line);
    if (service) current.service = service[1].trim();
    const goals = /^goals?\s*:\s*(.*)$/i.exec(line);
    if (goals) { inGoals = true; if (goals[1]) current.goals.push(goals[1].replace(/^1[.)]\s+/, '')); }
  }
  return [PDF_HEADINGS, ...entries.map(e => [e.name, e.start, e.end, e.reeval, e.service, e.goals.join(' | ')])];
}

/**
 * Links each imported student to an existing student with the same name (when exactly one has it), and marks the
 * goals that student already has (same goal text) so they aren't added twice.
 */
export function matchExistingStudents(students: ImportStudent[], existing: Pick<Student, 'id' | 'name' | 'goals' | 'iep'>[]): ImportStudent[] {
  return students.map(s => {
    const match = findExistingStudent(s, existing);
    if (!match) return { ...s, existingId: undefined, existingName: undefined, goals: s.goals.map(g => ({ ...g, duplicate: false })) };
    const known = (match.goals ?? []).map(g => g.smartGoal ?? '');
    return {
      ...s,
      existingId: match.id,
      existingName: normalize(match.name) === normalize(s.name) ? undefined : match.name,
      goals: s.goals.map(g => ({ ...g, duplicate: known.some(k => normalize(k) === normalize(g.smartGoal) || goalSimilarity(k, g.smartGoal) >= SAME_GOAL) })),
    };
  });
}

/**
 * The existing student a row is for: the one with the same name, or else the one whose name starts the same way
 * ("Jeremy (JJ)" for "Jeremy (JJ) Taylor", "Aiden (2)" for "Aiden Curnutte") and whose IEP started the same day.
 */
function findExistingStudent<T extends Pick<Student, 'name' | 'iep'>>(s: ImportStudent, existing: T[]): T | undefined {
  const exact = existing.filter(e => normalize(e.name) === normalize(s.name));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1 || !s.iep.iepDate) return undefined;
  const words = (name: string) => normalize(name.replace(/\s*\(\d+\)$/, '')).split(' ');
  const startsLike = (a: string[], b: string[]) => a.length <= b.length && a.every((w, i) => w === b[i]);
  const mine = words(s.name);
  const similar = existing.filter(e => e.iep?.iepDate === s.iep.iepDate && (startsLike(words(e.name), mine) || startsLike(mine, words(e.name))));
  return similar.length === 1 ? similar[0] : undefined;
}

/** Goals with this much of the shorter one's wording in common are the same goal, written out more or less fully. */
const SAME_GOAL = 0.78;

/** The share of the shorter goal's words (3 letters or more) that are also in the other one. */
export function goalSimilarity(a: string, b: string): number {
  const words = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length >= 3));
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  A.forEach(w => { if (B.has(w)) shared++; });
  return shared / Math.min(A.size, B.size);
}

const toGoal = (g: ImportGoal): Goal => ({
  id: generateUUID(),
  name: g.name,
  type: g.type,
  smartGoal: g.smartGoal,
  sessionTargetValue: g.target,
  ...(g.direction ? { targetDirection: g.direction } : {}),
  ...(g.targetDate ? { targetDate: g.targetDate } : {}),
});

/**
 * The student list after the import: new students added; existing ones given the IEP details from the
 * spreadsheet (what it leaves blank is kept) and the goals they don't already have.
 */
export function applyStudentImport(existing: Student[], students: ImportStudent[], userId: string, now = new Date()): { students: Student[]; added: number; updated: number; goals: number } {
  const stamp = now.toISOString();
  const byId = new Map(existing.map(s => [s.id, s]));
  let added = 0, updated = 0, goals = 0;
  const created: Student[] = [];
  for (const s of students) {
    const newGoals = s.goals.filter(g => !g.duplicate).map(toGoal);
    goals += newGoals.length;
    const current = s.existingId ? byId.get(s.existingId) : undefined;
    if (current) {
      byId.set(current.id, { ...current, iep: { ...current.iep, ...s.iep }, goals: [...(current.goals ?? []), ...newGoals], updatedAt: stamp });
      updated++;
    } else {
      created.push({ id: generateUUID(), name: s.name, goals: newGoals, iep: s.iep, createdAt: stamp, updatedAt: stamp, userId, isArchived: false });
      added++;
    }
  }
  return { students: [...existing.map(s => byId.get(s.id)!), ...created], added, updated, goals };
}
