'use client';

import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStudentData } from '@/hooks/use-student-data';
import { useToast } from '@/hooks/use-toast';
import { formatDate, plural } from '@/lib/helpers';
import { flushWrites } from '@/lib/secure-store';

// Settings → Delete Data:
// - End-of-year clean-up: pick students who have left (archived ones can be selected in one tap) and delete them
//   with all their sessions.
// - Delete all data on this device: every student, session, template and setting the app has stored here
//   (passcode protection included), for handing the device on or leaving the app.

/** Every key the app stores in this browser (all start with "ascended", plus the sidebar setting). */
const isAppKey = (key: string) => key.startsWith('ascended_') || key.startsWith('__ascended') || key === 'sidebar_enabled';

export default function DeleteDataCard() {
  const { students, sessions, deleteStudents } = useStudentData();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmCleanUp, setConfirmCleanUp] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [typed, setTyped] = useState('');

  const rows = useMemo(() => students.map(student => {
    const own = sessions.filter(s => s.studentId === student.id);
    const last = own.reduce<string | null>((latest, s) => (!latest || new Date(s.date) > new Date(latest) ? s.date : latest), null);
    return { student, sessionCount: own.length, last };
  }).sort((a, b) => Number(!!b.student.isArchived) - Number(!!a.student.isArchived) || a.student.name.localeCompare(b.student.name)),
  [students, sessions]);

  const toggle = (id: string, on: boolean) => setSelected(prev => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });
  const selectedRows = rows.filter(r => selected.has(r.student.id));
  const selectedSessions = selectedRows.reduce((sum, r) => sum + r.sessionCount, 0);
  const archivedIds = rows.filter(r => r.student.isArchived).map(r => r.student.id);

  const cleanUp = () => {
    const count = selected.size;
    if (deleteStudents([...selected])) {
      toast({ title: 'Students deleted', description: `${plural(count, 'student')} and ${plural(selectedSessions, 'session')} were deleted from this device.` });
      setSelected(new Set());
    }
    setConfirmCleanUp(false);
  };

  const deleteAll = async () => {
    // Encrypted saves still in progress finish first, so none is written back after the deletion.
    await flushWrites();
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isAppKey(key)) keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
    try { sessionStorage.clear(); } catch { /* nothing kept there */ }
    // Starts fresh, with nothing of the old data left in memory.
    window.location.href = '/';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />Delete Data</CardTitle>
        <CardDescription>
          Remove student records you no longer need. Deleted data can&apos;t be recovered except from a backup, so back up
          first if you might need it (for example, to keep records your district requires).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="font-medium">End-of-year clean-up</h3>
          <p className="text-sm text-muted-foreground">Select students who have left and delete them together with all their sessions.</p>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students on this device.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={archivedIds.length === 0}
                  onClick={() => setSelected(new Set(archivedIds))}>
                  Select archived students ({archivedIds.length})
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>Clear selection</Button>
              </div>
              <ScrollArea className="h-64 rounded-md border">
                <ul className="divide-y">
                  {rows.map(({ student, sessionCount, last }) => (
                    <li key={student.id} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox id={`cleanup-${student.id}`} checked={selected.has(student.id)} onCheckedChange={v => toggle(student.id, v === true)} />
                      <Label htmlFor={`cleanup-${student.id}`} className="flex-1 min-w-0 cursor-pointer font-normal">
                        <span className="font-medium">{student.name}</span>
                        {student.isArchived && <Badge variant="outline" className="ml-2">Archived</Badge>}
                        <span className="block text-xs text-muted-foreground">
                          {plural(sessionCount, 'session')}{last ? ` · last ${formatDate(last)}` : ''}
                        </span>
                      </Label>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
              <Button type="button" variant="destructive" disabled={selected.size === 0} onClick={() => setConfirmCleanUp(true)}>
                Delete {plural(selected.size, 'student')}…
              </Button>
            </>
          )}
        </div>

        <div className="space-y-2 border-t pt-4">
          <h3 className="font-medium">Delete all data on this device</h3>
          <p className="text-sm text-muted-foreground">
            Removes every student, session, goal template and setting the app has stored on this device, including passcode
            protection. Use this before giving the device to someone else or when you stop using the app.
          </p>
          <Button type="button" variant="destructive" onClick={() => { setTyped(''); setConfirmAll(true); }}>Delete All Data…</Button>
        </div>
      </CardContent>

      <AlertDialog open={confirmCleanUp} onOpenChange={setConfirmCleanUp}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {plural(selected.size, 'student')} and {plural(selectedSessions, 'session')}?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedRows.map(r => r.student.name).join(', ')}. This can&apos;t be undone except by restoring a backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={cleanUp}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all data on this device?</AlertDialogTitle>
            <AlertDialogDescription>
              {plural(students.length, 'student')} and {plural(sessions.length, 'session')}, plus templates and settings, will be
              permanently deleted from this device. Back up first if you might need them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="delete-all-confirm">Type DELETE to confirm</Label>
            <Input id="delete-all-confirm" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={typed.trim().toUpperCase() !== 'DELETE'} onClick={deleteAll}>Delete Everything</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
