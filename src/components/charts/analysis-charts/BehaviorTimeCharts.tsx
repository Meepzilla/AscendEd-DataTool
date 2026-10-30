'use client';

import React, { useMemo, useState } from 'react';
import type { SessionData } from '@/lib/types';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, LineChart, Line } from 'recharts';
import { Button } from '@/components/ui/button';
import { summarizeDuration, summarizeFrequency, summarizeLatency } from '@/lib/goal-constants';
import { formatClockTime, timePatterns, TIMING_MEASURE_LABELS, type TimingBucket } from '@/lib/behavior-timing';
import { formatDate } from '@/lib/helpers';

// When a behavior goal's behavior happens: by time of day, day of week and minutes into the session, a
// per-session trend that fits the measure (rate per hour, average episode length, no-response trials), and a
// time-stamped log of every recorded occurrence.

interface Recorded {
  session: SessionData;
  data: Record<string, any>;
  label: string;
}

const round = (n: number) => Math.round(n * 10) / 10;
const LOG_PAGE = 25;

const TimeBars: React.FC<{ title: string; hint: string; rows: TimingBucket[]; valueLabel: string }> =
  ({ title, hint, rows, valueLabel }) => (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground mb-1">{hint}</p>
      {rows.every(r => r.value === 0) ? (
        <p className="text-xs text-muted-foreground">None recorded.</p>
      ) : (
        <ChartContainer
          config={{ value: { label: valueLabel, color: 'hsl(var(--chart-1))' } }}
          className="h-[200px] w-full"
        >
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} allowDecimals />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );

/** A per-session line for the extra trend that fits the behavior measure. */
function sessionTrend(type: string, recorded: Recorded[]): { title: string; hint: string; unit: string; points: { label: string; value: number }[] } | null {
  if (type === 'BEHAVIOR_FREQUENCY') {
    const points = recorded
      .map(r => ({ label: r.label, rate: summarizeFrequency(r.data).ratePerHour }))
      .filter((p): p is { label: string; rate: number } => p.rate !== null)
      .map(p => ({ label: p.label, value: round(p.rate) }));
    return { title: 'Rate per hour', hint: 'Occurrences per hour of observation (sessions with an observation time).', unit: '/hr', points };
  }
  if (type === 'BEHAVIOR_DURATION') {
    const points = recorded
      .map(r => { const d = summarizeDuration(r.data); return { label: r.label, value: d.episodeCount ? round(d.totalMinutes / d.episodeCount) : null }; })
      .filter((p): p is { label: string; value: number } => p.value !== null);
    return { title: 'Average episode length', hint: 'Minutes per episode in each session.', unit: ' min', points };
  }
  if (type === 'BEHAVIOR_LATENCY') {
    const points = recorded
      .map(r => { const l = summarizeLatency(r.data); return { label: r.label, value: l.trialCount ? round((l.noResponseCount / l.trialCount) * 100) : null }; })
      .filter((p): p is { label: string; value: number } => p.value !== null);
    return { title: 'Trials with no response', hint: 'Percent of trials in each session.', unit: '%', points };
  }
  return null;
}

const BehaviorTimeCharts: React.FC<{ type: string; recorded: Recorded[] }> = ({ type, recorded }) => {
  const patterns = useMemo(() => timePatterns(type, recorded), [type, recorded]);
  const trend = useMemo(() => sessionTrend(type, recorded), [type, recorded]);
  const [logCount, setLogCount] = useState(0);
  if (patterns.eventCount === 0 && !trend?.points.length) return null;

  const labels = TIMING_MEASURE_LABELS[patterns.measure];
  const latency = patterns.measure === 'seconds';
  const exactPercent = Math.round(patterns.exactShare * 100);
  const peakText = [
    patterns.peakHour && `${latency ? 'Slowest' : 'Most'} around ${patterns.peakHour.name} (${patterns.peakHour.value}${labels.unit})`,
    patterns.peakWeekday && `${latency ? 'slowest' : 'highest'} day ${patterns.peakWeekday.name} (${patterns.peakWeekday.value}${labels.unit}${latency ? '' : ' per session'})`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-semibold">When it happens</p>
        <p className="text-xs text-muted-foreground">
          {peakText || 'Not enough data yet.'}
          {patterns.eventCount > 0 && exactPercent < 100 && ` · ${exactPercent}% with an exact time; the rest use the session's start time.`}
        </p>
      </div>
      {patterns.eventCount > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TimeBars title="Time of day" valueLabel={labels.total} rows={patterns.byHour}
            hint={latency ? 'Average seconds to respond by hour.' : `${labels.total} by hour, over all sessions.`} />
          <TimeBars title="Day of week" valueLabel={latency ? labels.total : `${labels.total} per session`} rows={patterns.byWeekday}
            hint={latency ? 'Average seconds to respond by day.' : 'Average per session on each day.'} />
          <TimeBars title="Minutes into the session" valueLabel={labels.total} rows={patterns.byMinuteIntoSession}
            hint="In 10-minute blocks from the session's start time (exact times only)." />
        </div>
      )}
      {trend && trend.points.length > 0 && (
        <div>
          <p className="text-sm font-medium">{trend.title}</p>
          <p className="text-xs text-muted-foreground mb-1">{trend.hint}</p>
          <ChartContainer config={{ value: { label: trend.title, color: 'hsl(var(--chart-2))' } }} className="h-[180px] w-full">
            <LineChart data={trend.points} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
              <YAxis tickLine={false} axisLine={false} allowDecimals unit={trend.unit === '%' ? '%' : undefined} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot />
            </LineChart>
          </ChartContainer>
        </div>
      )}
      {patterns.log.length > 0 && (
        <div>
          {logCount === 0 ? (
            <Button variant="outline" size="sm" onClick={() => setLogCount(LOG_PAGE)}>Show occurrence log ({patterns.log.length})</Button>
          ) : (
            <>
              <p className="text-sm font-medium mb-1">Occurrence log (newest first)</p>
              <ul className="divide-y rounded border text-xs">
                {patterns.log.slice(0, logCount).map((entry, i) => (
                  <li key={i} className="flex gap-3 px-2 py-1.5">
                    <span className="w-28 shrink-0 text-muted-foreground">{formatDate(entry.at.toISOString())}</span>
                    <span className="w-20 shrink-0">{entry.exact ? formatClockTime(entry.at) : `~${formatClockTime(entry.at)}`}</span>
                    <span className="min-w-0 break-words">{entry.text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex gap-2">
                {logCount < patterns.log.length && <Button variant="ghost" size="sm" onClick={() => setLogCount(c => c + LOG_PAGE)}>Show more</Button>}
                <Button variant="ghost" size="sm" onClick={() => setLogCount(0)}>Hide log</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">~ marks a session start time, used when the exact time wasn&apos;t recorded.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default BehaviorTimeCharts;
