'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStudentData } from '@/hooks/use-student-data';
import { loadDataEntryDraft } from '@/lib/data-entry-draft';
import { plural } from '@/lib/helpers';
import { useStudentGroups } from '@/lib/student-groups';

// The dashboard's Today's Work: unsaved Data Entry work to pick up again, and a button per saved group that
// opens Data Entry with that group's students already in the slots.

export default function TodaysWork() {
  const { students, currentUser } = useStudentData();
  const uid = currentUser?.uid;
  const { groups } = useStudentGroups(uid);
  const [unsaved, setUnsaved] = useState(0);

  // Students in the draft with something entered (a student drops out of it once saved or reset).
  useEffect(() => {
    const draft = loadDataEntryDraft(uid);
    setUnsaved(draft ? Object.keys(draft.students).filter(id => students.some(s => s.id === id && !s.isArchived)).length : 0);
  }, [uid, students]);

  const active = (ids: string[]) => ids.filter(id => students.some(s => s.id === id && !s.isArchived)).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg"><ClipboardList className="h-5 w-5 text-primary" aria-hidden />Today&apos;s Work</CardTitle>
        <CardDescription>Pick up unsaved data, or start a session with a whole class or group.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {unsaved > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/60 bg-primary/10 p-3">
            <p className="text-sm">
              <strong>Unsaved data</strong>: {plural(unsaved, 'student')} {unsaved === 1 ? 'has' : 'have'} entries that aren&apos;t saved yet.
            </p>
            <Button asChild size="sm"><Link href="/data-entry">Continue Data Entry</Link></Button>
          </div>
        )}
        {groups.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {groups.map(group => {
              const count = active(group.studentIds);
              const label = (
                <>
                  <UsersRound className="mr-2 h-4 w-4 shrink-0" aria-hidden />
                  <span className="break-words">{group.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{count}</span>
                </>
              );
              const style = 'h-auto min-h-10 max-w-full whitespace-normal py-2 text-left';
              // A group whose students are all archived or deleted has nothing to load.
              return count === 0 ? (
                <Button key={group.id} variant="outline" disabled className={style} title="No active students in this group">{label}</Button>
              ) : (
                <Button key={group.id} asChild variant="outline" className={style}>
                  <Link href={`/data-entry?group=${encodeURIComponent(group.id)}`} aria-label={`Start data entry with ${group.name}, ${plural(count, 'student')}`}>{label}</Link>
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Save a class or small group under <Link href="/student-profile" className="underline hover:text-primary">Students → Groups</Link> and it will show up here, ready to start in one tap.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
