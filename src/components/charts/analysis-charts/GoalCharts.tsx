'use client';

import React, { useMemo } from 'react';
import type { Goal, SessionData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ReferenceLine, BarChart, Bar } from 'recharts';
import {
  BEHAVIOR_GOAL_TYPES, captureTypeOf, toolTypeOf, summarizeLatency, goalDirection, summarizeAbc, summarizeCommunicationFunctions, scoreStory, averageStoryPart, STORY_PARTS, STORY_LINKING_WORDS, linkingWordField, COMMUNICATION_FUNCTIONS,
  type AbcIncident,
} from '@/lib/goal-constants';
import { goalMeasure, goalMeasureInfo, goalResponses, goalNotes, sessionMeetsTarget, promptTotals, usesPromptCounters, withoutRunningTimers } from '@/lib/goal-measures';
import { formatDate, formatGoalTarget, goalTypeLabel, parseDateOnly } from '@/lib/helpers';
import BehaviorTimeCharts from './BehaviorTimeCharts';
import { goalCardId } from './goal-card-id';
import StatTile from './StatTile';
import { goalStatExplanations } from '@/lib/report-formulas';
import type { TaskStepScore } from '@/lib/task-analysis';
import { AIM_STATUS_LABELS, aimLine, aimStatus, aimValueAt, masterySessions } from '@/lib/aim-line';
import ExpandableGoalName from './ExpandableGoalName';
import { gasLevelDescription, gasLevelText } from '@/lib/gas';
import type { StudentIep } from '@/lib/types';

// A report card for each goal: its measure per session against the target, summary numbers, and a
// breakdown that fits the goal type (responses, prompt levels, story parts, communication functions,
// dysfluency types, ABC antecedents and functions), when behavior happens (behavior goals), plus recent notes.

interface GoalChartsProps {
  studentSessions: SessionData[]; // oldest first
  goals: Goal[];
  studentName?: string;
  studentIep?: StudentIep;
}

const round = (n: number) => Math.round(n * 10) / 10;
const PROMPT_LABELS: Record<string, string> = { PartialPhysical: 'Partial physical' };

const GAS_LEVELS = [-2, -1, 0, 1, 2] as const;

interface Recorded {
  session: SessionData;
  data: Record<string, any>;
  value: number;
  label: string;
}

/**
 * The sessions where something was recorded for the goal, with its measure and a chart label. With
 * `unanswered`, latency sessions where the student never responded (no time to measure) are included too, with
 * a value of NaN, for the charts that count trials rather than chart the measure.
 */
export function recordedSessions(goal: Goal, sessions: SessionData[], unanswered = false): Recorded[] {
  const matched: { session: SessionData; data: Record<string, any>; value: number; date: Date }[] = [];
  for (const session of sessions) {
    const stored = (session.goals ?? []).find(g => g.goalId === goal.id)?.data;
    if (!stored) continue;
    const data = withoutRunningTimers(stored);
    let value = goalMeasure(goal, data);
    if (value === null && unanswered && toolTypeOf(captureTypeOf(goal)) === 'BEHAVIOR_LATENCY' && summarizeLatency(data).trialCount > 0) value = NaN;
    if (value === null) continue;
    matched.push({ session, data, value: round(value), date: parseDateOnly(session.date) });
  }
  const years = new Set(matched.map(m => m.date.getFullYear()).filter(Number.isFinite));
  const showYear = years.size > 1;
  const seen: Record<string, number> = {};
  return matched.map(({ session, data, value, date }) => {
    const valid = !Number.isNaN(date.getTime());
    const dayKey = valid ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : String(session.date);
    const day = valid
      ? date.toLocaleDateString('en-US', showYear ? { month: 'short', day: 'numeric', year: '2-digit' } : { month: 'short', day: 'numeric' })
      : String(session.date);
    seen[dayKey] = (seen[dayKey] || 0) + 1;
    return { session, data, value, label: seen[dayKey] > 1 ? `${day} (${seen[dayKey]})` : day };
  });
}

/** Horizontal bars, one row per item, optionally stacked from several series. */
const HBAR_LABEL_WIDTH = 150;
/** About how many 11px characters fit in the bar chart's label column. */
const HBAR_LABEL_CHARS = 24;

/** A bar label on one line, shortened with "…" to fit the label column (recharts would wrap a long label onto
 *  lines that overlap the next bar, or drop it). The whole label shows on hover and in the tooltip. */
const OneLineTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) => {
  const text = String(payload?.value ?? '');
  const short = text.length > HBAR_LABEL_CHARS ? `${text.slice(0, HBAR_LABEL_CHARS - 1).trimEnd()}…` : text;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="hsl(var(--muted-foreground))">
      <title>{text}</title>
      {short}
    </text>
  );
};

