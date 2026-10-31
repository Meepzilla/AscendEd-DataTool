'use client';

import React from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Shown before a CSV export: the file holds student names and session data in plain text (unlike a backup, it
// can't be password-protected, since it is meant to be opened in a spreadsheet).

export default function CsvExportWarning({ studentName, open, onCancel, onConfirm }: {
  studentName: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={o => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Export {studentName}&apos;s data as a CSV file?</AlertDialogTitle>
          <AlertDialogDescription>
            The file contains the student&apos;s name and session data in plain text, readable by anyone who has it. Save it
            only somewhere your district approves for student records, don&apos;t email it unencrypted, and delete it when
            you no longer need it. For keeping a copy of your data, use Back Up Now in Settings instead (it can be
            password-protected).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Export CSV</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
