'use client';

import React, { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GenericModal from '@/components/modals/generic-modal';
import { useStudentData } from '@/hooks/use-student-data';
import { useToast } from '@/hooks/use-toast';
import { formatDateOnly, formatGoalTarget, goalTypeLabel, plural } from '@/lib/helpers';
import { GOAL_TYPE_FIELDS } from '@/lib/goal-constants';
import type { GoalType } from '@/lib/types';
import type { CellValue } from '@/lib/xlsx-read';
import {
  goalDirectionFor, goalTarget, matchExistingStudents, readStudentRows, type ImportStudent,
} from '@/lib/student-import';

// Settings → Import Students: reads a spreadsheet with one row per student (name, IEP dates, service minutes,
// goals) and shows what will be imported, with each goal's type, before saving. The goal types are worked out
// from each goal's wording and can be changed here.

const GOAL_TYPES = (Object.keys(GOAL_TYPE_FIELDS) as GoalType[]).sort((a, b) => goalTypeLabel(a).localeCompare(goalTypeLabel(b)));

async function readRows(file: File): Promise<CellValue[][]> {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: true });
    return parsed.data;
  }
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Choose an Excel workbook (.xlsx) or a CSV file. An older .xls file can be saved as .xlsx in Excel first.');
  // Loaded only when importing, so the reader isn't part of every page.
  const { readXlsx } = await import('@/lib/xlsx-read');
  return readXlsx(new Uint8Array(await file.arrayBuffer()));
}

type Row = ImportStudent & { include: boolean };

export default function ImportStudentsCard() {
  const { students: existing, importStudents } = useStudentData();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const preview = readStudentRows(await readRows(file));
      if (preview.students.length === 0) throw new Error('No students were found under the column headings.');
      setRows(matchExistingStudents(preview.students, existing).map(s => ({ ...s, include: true })));
      setWarnings(preview.warnings);
      setFileName(file.name);
    } catch (error) {
      toast({ title: 'Couldn\'t read the file', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const included = useMemo(() => (rows ?? []).filter(r => r.include), [rows]);
  const goalCount = included.reduce((n, s) => n + s.goals.filter(g => !g.duplicate).length, 0);

  const update = (index: number, change: (row: Row) => Row) => setRows(prev => prev && prev.map((r, i) => (i === index ? change(r) : r)));
  const setType = (studentIndex: number, goalIndex: number, type: GoalType) => update(studentIndex, row => ({
    ...row,
    goals: row.goals.map((g, i) => (i === goalIndex ? { ...g, type, target: goalTarget(type, g.smartGoal), direction: goalDirectionFor(type, g.smartGoal) } : g)),
  }));

  const runImport = () => {
    const result = importStudents(included);
    if (!result) return;
    setRows(null);
    const parts = [result.added && `${plural(result.added, 'student')} added`, result.updated && `${plural(result.updated, 'student')} updated`].filter(Boolean);
    toast({ title: 'Students imported', description: `${parts.join(', ')}, with ${plural(result.goals, 'goal')}.` });
  };

  return (
    <Card id="import-students">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Import Students</CardTitle>
        <CardDescription>
          Add students from a spreadsheet (Excel .xlsx or CSV) with one row per student. Columns are found by their
          headings: Student Name, IEP Start Date, IEP End Date (the annual review), Re-evaluation Date, Service Time
          (such as &quot;120 min/month&quot;) and Goals (several goals in one cell separated by &quot;|&quot;, or one goal per
          column). Each goal&apos;s type is chosen from its wording, and you can check and change it before anything is saved.
          Students already here with the same name get the IEP dates from the file and any goals they don&apos;t have yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <input ref={inputRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="sr-only" aria-label="Spreadsheet of students" tabIndex={-1} onChange={e => void onFile(e.target.files?.[0])} />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" /> Choose Spreadsheet…
        </Button>
      </CardContent>

      <GenericModal
        isOpen={rows !== null}
        onClose={() => setRows(null)}
        title="Review Import"
        description={`${fileName}: ${plural(included.length, 'student')} and ${plural(goalCount, 'goal')} selected. Check each goal's type; it decides how data is recorded for the goal.`}
        size="2xl"
        initialFocus="window"
        footerContent={(
          <>
            <Button type="button" variant="outline" onClick={() => setRows(null)}>Cancel</Button>
            <Button type="button" onClick={runImport} disabled={included.length === 0}>
              Import {plural(included.length, 'Student')}
            </Button>
          </>
        )}
      >
        {warnings.length > 0 && (
          <ul className="mb-3 list-disc pl-5 text-sm text-muted-foreground">
            {warnings.map(w => <li key={w}>{w}</li>)}
          </ul>
        )}
        <ol className="space-y-3">
          {(rows ?? []).map((row, si) => {
            const iep = [
              row.iep.iepDate && `IEP ${formatDateOnly(row.iep.iepDate)}`,
              row.iep.annualReviewDate && `annual review ${formatDateOnly(row.iep.annualReviewDate)}`,
              row.iep.reevaluationDate && `re-evaluation ${formatDateOnly(row.iep.reevaluationDate)}`,
              row.iep.serviceMinutes && `${row.iep.serviceMinutes} min per ${row.iep.servicePer}`,
            ].filter(Boolean).join(' · ');
            const checkboxId = `import-student-${si}`;
            return (
              <li key={`${row.row}-${row.name}`} className={`rounded-md border p-3 ${row.include ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Checkbox id={checkboxId} checked={row.include} onCheckedChange={v => update(si, r => ({ ...r, include: v === true }))} />
                  <label htmlFor={checkboxId} className="font-semibold">{row.name}</label>
                  <Badge variant={row.existingId ? 'secondary' : 'outline'}>{row.existingId ? 'Updates existing student' : 'New student'}</Badge>
                </div>
                {iep && <p className="mt-1 text-xs text-muted-foreground">{iep}</p>}
                {row.goals.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No goals in the file.</p>}
                <ul className="mt-2 space-y-2">
                  {row.goals.map((goal, gi) => (
                    <li key={gi} className="rounded border-l-2 border-primary/40 pl-2">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${goal.duplicate ? 'line-through' : ''}`}>{goal.name}</p>
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer">Goal text</summary>
                            <p className="mt-1">{goal.smartGoal}</p>
                          </details>
                          {goal.duplicate && <p className="text-xs text-muted-foreground">Already on this student; won&apos;t be added again.</p>}
                        </div>
                        <div className="flex shrink-0 flex-col gap-0.5 sm:w-56">
                          <Select value={goal.type} onValueChange={v => setType(si, gi, v as GoalType)} disabled={goal.duplicate || !row.include}>
                            <SelectTrigger className="h-8 text-xs" aria-label={`Goal type for ${goal.name}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {GOAL_TYPES.map(type => <SelectItem key={type} value={type}>{goalTypeLabel(type)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">
                            Target {formatGoalTarget(goal.type, goal.target, goal.direction)}
                            {goal.targetDate && ` by ${formatDateOnly(goal.targetDate)}`}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </GenericModal>
    </Card>
  );
}
