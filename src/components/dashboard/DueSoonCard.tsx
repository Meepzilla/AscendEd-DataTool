'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStudentData } from '@/hooks/use-student-data';
import { DUE_SOON_DAYS, dueSoon } from '@/lib/dashboard';
import { formatDateOnly, studentProfilePath } from '@/lib/helpers';
import { DueBadge } from '@/components/student-profile/StudentOverviewCard';

// The dashboard's Due Soon: annual reviews and re-evaluations that are overdue or coming up, from the IEP dates
// on each student's profile (Edit IEP Details).

const SHOWN = 8;

export default function DueSoonCard() {
  const { students } = useStudentData();
  const items = useMemo(() => dueSoon(students), [students]);
  const anyDates = students.some(s => !s.isArchived && (s.iep?.annualReviewDate || s.iep?.reevaluationDate));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg"><CalendarClock className="h-5 w-5 text-primary" aria-hidden />Due Soon</CardTitle>
        <CardDescription>IEP annual reviews and re-evaluations that are overdue or due in the next {DUE_SOON_DAYS} days.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {anyDates ? `Nothing is due in the next ${DUE_SOON_DAYS} days.` : 'No IEP dates yet. Add them on a student\'s profile with Edit IEP Details.'}
          </p>
        ) : (
          <ul className="divide-y">
            {items.slice(0, SHOWN).map(item => (
              <li key={`${item.studentId}-${item.kind}`}>
                <Link href={studentProfilePath(item.studentId)} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{item.studentName}</span>
                    <span className="block text-xs text-muted-foreground">{item.kind}, {formatDateOnly(item.date)}</span>
                  </span>
                  <DueBadge date={item.date} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {items.length > SHOWN && <p className="pt-2 text-xs text-muted-foreground">and {items.length - SHOWN} more. Open a student&apos;s profile to see all their dates.</p>}
      </CardContent>
    </Card>
  );
}
