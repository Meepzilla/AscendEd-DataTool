'use client';

import React, { useMemo } from 'react';
import type { Goal, SessionData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ReferenceLine, BarChart, Bar } from 'recharts';
import {
  BEHAVIOR_GOAL_TYPES, captureTypeOf, goalDirection, summarizeAbc, scoreStory, STORY_PARTS, STORY_LINKING_WORDS, linkingWordField, COMMUNICATION_FUNCTIONS,
  type AbcIncident,
} from '@/lib/goal-constants';
import { goalMeasure, goalMeasureInfo, goalResponses, goalNotes, meetsTarget, promptTotals, usesPromptCounters, withoutRunningTimers } from '@/lib/goal-measures';
import { formatDate, formatGoalTarget, goalTypeLabel } from '@/lib/helpers';
import BehaviorTimeCharts from './BehaviorTimeCharts';

// A report card for each goal: its measure per session against the target, summary numbers, and a
// breakdown that fits the goal type (responses, prompt levels, story parts, communication functions,
// dysfluency types, ABC antecedents and functions), when behavior happens (behavior goals), plus recent notes.

interface GoalChartsProps {
  studentSessions: SessionData[]; // oldest first
  goals: Goal[];
}

const round = (n: number) => Math.round(n * 10) / 10;
const PROMPT_LABELS: Record<string, string> = { PartialPhysical: 'Partial physical' };

interface Recorded {
  session: SessionData;
  data: Record<string, any>;
  value: number;
  label: string;
}

/** The sessions where something was recorded for the goal, with its measure and a chart label. */
export function recordedSessions(goal: Goal, sessions: SessionData[]): Recorded[] {
  const seen: Record<string, number> = {};
  const recorded: Recorded[] = [];
  for (const session of sessions) {
    const stored = session.goals.find(g => g.goalId === goal.id)?.data;
    if (!stored) continue;
    const data = withoutRunningTimers(stored);
    const value = goalMeasure(goal, data);
    if (value === null) continue;
    const day = new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    seen[day] = (seen[day] || 0) + 1;
    recorded.push({ session, data, value: round(value), label: seen[day] > 1 ? `${day} (${seen[day]})` : day });
  }
  return recorded;
}

/** Horizontal bars, one row per item, optionally stacked from several series. */
const HBars: React.FC<{
  title: string;
  rows: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
  max?: number;
}> = ({ title, rows, series, max }) => (
  <div>
    <p className="text-sm font-medium mb-1">{title}</p>
    {rows.length === 0 ? (
      <p className="text-xs text-muted-foreground">None recorded.</p>
    ) : (
      <ChartContainer
        config={Object.fromEntries(series.map(s => [s.key, { label: s.label, color: s.color }]))}
        className="w-full"
        style={{ height: 26 * rows.length + (series.length > 1 ? 60 : 30) }}
      >
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" allowDecimals={max !== undefined} domain={max !== undefined ? [0, max] : undefined} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {series.map(s => <Bar key={s.key} dataKey={s.key} stackId="a" fill={`var(--color-${s.key})`} />)}
        </BarChart>
      </ChartContainer>
    )}
  </div>
);

const tallyRows = (entries: [string, number][]) => entries.filter(([, n]) => n > 0).map(([name, count]) => ({ name, count }));
const COUNT_SERIES = [{ key: 'count', label: 'Count', color: 'hsl(var(--chart-1))' }];

/** The breakdowns that fit the goal type, over the sessions in the date range. */
const GoalBreakdowns: React.FC<{ goal: Goal; recorded: Recorded[] }> = ({ goal, recorded }) => {
  const type = captureTypeOf(goal);
  const panels: React.ReactNode[] = [];
  const data = recorded.map(r => r.data);
  const sum = (get: (d: Record<string, any>) => number) => data.reduce((total, d) => total + get(d), 0);

  if (type === 'STORY_CHAMPS') {
    panels.push(
      <HBars key="parts" title="Average score by story part (0-2)" max={2} series={[{ key: 'average', label: 'Average score', color: 'hsl(var(--chart-2))' }]}
        rows={STORY_PARTS.map(p => ({ name: p.label, average: round(sum(d => Math.min(2, Number(d[p.key]) || 0)) / data.length) }))} />,
      <HBars key="words" title="Linking words" series={COUNT_SERIES}
        rows={tallyRows(STORY_LINKING_WORDS.map(w => [w, sum(d => Number(d[linkingWordField(w)]) || 0)]))} />,
    );
  }
  if (type === 'COMMUNICATION_FUNCTIONS') {
    panels.push(
      <HBars key="functions" title="Uses by function" series={[
        { key: 'spontaneous', label: 'Spontaneous', color: 'hsl(var(--chart-2))' },
        { key: 'prompted', label: 'Prompted', color: 'hsl(var(--chart-4))' },
      ]}
        rows={COMMUNICATION_FUNCTIONS
          .map(f => ({ name: f.label, spontaneous: sum(d => Number(d[`${f.key}Spontaneous`]) || 0), prompted: sum(d => Number(d[`${f.key}Prompted`]) || 0) }))
          .filter(r => r.spontaneous + r.prompted > 0)} />,
    );
  }
  if (type === 'FLUENCY_SYLLABLE_STUTTER') {
    panels.push(
      <HBars key="dysfluency" title="Dysfluency types" series={COUNT_SERIES}
        rows={tallyRows((['blocks', 'repetitions', 'prolongations', 'interjections'] as const)
          .map(k => [k.charAt(0).toUpperCase() + k.slice(1), sum(d => Number(d[k]) || 0)]))} />,
    );
  }
  if (type === 'BEHAVIOR_ABC') {
    const abc = summarizeAbc({ incidents: data.flatMap(d => (Array.isArray(d.incidents) ? d.incidents : []) as AbcIncident[]) });
    panels.push(
      <HBars key="antecedents" title="Antecedents (before problem behavior)" series={COUNT_SERIES} rows={tallyRows(abc.antecedents.slice(0, 8))} />,
      <HBars key="behaviors" title="Problem behaviors" series={COUNT_SERIES} rows={tallyRows(abc.behaviors.slice(0, 8))} />,
      <HBars key="functions" title="Possible functions" series={COUNT_SERIES} rows={tallyRows(abc.functions)} />,
    );
  }
  if (usesPromptCounters(type)) {
    const totals = promptTotals();
    data.forEach(d => Object.entries(promptTotals(d)).forEach(([k, v]) => { totals[k] += v; }));
    const rows = tallyRows(Object.entries(totals).map(([k, v]) => [PROMPT_LABELS[k] ?? k, v]));
    if (rows.length > 0) panels.push(<HBars key="prompts" title="Prompt levels" series={COUNT_SERIES} rows={rows} />);
  }
  if (panels.length === 0) return null;
  return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{panels}</div>;
};

