import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readXlsx, serialToDate } from '../xlsx-read';
import {
  applyStudentImport, classifyGoal, goalName, goalSimilarity, goalTarget, goalTargetDate, iepGlanceRows, matchExistingStudents, parseDate, parseService,
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
    expect(parseDate('Oct 29, 2025')).toBe('2025-10-29');
    expect(parseDate('September 3 2026')).toBe('2026-09-03');
    expect(parseDate('3 Sept 2026')).toBe('2026-09-03');
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

describe('IEP at a Glance PDF', () => {
  /** A minimal PDF with one Helvetica text line per [x, y, text], page by page. */
  function pdf(pages: [number, number, string][][]): Uint8Array {
    const objects: string[] = [];
    const pageIds = pages.map((_, i) => 4 + i * 2);
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    pages.forEach((lines, i) => {
      const escape = (t: string) => t.replace(/[\\()]/g, c => `\\${c}`);
      const stream = lines.map(([x, y, text]) => `BT /F1 11 Tf ${x} ${y} Td (${escape(text)}) Tj ET`).join('\n');
      objects[pageIds[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`;
      objects[pageIds[i] + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });
    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (let id = 1; id < objects.length; id++) { offsets[id] = out.length; out += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
    const xref = out.length;
    out += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return strToU8(out);
  }

  const footer = (n: number): [number, number, string][] => [[230, 30, 'Copyright 2026 SLP Toolkit'], [480, 30, `Page ${n} of 3`]];
  const file = () => pdf([
    [
      [250, 740, 'IEP at a Glance'], [260, 710, 'Student Information:'],
      [72, 680, 'Name: Pat Lee'], [330, 680, 'Eligibility: ASD'],
      [72, 655, 'IEP Start Date: Oct 29, 2025'], [330, 655, 'IEP End Date: Oct 28, 2026'],
      [72, 620, 'Case Manager:'], [72, 600, 'Service time(s): 180 min/month - Related'], [72, 580, 'Goals:'],
      [80, 560, '1. Speech: Given minimal pairs, Pat will eliminate final consonant'], [95, 545, 'deletion in 7/10 trials by October 2026.'],
      [80, 525, '2. Language: a. Given a model, by October 2026 Pat will produce 3'],
      ...footer(1),
    ],
    [
      [95, 740, 'multiword utterances per session.'],
      [72, 700, 'This student has...'], [72, 680, 'Testing Accommodations: NO YES*'],
      ...footer(2),
    ],
    [
      [250, 740, 'IEP at a Glance'], [72, 680, 'Name: Quinn "Q" Moss'], [330, 680, 'Eligibility: ID'],
      [72, 655, 'IEP Start Date: 2 Mar 2026'], [330, 655, 'IEP End Date: 1 Mar 2027'], [72, 600, 'Service time(s): 900 min/year - Related'],
      [72, 580, 'Goals:'], [80, 560, '1. Communication Goal: By March 2027, Quinn will demonstrate an ability to'],
      [95, 545, 'communicate at least two times for at least two different functions within a'], [95, 530, '15-minute period.'],
      ...footer(3),
    ],
  ]);

  it('reads each student\'s name, dates, service time and goals, across a page break', async () => {
    const { readPdfLines } = await import('../pdf-text');
    const pages = await readPdfLines(file());
    expect(pages[0][2]).toBe('Name: Pat Lee Eligibility: ASD');
    const rows = iepGlanceRows(pages);
    expect(rows.slice(1)).toEqual([
      ['Pat Lee', 'Oct 29, 2025', 'Oct 28, 2026', '', '180 min/month - Related',
        'Speech: Given minimal pairs, Pat will eliminate final consonant deletion in 7/10 trials by October 2026. | Language: a. Given a model, by October 2026 Pat will produce 3 multiword utterances per session.'],
      ['Quinn "Q" Moss', '2 Mar 2026', '1 Mar 2027', '', '900 min/year - Related',
        'Communication Goal: By March 2027, Quinn will demonstrate an ability to communicate at least two times for at least two different functions within a 15-minute period.'],
    ]);
    const { students } = readStudentRows(rows);
    expect(students[0]).toMatchObject({ name: 'Pat Lee', iep: { iepDate: '2025-10-29', annualReviewDate: '2026-10-28', serviceMinutes: 180, servicePer: 'month' } });
    expect(students[0].goals.map(g => [g.type, g.target, g.targetDate])).toEqual([['PHONOLOGICAL_PROCESSES', 70, '2026-10-31'], ['BEHAVIOR_FREQUENCY', 3, '2026-10-31']]);
    expect(students[1].goals.map(g => [g.type, g.target, g.name])).toEqual([['COMMUNICATION_FUNCTIONS', 2, 'Communicate at least two times for at least two different…']]);
  });

  it('rejects a file that isn\'t a PDF', async () => {
    const { readPdfLines } = await import('../pdf-text');
    await expect(readPdfLines(strToU8('not a pdf'))).rejects.toThrow(/couldn't be read as a PDF/);
  });
});

describe('matching students and goals written differently', () => {
  const existing = [
    { id: 'j', name: 'Jeremy (JJ)', iep: { iepDate: '2025-10-29' }, goals: [{ smartGoal: 'Speech: JJ will eliminate weak syllable deletion, consonant deletion and glottal replacement over 70% (7/10 trials) by Oct 2026.' }] },
    { id: 'a1', name: 'Aiden', iep: { iepDate: '2026-02-18' }, goals: [] },
    { id: 'a2', name: 'Aiden (2)', iep: { iepDate: '2026-04-15' }, goals: [] },
  ] as unknown as Student[];
  const row = (name: string, iepDate: string, goals: string[] = []) => ({ row: 2, name, iep: { iepDate }, goals: goals.map(smartGoal => ({ name: 'G', smartGoal, type: 'DISCRETE_TRIALS' as const, target: 80 })) });

  it('matches a fuller name when the IEP started the same day', () => {
    const [jj, aidenE, aidenC, other] = matchExistingStudents([
      row('Jeremy (JJ) Taylor', '2025-10-29'), row('Aiden Eckart', '2026-02-18'), row('Aiden Curnutte', '2026-04-15'), row('Jeremy Stone', '2026-01-01'),
    ], existing);
    expect([jj.existingId, aidenE.existingId, aidenC.existingId, other.existingId]).toEqual(['j', 'a1', 'a2', undefined]);
    expect(jj.existingName).toBe('Jeremy (JJ)');
  });

  it('marks a goal the student has in other words, but not a different goal', () => {
    const [jj] = matchExistingStudents([row('Jeremy (JJ) Taylor', '2025-10-29', [
      'Speech: Given further characterization of JJ\'s articulation differences, JJ will: i. eliminate his use of Weak Syllable Deletion, ii. Consonant Deletion, iii. and Glottal Replacement to afford correct productions over 70% (7/10 trials) by October 2026.',
      'Language: by October 2026 JJ will produce 3 multiword utterances per session.',
    ])], existing);
    expect(jj.goals.map(g => g.duplicate)).toEqual([true, false]);
    expect(goalSimilarity('use AAC to greet', 'answer wh- questions')).toBe(0);
  });

  it('reads targets written as 4/5 and numbers written as words', () => {
    expect(classifyGoal('engage in simple problem solving given visual cues in 4/5 opportunities').type).toBe('DISCRETE_TRIALS');
    expect(goalTarget('AAC', 'use a switch to request in 2/5 opportunities')).toBe(40);
    expect(goalTarget('COMMUNICATION_FUNCTIONS', 'communicate at least 5 times for at least four different functions')).toBe(4);
    expect(classifyGoal('ask a question at least one time in a 20-minute period').type).toBe('BEHAVIOR_FREQUENCY');
    expect(classifyGoal('activate a switch at least once during a structured task across 5 opportunities').type).toBe('AAC');
  });
});
