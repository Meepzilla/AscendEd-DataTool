'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';
import ScrollingList, { VISIBLE_ROWS } from './ScrollingList';
import { Progress } from '@/components/ui/progress';
import { useStudentData } from '@/hooks/use-student-data';
import { serviceStatus, type ServiceItem } from '@/lib/dashboard';
import { plural, studentProfilePath } from '@/lib/helpers';
import { formatMinutes } from '@/lib/student-overview';

// The dashboard's Service Minutes: who still needs minutes this week or month (or is behind an even pace through
// the school year), from each student's required minutes (Edit IEP Details) and their sessions' start and end times.

const PERIOD_WORD = { week: 'week', month: 'month', year: 'school year' } as const;

function Row({ item }: { item: ServiceItem }) {
  const period = PERIOD_WORD[item.per];
  return (
    <li>
      <Link href={studentProfilePath(item.studentId)} className="block space-y-1 rounded-sm py-2 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-medium">{item.studentName}</span>
          <span className="text-xs text-muted-foreground">
            {item.kind === 'needed'
              ? `${formatMinutes(item.minutes)} still needed · ${plural(item.daysLeft, 'day')} left this ${period}`
              : `${formatMinutes(item.minutes)} behind pace for the ${period}`}
          </span>
        </span>
        <Progress value={Math.min(100, (item.delivered / item.required) * 100)} className="h-1.5" aria-label={`${item.studentName}: ${item.delivered} of ${item.required} minutes this ${period}`} />
        <span className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
          <span>{formatMinutes(item.delivered)} of {formatMinutes(item.required)} this {period}</span>
          {item.lastShort > 0 && <span className="font-medium text-amber-300">{formatMinutes(item.lastShort)} short last {period}</span>}
        </span>
      </Link>
    </li>
  );
}

export default function ServiceMinutesCard() {
  const { students, sessions, sessionsLoading } = useStudentData();
  const { tracked, behind } = useMemo(() => serviceStatus(students, sessions), [students, sessions]);

  return (
    <CollapsibleCard
      id="service-minutes"
      title="Service Minutes"
      icon={<Clock className="h-5 w-5 text-primary" aria-hidden />}
      description="Students who still need minutes to meet their IEP, those short last week or month first."
      count={sessionsLoading ? undefined : behind.length}
      countLabel={`${plural(behind.length, 'student')} still need minutes`}
    >
        {sessionsLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : tracked === 0 ? (
          <p className="text-sm text-muted-foreground">No required minutes yet. Add them on a student&apos;s profile with Edit IEP Details.</p>
        ) : behind.length === 0 ? (
          <p className="text-sm text-muted-foreground">Everyone with required minutes ({tracked}) has met them so far.</p>
        ) : (
          <ScrollingList count={behind.length} label="Students who still need service minutes">{behind.map(item => <Row key={item.studentId} item={item} />)}</ScrollingList>
        )}
        {behind.length > VISIBLE_ROWS && <p className="pt-2 text-xs text-muted-foreground">{plural(behind.length, 'student')}: scroll the list to see them all.</p>}
        {tracked > 0 && !sessionsLoading && <p className="pt-2 text-xs text-muted-foreground">Counts sessions with start and end times. Missed sessions aren&apos;t counted.</p>}
    </CollapsibleCard>
  );
}
