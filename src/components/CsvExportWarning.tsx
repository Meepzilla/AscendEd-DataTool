'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Shown before a CSV export: the file holds student names and session data in plain text (unlike a backup, it
// can't be password-protected, since it is meant to be opened in a spreadsheet). The de-identified option
// exports IDs only (student ID, session ID, goal ID, dates, minutes, and goal measures) with no names,
// notes, or free-text fields, and the file name has no student name in it. Identified export is the default,
// so existing behaviour is unchanged unless the box is ticked.

export default function CsvExportWarning({ studentName, open, onCancel, onConfirm }: {
  studentName: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (deidentified: boolean) => void;
}) {
  const [deidentified, setDeidentified] = useState(false);
  useEffect(() => { if (open) setDeidentified(false); }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={o => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Export {studentName}&apos;s data as a CSV file?</AlertDialogTitle>
          <AlertDialogDescription>
            {deidentified
              ? <>The de-identified file holds IDs only (student ID, session ID, goal ID, dates, minutes, and goal
                measures), with no student name, no notes, and no free-text fields, and the file name has no student
                name in it. It is still plain text, so save it only somewhere your district approves for student
                records, don&apos;t email it unencrypted, and delete it when you no longer need it.</>
              : <>The file contains the student&apos;s name and session data in plain text, readable by anyone who has it. Save it
                only somewhere your district approves for student records, don&apos;t email it unencrypted, and delete it when
                you no longer need it. For keeping a copy of your data, use Back Up Now in Settings instead (it can be
                password-protected).</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-start gap-2">
          <Checkbox id="csv-deidentified" checked={deidentified} onCheckedChange={v => setDeidentified(v === true)} />
          <Label htmlFor="csv-deidentified" className="text-sm font-normal leading-snug">
            De-identified export (IDs only, no names, notes, or free-text fields)
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(deidentified)}>
            {deidentified ? 'Export De-identified CSV' : 'Export CSV'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
