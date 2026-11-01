import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readXlsx, serialToDate } from '../xlsx-read';
import {
  applyStudentImport, classifyGoal, goalName, goalTarget, goalTargetDate, matchExistingStudents, parseDate, parseService,
  readStudentRows, splitGoals,
} from '../student-import';
import type { Student } from '../types';

// Made-up students; the layout follows an "IEP at a glance" sheet.

/** A minimal .xlsx: shared strings, an inline string, and dates in a built-in and a custom date format. */
function workbook(): Uint8Array {
  const shared = ['Student Name', 'IEP Start Date', 'IEP End Date', 'Service Time(s)', 'Goals', 'Pat &amp; Lee',
    'Language: Pat will use 3 plurals in 4 of 5 opportunities by Mar 2027. | Goal 2: By Mar 2027, given a model, use AAC to greet peers in 80% of opportunities.'];
  const files = {
    'xl/workbook.xml': '<workbook><sheets><sheet name="IEPs" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<sst>${shared.map(s => `<si><t>${s}</t></si>`).join('')}<si><r><t>Ri</t></r><r><t>ch</t></r></si></sst>`,
    'xl/styles.xml': '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="mmm d, yyyy"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c></row>
      <row r="2"><c r="A2" t="s"><v>5</v></c><c r="B2" s="1"><v>46154</v></c><c r="C2" s="2"><v>46518</v></c><c r="D2" t="inlineStr"><is><t>120 min/month - Related</t></is></c><c r="E2" t="s"><v>6</v></c></row>
      <row r="4"><c r="A4" t="s"><v>7</v></c><c r="C4"><v>12</v></c></row>
    </sheetData></worksheet>`,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
}

describe('reading an .xlsx', () => {
  it('reads shared and inline strings, dates by their style, numbers and gaps', () => {
    const rows = readXlsx(workbook());
    expect(rows[0]).toEqual(['Student Name', 'IEP Start Date', 'IEP End Date', 'Service Time(s)', 'Goals']);
    expect(rows[1].slice(0, 4)).toEqual(['Pat & Lee', '2026-05-12', '2027-05-11', '120 min/month - Related']);
    expect(rows[2]).toEqual([]);
    expect(rows[3]).toEqual(['Rich', null, 12]);
  });
  it('rejects a file that isn\'t a workbook', () => {
    expect(() => readXlsx(strToU8('Student Name,Goals'))).toThrow(/isn't an Excel workbook/);
  });
  it('converts date numbers in both date systems', () => {
    expect(serialToDate(45000)).toBe('2023-03-15');
    expect(serialToDate(45000 - 1462, true)).toBe('2023-03-15');
  });
});

describe('reading students from the rows', () => {
  it('finds the columns by heading and gives each goal a type, target and target date', () => {
    const { students, warnings } = readStudentRows(readXlsx(workbook()));
    expect(warnings).toEqual([]);
    expect(students).toHaveLength(2);
    const [pat] = students;
    expect(pat).toMatchObject({ row: 2, name: 'Pat & Lee', iep: { iepDate: '2026-05-12', annualReviewDate: '2027-05-11', serviceMinutes: 120, servicePer: 'month' } });
    expect(pat.goals.map(g => [g.type, g.target, g.targetDate, g.name])).toEqual([
      ['LANGUAGE_EXPRESSION', 80, '2027-03-31', 'Use 3 plurals'],
      ['AAC', 80, '2027-03-31', 'Use AAC to greet peers'],
    ]);
  });

  it('works with CSV-style text cells, numbers students who share a name, and skips rows without a name', () => {
    const { students, warnings } = readStudentRows([
      ['Notes about this sheet'],
      ['Name', 'Eligibility', 'Annual IEP Date', 'Goal 1', 'Goal 2'],
      ['Sam', 'ASD', '3/9/2027', 'Use 2-word phrases in 4 of 5 opportunities', ''],
      ['Sam', 'ID', '', 'Answer wh- questions with 70% accuracy', 'Retell a story with 3 story elements'],
      ['', '', '', 'A goal without a student', ''],
    ]);
    expect(students.map(s => s.name)).toEqual(['Sam', 'Sam (2)']);
    expect(students[0].iep).toEqual({ annualReviewDate: '2027-03-09' });
    expect(students[1].goals.map(g => g.type)).toEqual(['LANGUAGE_COMPREHENSION', 'STORY_ELEMENTS']);
    expect(students[1].goals[0].target).toBe(70);
    expect(warnings).toEqual(['Row 5 was skipped: it has no student name.']);
  });

  it('needs a name column', () => {
    expect(() => readStudentRows([['Goals'], ['Use words']])).toThrow(/Student Name/);
  });
});

describe('goal wording', () => {
  it('splits goals on "|" and lines, keeping labels other than "Goal N" as the area', () => {
    expect(splitGoals('Speech: Produce /s/ | Goal 2: Answer questions\nRetell')).toEqual([
      { area: 'Speech', text: 'Produce /s/' }, { text: 'Answer questions' }, { text: 'Retell' },
    ]);
  });

  it.each([
    ['eliminate final consonant deletion in 7/10 trials', 'PHONOLOGICAL_PROCESSES', 70],
    ['produce /r/ in words with 80% accuracy', 'ARTICULATION', 80],
    ['use present progressive verb tense (-ing) in 4 of 5 opportunities (identify verb with 80% accuracy)', 'LANGUAGE_EXPRESSION', 80],
    ['use a communication breakdown strategy (restating, volume, rate, articulation) in 4 of 5 opportunities', 'DISCRETE_TRIALS', 80],
    ['given unrestricted AAC access, use multimodal communication to initiate interactions during daily routines (play, feedings, diaper changes)', 'AAC', 80],
    ['use symbolic communication at least 5 times for at least 3 functions within a 15-minute period', 'COMMUNICATION_FUNCTIONS', 3],
    ['communicate to request, reject, socialize, or share info at least 4 times per 15-minute period', 'BEHAVIOR_FREQUENCY', 4],
    ['ask a "who, what, where" question at least once in a 20-minute period', 'BEHAVIOR_FREQUENCY', 1],
    ['accept 5 bites of a new texture without gagging', 'FEEDING_SWALLOWING', 80],
    ['use easy onset to reduce stuttering in conversation with 90% fluent syllables', 'FLUENCY_SYLLABLE_STUTTER', 90],
    ['identify 10 literary elements in a novel', 'STORY_ELEMENTS', 80],
    ['engage in problem solving by naming one solution in 3 of 5 opportunities', 'DISCRETE_TRIALS', 60],
  ])('"%s" is %s with target %d', (text, type, target) => {
    const classified = classifyGoal(text).type;
    expect(classified).toBe(type);
    expect(goalTarget(classified, text)).toBe(target);
  });

  it('names a goal by what the student will do, without its conditions or criteria', () => {
    expect(goalName('By Oct 2026, given unrestricted AAC access, modeling, and 10s wait-time, use symbolic communication at least 3 times')).toBe('Use symbolic communication');
    expect(goalName('Given visual support, produce a complete sentence with articles in 4 of 5 opportunities')).toBe('Produce a complete sentence with articles');
    expect(goalName('By Oct 2026 JJ will: i. eliminate weak syllable deletion, ii. consonant deletion')).toBe('Eliminate weak syllable deletion, consonant deletion');
    expect(goalName('Communicate at least 10 times within a 30-minute period using a preferred modality for 3 functions').length).toBeLessThanOrEqual(61);
  });

  it('reads dates, service minutes and a goal\'s target month', () => {
    expect(parseDate('2027-3-9')).toBe('2027-03-09');
    expect(parseDate('12/1/26')).toBe('2026-12-01');
    expect(parseDate('13/1/2026')).toBeUndefined();
    expect(parseDate('soon')).toBeUndefined();
    expect(parseService('120 min/month Related + 240 min/year Feeding')).toEqual({ serviceMinutes: 120, servicePer: 'month' });
    expect(parseService('30 minutes per week')).toEqual({ serviceMinutes: 30, servicePer: 'week' });
    expect(parseService('Consult')).toEqual({});
    expect(goalTargetDate('… by Feb 2028.')).toBe('2028-02-29');
    expect(goalTargetDate('by June 2027')).toBe('2027-06-30');
  });
});

describe('importing into the student list', () => {
  const existing = [{
    id: 'a', name: 'Pat', userId: 'u', createdAt: '2026-01-01', iep: { reevaluationDate: '2028-01-01', serviceMinutes: 60, servicePer: 'week' },
    goals: [{ id: 'g', name: 'Old', type: 'AAC', smartGoal: 'Use AAC to greet peers.' }],
  }] as Student[];
  const { students } = readStudentRows([
    ['Student', 'IEP End Date', 'Goals'],
    ['pat', '2027-05-01', 'Use AAC to greet peers | Use 2 plurals in 4 of 5 opportunities'],
    ['Quinn', '2027-06-01', ''],
  ]);

  it('matches students by name and marks goals they already have', () => {
    const matched = matchExistingStudents(students, existing);
    expect(matched.map(s => s.existingId)).toEqual(['a', undefined]);
    expect(matched[0].goals.map(g => g.duplicate)).toEqual([true, false]);
  });

  it('updates existing students, adds new ones, and keeps IEP details the file leaves out', () => {
    const result = applyStudentImport(existing, matchExistingStudents(students, existing), 'u', new Date('2026-11-01T12:00:00Z'));
    expect(result).toMatchObject({ added: 1, updated: 1, goals: 1 });
    const pat = result.students.find(s => s.id === 'a')!;
    expect(pat.iep).toEqual({ reevaluationDate: '2028-01-01', serviceMinutes: 60, servicePer: 'week', annualReviewDate: '2027-05-01' });
    expect(pat.goals.map(g => [g.name, g.type, g.sessionTargetValue, g.targetDate])).toEqual([
      ['Old', 'AAC', undefined, undefined],
      ['Use 2 plurals', 'LANGUAGE_EXPRESSION', 80, '2027-05-01'],
    ]);
    const quinn = result.students.find(s => s.name === 'Quinn')!;
    expect(quinn).toMatchObject({ userId: 'u', goals: [], iep: { annualReviewDate: '2027-06-01' }, isArchived: false, createdAt: '2026-11-01T12:00:00.000Z' });
  });
});
