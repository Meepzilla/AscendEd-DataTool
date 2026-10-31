'use client';

import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { getSchoolYearSetting, schoolYearRange, setSchoolYearSetting } from '@/lib/school-year';

/** Settings row for the school year's first and last day (month and day, so it repeats each year). */
export default function SchoolYearSetting() {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');

  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  useEffect(() => {
    const { start, end } = schoolYearRange();
    setFirst(ymd(start));
    setLast(ymd(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)));
  }, []);

  // Only the month and day are kept: the dates repeat each school year.
  const save = (nextFirst: string, nextLast: string) => {
    const current = getSchoolYearSetting();
    setSchoolYearSetting({
      start: nextFirst ? nextFirst.slice(5) : current.start,
      end: nextLast ? nextLast.slice(5) : current.end,
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label className="text-base font-medium">School Year</Label>
        <p className="text-sm text-muted-foreground">
          The first and last day of the school year. Used for school-year attendance and service minutes on student
          profiles, and School year to date on the Progress Report. The month and day repeat each year. Saved on this
          device only.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 [&_input]:block [&_input]:w-40 [&_input]:appearance-none">
        <div className="space-y-1">
          <Label htmlFor="school-year-first" className="text-xs">First day</Label>
          <Input id="school-year-first" type="date" value={first} onChange={e => { setFirst(e.target.value); save(e.target.value, last); }} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="school-year-last" className="text-xs">Last day</Label>
          <Input id="school-year-last" type="date" value={last} onChange={e => { setLast(e.target.value); save(first, e.target.value); }} />
        </div>
      </div>
    </div>
  );
}