/** Formats tooltip rows with explicit singular/plural units (e.g., "2 functions" vs "3 uses") while keeping series swatches. */
function unitTooltipFormatter(config: ChartConfig, singular: string, pluralWord: string) {
  return function formatTooltipRow(value: unknown, name: unknown, item: { color?: string; dataKey?: string | number }) {
    const key = String(item?.dataKey ?? name ?? '');
    const label = config[key]?.label ?? String(name ?? '');
    const num = Number(value);
    const unit = num === 1 ? singular : pluralWord;
    const swatch = item?.color ?? (config[key] && 'color' in config[key] ? config[key].color : undefined);
    return (
      <div className="flex w-full items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {swatch && <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: swatch }} />}
          {label}
        </span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {Number.isFinite(num) ? `${num.toLocaleString()} ${unit}` : String(value)}
        </span>
      </div>
    );
  };
}

const COMM_USES_CONFIG: ChartConfig = {
  spontaneousUses: { label: 'Spontaneous', color: 'hsl(var(--comm-spontaneous))' },
  emergingUses: { label: 'Emerging', color: 'hsl(var(--comm-emerging))' },
  promptedUses: { label: 'Prompted', color: 'hsl(var(--comm-prompted))' },
};

const HBars: React.FC<{
  title: string;
  rows: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
  max?: number;
  /** Width of the label column (default 150). */
  labelWidth?: number;
  /** Optional [singular, plural] unit shown after tooltip values. */
  unit?: [string, string];
}> = ({ title, rows, series, max, labelWidth = HBAR_LABEL_WIDTH, unit }) => {
  const config: ChartConfig = Object.fromEntries(series.map(s => [s.key, { label: s.label, color: s.color }]));
  return (
    <div>
      <p className="text-sm font-medium mb-1">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">None recorded.</p>
      ) : (
        <ChartContainer
          config={config}
          className="w-full"
          style={{ height: 30 * rows.length + (series.length > 1 ? 60 : 30) }}
        >
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <XAxis type="number" allowDecimals={max !== undefined} domain={max !== undefined ? [0, max] : undefined} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" width={labelWidth} tickLine={false} axisLine={false} interval={0} tick={<OneLineTick />} />
            <ChartTooltip content={<ChartTooltipContent formatter={unit ? unitTooltipFormatter(config, unit[0], unit[1]) : undefined} />} />
            {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
            {series.map(s => <Bar key={s.key} dataKey={s.key} stackId="a" fill={`var(--color-${s.key})`} />)}
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
};

const tallyRows = (entries: [string, number][]) => entries.filter(([, n]) => n > 0).map(([name, count]) => ({ name, count }));
const COUNT_SERIES = [{ key: 'count', label: 'Count', color: 'hsl(var(--chart-1))' }];

/** The breakdowns that fit the goal type, over the sessions in the date range. */
const GoalBreakdowns: React.FC<{ goal: Goal; recorded: Recorded[] }> = ({ goal, recorded }) => {
  const type = captureTypeOf(goal);
  const panels: React.ReactNode[] = [];
  const data = recorded.map(r => r.data);
  const sum = (get: (d: Record<string, any>) => number) => data.reduce((total, d) => total + get(d), 0);

  if (type === 'STORY_ELEMENTS') {
    panels.push(
      <HBars key="parts" title="Average score by story part (0-2)" max={2} series={[{ key: 'average', label: 'Average score', color: 'hsl(var(--chart-2))' }]}
        rows={STORY_PARTS.flatMap(p => {
          const average = averageStoryPart(data, p.key);
          return average === null ? [] : [{ name: p.label as string, average: round(average) }];
        })} />,
      <HBars key="words" title="Linking words" series={COUNT_SERIES}
        rows={tallyRows(STORY_LINKING_WORDS.map(w => [w, sum(d => Number(d[linkingWordField(w)]) || 0)]))} />,
    );
  }
  if (type === 'COMMUNICATION_FUNCTIONS') {
    const rows = COMMUNICATION_FUNCTIONS
      .map(f => ({
        name: f.label,
        spontaneous: sum(d => Math.max(0, Number(d[`${f.key}Spontaneous`]) || 0)),
        emerging: sum(d => Math.max(0, Number(d[`${f.key}Emerging`]) || 0)),
        prompted: sum(d => Math.max(0, Number(d[`${f.key}Prompted`]) || 0)),
      }))
      .filter(r => r.spontaneous + r.emerging + r.prompted > 0);
    const hasEmerging = rows.some(r => r.emerging > 0);
    const series = [
      { key: 'spontaneous', label: 'Spontaneous', color: 'hsl(var(--comm-spontaneous))' },
      ...(hasEmerging ? [{ key: 'emerging', label: 'Emerging', color: 'hsl(var(--comm-emerging))' }] : []),
      { key: 'prompted', label: 'Prompted', color: 'hsl(var(--comm-prompted))' },
    ];
    panels.push(
      <HBars key="functions" title="Uses by function" series={series} rows={rows} unit={['use', 'uses']} />,
    );
  }
  if (type === 'TASK_ANALYSIS') {
    // Each step across the sessions: done independently, with a prompt, or not done (by the step's name).
    const byStep = new Map<string, { independent: number; prompted: number; notDone: number }>();
    data.forEach(d => (Array.isArray(d.steps) ? d.steps as TaskStepScore[] : []).forEach(s => {
      if (!s?.level) return;
      const row = byStep.get(s.label) ?? { independent: 0, prompted: 0, notDone: 0 };
      if (s.level === 'Independent') row.independent++; else if (s.level === 'NotDone') row.notDone++; else row.prompted++;
      byStep.set(s.label, row);
    }));
    panels.push(
      <div key="steps" className="md:col-span-3">
        <HBars title="Steps (sessions)" series={[
          { key: 'independent', label: 'Independent', color: 'hsl(var(--chart-2))' },
          { key: 'prompted', label: 'Prompted', color: 'hsl(var(--chart-4))' },
          { key: 'notDone', label: 'Not done', color: 'hsl(var(--chart-1))' },
        ]} rows={[...byStep.entries()].map(([name, r]) => ({ name, ...r }))} />
      </div>,
    );
  }
  if (type === 'FLUENCY_SYLLABLE_STUTTER') {
    panels.push(
      <HBars key="dysfluency" title="Dysfluency types" series={COUNT_SERIES}
        rows={tallyRows((['blocks', 'repetitions', 'prolongations', 'interjections'] as const)
          .map(k => [k.charAt(0).toUpperCase() + k.slice(1), sum(d => Number(d[k]) || 0)]))} />,
    );
  }
  if (type === 'GOAL_ATTAINMENT_SCALE') {
    // All five levels, including zeros, so the distribution is visible at a glance, highest first like the line
    // chart. The rows are named by level only: the key under the line chart says what each level means for this goal.
    panels.push(
      <HBars key="gas-levels" title="Sessions at each attainment level" series={COUNT_SERIES} labelWidth={36}
        rows={[...GAS_LEVELS].reverse().map(level => ({
          name: level > 0 ? `+${level}` : String(level),
          count: recorded.filter(r => r.value === level).length,
        }))} />,
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

const GoalChartCard: React.FC<{ goal: Goal; sessions: SessionData[]; studentName?: string; studentIep?: StudentIep }> = ({ goal, sessions, studentName, studentIep }) => {
  const info = goalMeasureInfo(goal);
  const type = captureTypeOf(goal);
  const direction = goalDirection(goal);
  const target = goal.sessionTargetValue;
  const recorded = useMemo(() => recordedSessions(goal, sessions), [goal, sessions]);
  const behaviorRecorded = useMemo(() => recordedSessions(goal, sessions, true), [goal, sessions]);
  // The GAS axis shows just the level (+2 … -2): words don't fit beside the chart on a tablet and wrapped
  // onto each other. What each level means for this goal is listed in a key under the chart.
  const gasTick = (level: number) => (level > 0 ? `+${level}` : String(level));

  // The aim line (baseline to target by the target date), as the value expected on each session's date.
  const isCommFunctions = type === 'COMMUNICATION_FUNCTIONS';
  const aim = aimLine(goal, recorded[0]?.session.date);
  const points = recorded.map(r => {
    const comm = isCommFunctions ? summarizeCommunicationFunctions(r.data) : null;
    return {
      label: r.label, value: r.value, ...(goalResponses(type, r.data) ?? {}),
      ...(comm ? {
        spontaneousFunctions: comm.functionsUsedSpontaneously,
        emergingFunctions: comm.functionsUsedEmergingOnly,
        spontaneousUses: comm.spontaneous,
        emergingUses: comm.emerging,
        promptedUses: comm.prompted,
      } : {}),
      ...(aim ? { aim: round(aimValueAt(aim, r.session.date)) } : {}),
    };
  });
  const onTrack = aimStatus(goal, aim, recorded.map(r => ({ date: r.session.date, value: r.value })));
  const mastery = masterySessions(goal);
  const hasResponses = goalResponses(type) !== null && points.length > 0;
  const hasCommUsesChart = isCommFunctions && points.length > 0;
  const isLatency = toolTypeOf(type) === 'BEHAVIOR_LATENCY';
  const allSessions = isLatency ? behaviorRecorded : recorded;
  const latestUnanswered = isLatency && allSessions.length > 0 && Number.isNaN(allSessions[allSessions.length - 1].value);
  const values = recorded.map(r => r.value);
  const average = values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const metCount = target === undefined ? null : allSessions.filter(r => !Number.isNaN(r.value) && sessionMeetsTarget(goal, r.data, target)).length;
  // GAS levels run -2 to +2, so the card's Y scale must span the negative domain; every other
  // type keeps its [0, yMax] scale. The bottom comes from GoalMeasureInfo.min (Track A).
  const isGas = type === 'GOAL_ATTAINMENT_SCALE';
  const yMax = info.max ?? Math.ceil(Math.max(...values, target ?? 0, aim?.start.value ?? 0, aim?.end.value ?? 0, 1) * 1.1);
  const notes = allSessions.map(r => ({ date: r.session.date, text: goalNotes(r.data) })).filter(n => n.text).slice(-3).reverse();
  const storyWords = type === 'STORY_ELEMENTS' ? recorded.reduce((total, r) => total + scoreStory(r.data).linkingWords, 0) : null;
  const lineChartConfig: ChartConfig = isCommFunctions
    ? {
        value: { label: 'Without a prompt (total)', color: 'hsl(var(--primary))' },
        spontaneousFunctions: { label: 'Spontaneous', color: 'hsl(var(--comm-spontaneous))' },
        emergingFunctions: { label: 'Emerging only', color: 'hsl(var(--comm-emerging))' },
        aim: { label: 'Aim line', color: 'hsl(var(--muted-foreground))' },
      }
    : {
        value: { label: info.label, color: 'hsl(var(--primary))' },
        aim: { label: 'Aim line', color: 'hsl(var(--chart-2))' },
      };

  // How each figure is worked out, shown when it is tapped or hovered.
  const explain = goalStatExplanations(goal, recorded.map(r => ({ date: r.session.date, value: r.value, data: r.data })), aim, mastery, allSessions.length);
  const latestValue = latestUnanswered ? 'No response' : values.length ? `${values[values.length - 1]}${info.unit}` : '—';
  const stats = [
    { label: 'Sessions with data', value: String(allSessions.length), explanation: explain.sessions },
    { label: 'Latest', value: latestValue, explanation: allSessions.length ? explain.latest : undefined },
    { label: 'Average', value: average === null ? '—' : `${average}${info.unit}`, explanation: average === null ? undefined : explain.average },
    ...(metCount === null ? [] : [{ label: 'Met target', value: allSessions.length ? `${metCount} of ${allSessions.length}` : '—', explanation: allSessions.length ? explain.metTarget : undefined }]),
    ...(onTrack ? [{ label: 'Aim line', value: AIM_STATUS_LABELS[onTrack], explanation: explain.aimLine }] : []),
  ];
  // Mastered: the target met in the last `mastery` sessions in a row (including unanswered latency sessions, which break the streak).
  const mastered =
    target !== undefined &&
    allSessions.length >= mastery &&
    allSessions.slice(-mastery).every(r => !Number.isNaN(r.value) && sessionMeetsTarget(goal, r.data, target));

  return (
    <Card id={goalCardId(goal.id)} className="lg:col-span-2 scroll-mt-20">
      <CardHeader>
        <CardTitle><ExpandableGoalName goal={goal} studentName={studentName} studentIep={studentIep} /></CardTitle>
        <CardDescription>
          {goalTypeLabel(goal)} · {info.label} per session
          {target !== undefined && ` · Target ${formatGoalTarget(goal, target, goal.targetDirection, goal.sessionTargetUses)}`}
          {storyWords !== null && ` · ${storyWords} linking words`}
          {target !== undefined && ` · Mastery: ${mastery} in a row`}
          {mastered && <span className="ml-2 inline-block rounded-full border border-green-500/50 bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">Mastered</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid grid-cols-2 gap-2 text-center ${stats.length > 4 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
          {stats.map(stat => (
            <StatTile key={stat.label} label={stat.label} value={stat.value} explanation={stat.explanation} className="p-2" valueClassName="text-lg" />
          ))}
        </div>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {allSessions.length > 0
              ? 'Trials were recorded in the selected date range, but there were no responses with a time to chart.'
              : 'No data recorded for this goal in the selected date range.'}
          </p>
        ) : (
          <div className={hasResponses || hasCommUsesChart ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
            <div>
              {isCommFunctions && <p className="text-sm font-medium mb-1">Functions per session</p>}
              <div className={isCommFunctions ? 'h-[260px] w-full' : 'h-[240px] w-full'}>
                <ChartContainer config={lineChartConfig} className="h-full w-full">
                  <LineChart data={points} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis domain={[info.min ?? 0, yMax]} unit={info.unit === '%' ? '%' : undefined} tickLine={false} axisLine={false} tickMargin={8}
                      ticks={isGas ? [...GAS_LEVELS] : (info.max !== undefined && info.max <= 10 ? Array.from({ length: info.max + 1 }, (_, i) => i) : undefined)}
                      tickFormatter={isGas ? gasTick : undefined}
                      allowDecimals={toolTypeOf(type) === 'BEHAVIOR_DURATION' || toolTypeOf(type) === 'BEHAVIOR_LATENCY'} />
                    {isGas ? (
                      <ChartTooltip
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload?.length) return null;
                          const value = payload[0].payload.value as number;
                          return (
                            <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                              <p className="font-medium">{label}</p>
                              <p>{gasLevelText(goal, value)}</p>
                            </div>
                          );
                        }}
                      />
                    ) : (
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            formatter={isCommFunctions ? unitTooltipFormatter(lineChartConfig, 'function', 'functions') : undefined}
                          />
                        }
                      />
                    )}
                    {isCommFunctions && <ChartLegend content={<ChartLegendContent />} />}
                    {isGas ? (
                      <ReferenceLine y={0} stroke="hsl(var(--chart-5))" strokeDasharray="6 4"
                        label={{ value: 'Expected', position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    ) : target !== undefined && (
                      <ReferenceLine y={target} stroke="hsl(var(--chart-5))" strokeDasharray="6 4"
                        label={{ value: direction === 'decrease' ? 'Target (max)' : 'Target', position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    )}
                    {/* GAS levels are steps (-2 … +2), so they are joined with straight lines: a curve would suggest levels in between. */}
                    <Line type={isGas ? 'linear' : 'monotone'} dataKey="value" stroke="var(--color-value)" strokeWidth={isCommFunctions ? 2.5 : 2} dot={true} />
                    {isCommFunctions && <Line type="monotone" dataKey="spontaneousFunctions" stroke="var(--color-spontaneousFunctions)" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />}
                    {isCommFunctions && <Line type="monotone" dataKey="emergingFunctions" stroke="var(--color-emergingFunctions)" strokeWidth={2} strokeDasharray="2 3" dot={{ r: 3 }} />}
                    {aim && <Line type="linear" dataKey="aim" stroke="var(--color-aim)" strokeWidth={1.5} strokeDasharray="2 3" dot={false} />}
                  </LineChart>
                </ChartContainer>
              </div>
            </div>
            {isGas && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs" aria-label="What each level means">
                {[...GAS_LEVELS].reverse().map(level => (
                  <React.Fragment key={level}>
                    <dt className="font-semibold tabular-nums text-right">{gasTick(level)}</dt>
                    <dd className="text-muted-foreground">{gasLevelDescription(goal, level)}</dd>
                  </React.Fragment>
                ))}
              </dl>
            )}
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
            {hasCommUsesChart && (
              <div>
                <p className="text-sm font-medium mb-1">Uses per session</p>
                <div className="h-[260px] w-full">
                  <ChartContainer config={COMM_USES_CONFIG} className="h-full w-full">
                    <BarChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent formatter={unitTooltipFormatter(COMM_USES_CONFIG, 'use', 'uses')} />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="spontaneousUses" stackId="u" fill="var(--color-spontaneousUses)" />
                      <Bar dataKey="emergingUses" stackId="u" fill="var(--color-emergingUses)" />
                      <Bar dataKey="promptedUses" stackId="u" fill="var(--color-promptedUses)" />
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            )}
          </div>
        )}
        {recorded.length > 0 && <GoalBreakdowns goal={goal} recorded={recorded} />}
        {behaviorRecorded.length > 0 && BEHAVIOR_GOAL_TYPES.includes(toolTypeOf(type)) && <BehaviorTimeCharts type={type} recorded={behaviorRecorded} />}
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

const GoalCharts: React.FC<GoalChartsProps> = ({ studentSessions, goals, studentName, studentIep }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {goals.map(goal => <GoalChartCard key={goal.id} goal={goal} sessions={studentSessions} studentName={studentName} studentIep={studentIep} />)}
  </div>
);

export default GoalCharts;
