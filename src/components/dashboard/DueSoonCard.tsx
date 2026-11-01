'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';
import ScrollingList, { VISIBLE_ROWS } from './ScrollingList';
import { useStudentData } from '@/hooks/use-student-data';
import { DUE_SOON_DAYS, dueSoon } from '@/lib/dashboard';
import { formatDateOnly, plural, studentProfilePath } from '@/lib/helpers';
import { DueBadge } from '@/components/student-profile/StudentOverviewCard';

// The dashboard's Due Soon: annual reviews and re-evaluations that are overdue or coming up, from the IEP dates
// on each student's profile (Edit IEP Details). Shows 4 at a time and scrolls for the rest.

export default function DueSoonCard() {
  const { students } = useStudentData();
  const items = useMemo(() => dueSoon(students), [students]);
  const anyDates = students.some(s => !s.isArchived && (s.iep?.annualReviewDate || s.iep?.reevaluationDate));

  return (
    <CollapsibleCard
      id="due-soon"
      title="Due Soon"
      icon={<CalendarClock className="h-5 w-5 text-primary" aria-hidden />}
      description={`IEP annual reviews and re-evaluations that are overdue or due in the next ${DUE_SOON_DAYS} days.`}
      count={items.length}
      countLabel={`${plural(items.length, 'review')} overdue or due soon`}
    >
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {anyDates ? `Nothing is due in the next ${DUE_SOON_DAYS} days.` : 'No IEP dates yet. Add them on a student\'s profile with Edit IEP Details.'}
          </p>
        ) : (
          <ScrollingList count={items.length} label="IEP reviews overdue or due soon">
            {items.map(item => (
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
          </ScrollingList>
        )}
        {items.length > VISIBLE_ROWS && <p className="pt-2 text-xs text-muted-foreground">{plural(items.length, 'review')}: scroll the list to see them all.</p>}
    </CollapsibleCard>
  );
}