const GoalChartCard: React.FC<{ goal: Goal; sessions: SessionData[] }> = ({ goal, sessions }) => {
  const info = goalMeasureInfo(goal);
  const type = captureTypeOf(goal);
  const direction = goalDirection(goal);
  const target = goal.sessionTargetValue;
  const recorded = useMemo(() => recordedSessions(goal, sessions), [goal, sessions]);

  const points = recorded.map(r => ({ label: r.label, value: r.value, ...(goalResponses(type, r.data) ?? {}) }));
  const hasResponses = goalResponses(type) !== null && points.length > 0;
  const values = recorded.map(r => r.value);
  const average = values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const metCount = target === undefined ? null : values.filter(v => meetsTarget(goal, v, target)).length;
  const yMax = info.max ?? Math.ceil(Math.max(...values, target ?? 0, 1) * 1.1);
  const notes = recorded.map(r => ({ date: r.session.date, text: goalNotes(r.data) })).filter(n => n.text).slice(-3).reverse();
  const storyWords = type === 'STORY_CHAMPS' ? recorded.reduce((total, r) => total + scoreStory(r.data).linkingWords, 0) : null;

  const stats = [
    { label: 'Sessions with data', value: String(points.length) },
    { label: 'Latest', value: values.length ? `${values[values.length - 1]}${info.unit}` : '—' },
    { label: 'Average', value: average === null ? '—' : `${average}${info.unit}` },
    ...(metCount === null ? [] : [{ label: 'Met target', value: points.length ? `${metCount} of ${points.length}` : '—' }]),
  ];

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>{goal.name}</CardTitle>
        <CardDescription>
          {goalTypeLabel(type)} · {info.label} per session
          {target !== undefined && ` · Target ${formatGoalTarget(type, target, goal.targetDirection)}`}
          {storyWords !== null && ` · ${storyWords} linking words`}
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
          <div className={hasResponses ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
            <div className="h-[240px] w-full">
              <ChartContainer config={{ value: { label: info.label, color: 'hsl(var(--primary))' } }} className="h-full w-full">
                <LineChart data={points} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis domain={[0, yMax]} unit={info.unit === '%' ? '%' : undefined} tickLine={false} axisLine={false} tickMargin={8}
                    ticks={info.max !== undefined && info.max <= 10 ? Array.from({ length: info.max + 1 }, (_, i) => i) : undefined}
                    allowDecimals={type === 'BEHAVIOR_DURATION' || type === 'BEHAVIOR_LATENCY'} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  {target !== undefined && (
                    <ReferenceLine y={target} stroke="hsl(var(--chart-5))" strokeDasharray="6 4"
                      label={{ value: direction === 'decrease' ? 'Target (max)' : 'Target', position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  )}
                  <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={true} />
                </LineChart>
              </ChartContainer>
            </div>
            {hasResponses && (
              <div className="h-[240px] w-full">
                <ChartContainer
                  config={{
                    correct: { label: 'Correct', color: 'hsl(var(--chart-2))' },
                    approximate: { label: 'Approximate', color: 'hsl(var(--chart-4))' },
                    incorrect: { label: 'Incorrect', color: 'hsl(var(--chart-5))' },
                  }}
                  className="h-full w-full"
                >
                  <BarChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="correct" stackId="r" fill="var(--color-correct)" />
                    <Bar dataKey="approximate" stackId="r" fill="var(--color-approximate)" />
                    <Bar dataKey="incorrect" stackId="r" fill="var(--color-incorrect)" />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </div>
        )}
        {recorded.length > 0 && <GoalBreakdowns goal={goal} recorded={recorded} />}
        {recorded.length > 0 && BEHAVIOR_GOAL_TYPES.includes(type) && <BehaviorTimeCharts type={type} recorded={recorded} />}
        {notes.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Recent notes</p>
            <ul className="space-y-1 text-sm">
              {notes.map((note, i) => (
                <li key={i}><span className="text-muted-foreground">{formatDate(note.date)}:</span> {note.text}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const GoalCharts: React.FC<GoalChartsProps> = ({ studentSessions, goals }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {goals.map(goal => <GoalChartCard key={goal.id} goal={goal} sessions={studentSessions} />)}
  </div>
);

export default GoalCharts;
