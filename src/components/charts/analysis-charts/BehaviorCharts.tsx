'use client';

import React, { useMemo } from 'react';
import type { Goal, SessionData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ReferenceLine, BarChart, Bar } from 'recharts';
import { behaviorMeasure, goalDirection, summarizeAbc, type AbcIncident } from '@/lib/goal-constants';
import { formatGoalTarget, goalTypeLabel } from '@/lib/helpers';

// Reports for behavior goals: each goal's measure per session against its target, and for ABC goals
// what most often comes before the behavior and the functions its consequences suggest.

interface BehaviorChartsProps {
  studentSessions: SessionData[]; // oldest first
  behaviorGoals: Goal[];
}

/** What a behavior goal's chart shows, and its unit. */
function measureInfo(goal: Goal): { label: string; unit: string; percent: boolean } {
  switch (goal.type) {
    case 'BEHAVIOR_FREQUENCY': return { label: 'Occurrences', unit: '', percent: false };
    case 'BEHAVIOR_DURATION': return { label: 'Total minutes', unit: ' min', percent: false };
    case 'BEHAVIOR_INTERVAL': return { label: '% of intervals', unit: '%', percent: true };
    case 'BEHAVIOR_LATENCY': return { label: 'Average latency (seconds)', unit: ' s', percent: false };
    default:
      return goalDirection(goal) === 'decrease'
        ? { label: 'Problem behavior incidents', unit: '', percent: false }
        : { label: '% of incidents with replacement skill', unit: '%', percent: true };
  }
}

const round = (n: number) => Math.round(n * 10) / 10;

export function behaviorSeries(goal: Goal, sessions: SessionData[]) {
  const direction = goalDirection(goal);
  const seen: Record<string, number> = {};
  const points: { label: string; value: number }[] = [];
  for (const session of sessions) {
    const data = session.goals.find(g => g.goalId === goal.id)?.data;
    if (!data) continue;
    const value = behaviorMeasure(goal.type, data, direction);
    if (value === null) continue;
    const day = new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    seen[day] = (seen[day] || 0) + 1;
    points.push({ label: seen[day] > 1 ? `${day} (${seen[day]})` : day, value: round(value) });
  }
  return points;
}

const metTarget = (value: number, target: number, direction: 'increase' | 'decrease') =>
  direction === 'decrease' ? value <= target : value >= target;

const TallyBars: React.FC<{ title: string; rows: [string, number][] }> = ({ title, rows }) => (
  <div>
    <p className="text-sm font-medium mb-1">{title}</p>
    {rows.length === 0 ? (
      <p className="text-xs text-muted-foreground">None recorded.</p>
    ) : (
      <ChartContainer config={{ count: { label: 'Incidents', color: 'hsl(var(--chart-1))' } }} className="w-full" style={{ height: 28 * rows.length + 30 }}>
        <BarChart data={rows.map(([name, count]) => ({ name, count }))} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <ChartTooltip content={<ChartTooltipContent hideLabel={false} />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={3} />
        </BarChart>
      </ChartContainer>
    )}
  </div>
);

const BehaviorGoalChart: React.FC<{ goal: Goal; sessions: SessionData[] }> = ({ goal, sessions }) => {
  const info = measureInfo(goal);
  const direction = goalDirection(goal);
  const target = goal.sessionTargetValue;
  const points = useMemo(() => behaviorSeries(goal, sessions), [goal, sessions]);

  const abc = useMemo(() => {
    if (goal.type !== 'BEHAVIOR_ABC') return null;
    const incidents: AbcIncident[] = sessions.flatMap(s => s.goals.find(g => g.goalId === goal.id)?.data?.incidents ?? []);
    return summarizeAbc({ incidents });
  }, [goal, sessions]);

  const values = points.map(p => p.value);
  const average = values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const metCount = target === undefined ? null : values.filter(v => metTarget(v, target, direction)).length;
  const maxY = Math.max(...values, target ?? 0, 1);

  const stats = [
    { label: 'Sessions', value: String(points.length) },
    { label: 'Latest', value: values.length ? `${values[values.length - 1]}${info.unit}` : '—' },
    { label: 'Average', value: average === null ? '—' : `${average}${info.unit}` },
    ...(metCount === null ? [] : [{ label: 'Met target', value: points.length ? `${metCount} of ${points.length}` : '—' }]),
  ];

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>{goal.name}</CardTitle>
        <CardDescription>
          {goalTypeLabel(goal.type)} · {info.label} per session
          {target !== undefined && ` · Target ${formatGoalTarget(goal.type, target, direction)}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {stats.map(stat => (
            <div key={stat.label} className="rounded-lg bg-muted/50 p-2">
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data recorded for this goal in the selected date range.</p>
        ) : (
          <div className="h-[260px] w-full">
            <ChartContainer config={{ value: { label: info.label, color: 'hsl(var(--primary))' } }} className="h-full w-full">
              <LineChart data={points} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  domain={info.percent ? [0, 100] : [0, Math.ceil(maxY * 1.1)]}
                  unit={info.percent ? '%' : undefined}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDecimals={goal.type === 'BEHAVIOR_DURATION' || goal.type === 'BEHAVIOR_LATENCY'}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                {target !== undefined && (
                  <ReferenceLine y={target} stroke="hsl(var(--chart-5))" strokeDasharray="6 4" label={{ value: 'Target', position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                )}
                <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={true} />
              </LineChart>
            </ChartContainer>
          </div>
        )}
        {abc && abc.incidentCount > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {abc.incidentCount} incidents in this range: {abc.problemCount} problem behavior, {abc.replacementCount} replacement skill.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TallyBars title="Antecedents (before problem behavior)" rows={abc.antecedents.slice(0, 8)} />
              <TallyBars title="Problem behaviors" rows={abc.behaviors.slice(0, 8)} />
              <TallyBars title="Possible functions" rows={abc.functions} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const BehaviorCharts: React.FC<BehaviorChartsProps> = ({ studentSessions, behaviorGoals }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {behaviorGoals.map(goal => <BehaviorGoalChart key={goal.id} goal={goal} sessions={studentSessions} />)}
  </div>
);

export default BehaviorCharts;
