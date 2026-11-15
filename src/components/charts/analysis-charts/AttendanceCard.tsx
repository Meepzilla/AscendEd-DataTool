'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SessionData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { formatDateOnly, plural } from '@/lib/helpers';
import { formatMinutes, sessionMinutes } from '@/lib/student-overview';
import {
  MISSED_REASONS, MISSED_REASON_SHORT, attendanceByDay, attendanceByMonth, attendanceRates, attendanceSummary, calendarWeeks,
  sessionDayKey, type MissedReason,
} from '@/lib/attendance';
import StatTile from './StatTile';

// Attendance for the student and date range on Reports: how many sessions were held and missed (and why), a
// bar per month, and a calendar that marks each day a session was held or missed. Missed sessions are the ones
// recorded with a student card's Missed button in Data Entry.

/** One fixed color per outcome, readable in the light and dark themes; each also has a label in the legend. */
const HELD_COLOR = '#16a34a';
const REASON_COLORS: Record<MissedReason, string> = {
  'student-absent': '#dc2626',
  'student-unavailable': '#d97706',
  'provider-absent': '#2563eb',
  'no-school': '#64748b',
  other: '#9333ea',
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const monthLabel = (month: string, style: 'long' | 'short' = 'long') =>
  new Date(`${month}-01T00:00`).toLocaleDateString('en-US', style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short', year: 'numeric' });

const shiftMonth = (month: string, by: number) => {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

interface Props {
  /** The student's sessions in the date range, held and missed. */
  sessions: SessionData[];
}

export default function AttendanceCard({ sessions }: Props) {
  const summary = useMemo(() => attendanceSummary(sessions), [sessions]);
  const rates = useMemo(() => attendanceRates(summary), [summary]);
  const months = useMemo(() => attendanceByMonth(sessions), [sessions]);
  const days = useMemo(() => attendanceByDay(sessions), [sessions]);
  const firstMonth = months[0]?.month;
  const lastMonth = months[months.length - 1]?.month;

  // The calendar opens on the latest month with a session, and follows the data when the student or range changes.
  const [month, setMonth] = useState<string | undefined>(lastMonth);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  useEffect(() => { setMonth(lastMonth); setSelectedDay(null); }, [lastMonth, firstMonth]);

  if (sessions.length === 0 || !firstMonth || !lastMonth) return null;
  const shown = month && month >= firstMonth && month <= lastMonth ? month : lastMonth;

  const usedReasons = MISSED_REASONS.filter(r => summary.byReason.some(b => b.reason === r));
  const chartRows = months.map(m => ({ name: monthLabel(m.month, 'short'), held: m.held, ...m.byReason }));
  const chartConfig = {
    held: { label: 'Held', color: HELD_COLOR },
    ...Object.fromEntries(MISSED_REASONS.map(r => [r, { label: MISSED_REASON_SHORT[r], color: REASON_COLORS[r] }])),
  };

  const selected = selectedDay ? sessions.filter(s => sessionDayKey(s.date) === selectedDay) : [];
  const dayText = (key: string) => {
    const day = days.get(key);
    if (!day) return 'no session';
    return [
      day.held ? `${plural(day.held, 'session')} held${day.minutes > 0 ? `, ${formatMinutes(day.minutes)}` : ''}` : null,
      ...day.missed.map(reason => `missed: ${MISSED_REASON_SHORT[reason].toLowerCase()}`),
    ].filter(Boolean).join(', ');
  };
  const shownMonth = months.find(m => m.month === shown);
  const selectedMinutes = selectedDay ? days.get(selectedDay)?.minutes ?? 0 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance</CardTitle>
        <CardDescription>
          Sessions held and missed in the selected date range. A session is missed when it is recorded with the Missed
          button on a student&apos;s card in Data Entry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <StatTile label="Held" value={String(summary.held)} className="p-2" valueClassName="text-lg"
            explanation="Sessions in the date range that took place." />
          <StatTile label="Missed" value={String(summary.missed)} className="p-2" valueClassName="text-lg"
            explanation={summary.missed
              ? `Sessions recorded as missed: ${summary.byReason.map(r => `${MISSED_REASON_SHORT[r.reason]} ${r.count}`).join(', ')}.`
              : 'No sessions were recorded as missed in the date range.'} />
          <StatTile label="Sessions held" value={rates.overall === null ? '—' : `${rates.overall}%`} className="p-2" valueClassName="text-lg"
            explanation={`Held ÷ (held + missed) × 100: ${summary.held} of ${summary.held + summary.missed} sessions.`} />
          <StatTile label="Student attendance" value={rates.student === null ? '—' : `${rates.student}%`} className="p-2" valueClassName="text-lg"
            explanation="Sessions held ÷ the sessions the student could have attended × 100. Sessions missed because the provider was absent or there was no school are left out." />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium">By month</p>
            <p className="mb-1 text-xs text-muted-foreground">Sessions held and missed in each month, by reason.</p>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={chartRows} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="held" stackId="a" fill="var(--color-held)" />
                {usedReasons.map(reason => <Bar key={reason} dataKey={reason} stackId="a" fill={`var(--color-${reason})`} />)}
              </BarChart>
            </ChartContainer>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground" aria-label="Minutes held each month">
              {months.map(m => (
                <li key={m.month} className="flex justify-between gap-2">
                  <span>{monthLabel(m.month)}</span>
                  <span>{m.minutes > 0 ? `${formatMinutes(m.minutes)} held` : 'no timed minutes'}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium" aria-live="polite">{monthLabel(shown)}</p>
                {shownMonth && shownMonth.minutes > 0 && (
                  <p className="text-xs text-muted-foreground">{formatMinutes(shownMonth.minutes)} held this month</p>
                )}
              </div>
              <div className="flex gap-1" role="group" aria-label="Change month">
                <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label="Previous month"
                  disabled={shown <= firstMonth} onClick={() => { setMonth(shiftMonth(shown, -1)); setSelectedDay(null); }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label="Next month"
                  disabled={shown >= lastMonth} onClick={() => { setMonth(shiftMonth(shown, 1)); setSelectedDay(null); }}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <table className="mt-1 w-full table-fixed border-separate border-spacing-1 text-center text-xs" aria-label={`Attendance calendar, ${monthLabel(shown)}`}>
              <thead>
                <tr>{WEEKDAYS.map((d, i) => <th key={i} scope="col" abbr={WEEKDAY_NAMES[i]} className="font-medium text-muted-foreground">{d}</th>)}</tr>
              </thead>
              <tbody>
                {calendarWeeks(shown).map((week, w) => (
                  <tr key={w}>
                    {week.map((key, i) => {
                      if (!key) return <td key={i} />;
                      const day = days.get(key);
                      const number = Number(key.slice(8));
                      if (!day) return <td key={i} className="h-11 rounded-md text-muted-foreground">{number}</td>;
                      // A day's color is its first missed reason, or held; a day with both gets a held dot too.
                      const reason = day.missed[0];
                      const color = reason ? REASON_COLORS[reason] : HELD_COLOR;
                      return (
                        <td key={i} className="p-0">
                          <button
                            type="button"
                            className={cn('relative flex h-11 w-full flex-col items-center justify-center rounded-md font-semibold text-white touch-manipulation',
                              selectedDay === key && 'ring-2 ring-foreground ring-offset-1 ring-offset-background')}
                            style={{ backgroundColor: color }}
                            aria-label={`${formatDateOnly(key)}: ${dayText(key)}`}
                            aria-pressed={selectedDay === key}
                            onClick={() => setSelectedDay(selectedDay === key ? null : key)}
                          >
                            <span className="leading-none">{number}</span>
                            {/* A mark as well as a color: ✓ held, ✕ missed. */}
                            <span className="text-[10px] leading-none" aria-hidden="true">{reason ? (day.held ? '✕ ✓' : '✕') : '✓'}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Calendar key">
              <li className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: HELD_COLOR }} />✓ Held</li>
              {usedReasons.map(reason => (
                <li key={reason} className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: REASON_COLORS[reason] }} />✕ {MISSED_REASON_SHORT[reason]}
                </li>
              ))}
            </ul>
            <div className="mt-2 min-h-[2.5rem] text-sm" aria-live="polite">
              {selectedDay ? (
                <>
                  <p className="font-medium">{formatDateOnly(selectedDay)}</p>
                  <ul className="text-muted-foreground">
                    {selected.map(s => {
                      const minutes = s.missed ? null : sessionMinutes(s);
                      return (
                        <li key={s.sessionId}>
                          {s.missed ? `Missed: ${MISSED_REASON_SHORT[s.missed.reason] ?? 'Other'}${s.missed.note ? ` (${s.missed.note})` : ''}` : `Held${minutes ? ` · ${formatMinutes(minutes)}` : ''}`}
                        </li>
                      );
                    })}
                  </ul>
                  {selectedMinutes > 0 && (
                    <p className="mt-1 text-muted-foreground">Total held this day: {formatMinutes(selectedMinutes)}</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Tap a marked day to see its sessions.</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
