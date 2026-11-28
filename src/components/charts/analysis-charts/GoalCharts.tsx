'use client';

import React, { useMemo, useState } from 'react';
import { BarChart3, Check, Table2, TrendingUp } from 'lucide-react';
import type { Goal, SessionData, StudentIep } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ReferenceLine, BarChart, Bar, ComposedChart, Cell } from 'recharts';
import { customChartShown, customChartStyle } from '@/lib/goal-types/custom';
import {
  BEHAVIOR_GOAL_TYPES, commFunctionsFor, captureTypeOf, measuresCommUses, toolTypeOf, goalDirection, summarizeAbc, scoreStory, averageStoryPart, STORY_PARTS, STORY_LINKING_WORDS, linkingWordField,
  type AbcIncident,
} from '@/lib/goal-constants';
import { goalMeasureInfo, goalResponses, goalNotes, sessionMeetsTarget, promptTotals, usesPromptCounters } from '@/lib/goal-measures';
import { formatDate, formatGoalTarget, goalTypeLabel } from '@/lib/helpers';
import { collectRecordedGoalSessions, groupGoalPoints, type RecordedGoalSession } from '@/lib/report-chart-views';
import { goalCardId, readGoalChartView, type GoalChartView, type TimeGrouping } from '@/lib/report-filters';
import BehaviorTimeCharts from './BehaviorTimeCharts';
import { ItemMasteryCharts, LanguageSampleCharts } from './LanguageItemCharts';
import { CommFunctionsBySession } from './CommFunctionsBySession';
import StatTile from './StatTile';
import { goalStatExplanations } from '@/lib/report-formulas';
import type { TaskStepScore } from '@/lib/task-analysis';
import { AIM_STATUS_LABELS, aimLine, aimStatus, masterySessions } from '@/lib/aim-line';
import ExpandableGoalName from './ExpandableGoalName';
import { gasLevelDescription, gasLevelLabel, gasLevelText } from '@/lib/gas';
import ViewModeToggle from './ViewModeToggle';

// A report card for each goal: its measure per session (or week/month) against the target, switchable between
// Line, Bars, and Table views, plus summary numbers and breakdowns that fit the goal type.

interface GoalChartsProps {
  studentSessions: SessionData[]; // oldest first
  goals: Goal[];
  studentName?: string;
  studentIep?: StudentIep;
  grouping?: TimeGrouping;
  defaultView?: GoalChartView;
  onViewChange?: (view: GoalChartView) => void;
}

const round = (n: number) => Math.round(n * 10) / 10;
const PROMPT_LABELS: Record<string, string> = { PartialPhysical: 'Partial physical' };

const GAS_LEVELS = [-2, -1, 0, 1, 2] as const;

export type Recorded = RecordedGoalSession;

/**
 * The sessions where something was recorded for the goal, with its measure and a chart label.
 */
export function recordedSessions(goal: Goal, sessions: SessionData[], unanswered = false): Recorded[] {
  return collectRecordedGoalSessions(goal, sessions, unanswered);
}

/** Horizontal bars, one row per item, optionally stacked from several series. */
const HBAR_LABEL_WIDTH = 150;
const HBAR_LABEL_CHARS = 24;

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
  labelWidth?: number;
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
    const rows = commFunctionsFor(data)
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
      <CommFunctionsBySession key="by-session" recorded={recorded} />,
    );
  }
  if (type === 'TASK_ANALYSIS') {
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
  if (type === 'LANGUAGE_SAMPLE') {
    panels.push(<LanguageSampleCharts key="language-sample" goal={goal} recorded={recorded} />);
  }
  if (type === 'ITEM_MASTERY') {
    panels.push(<ItemMasteryCharts key="item-mastery" goal={goal} recorded={recorded} />);
  }
  const ct = type === 'CUSTOM' ? goal.customType : undefined;
  if (ct?.kind === 'utterances') {
    const unit = ct.utterances?.unit === 'morphemes' ? 'morphemes' : 'words';
    panels.push(<LanguageSampleCharts key="custom-utterances" goal={{ ...goal, sampleUnit: unit }} recorded={recorded}
      showLengths={customChartShown(ct, 'utterance-lengths')} showSample={customChartShown(ct, 'utterance-sample')} />);
  }
  if (ct?.kind === 'checklist' && customChartShown(ct, 'step-completion')) {
    const steps = ct.checklist?.steps?.length ? ct.checklist.steps : ['Step 1'];
    panels.push(
      <div key="custom-steps" className="md:col-span-2">
        <HBars title="Steps completed (sessions)" series={COUNT_SERIES} unit={['session', 'sessions']}
          rows={steps.map((name, i) => ({ name, count: data.filter(d => Array.isArray(d.steps) && d.steps[i] === true).length }))} />
      </div>,
    );
  }
  if (ct?.kind === 'rating' && customChartShown(ct, 'rating-levels')) {
    const min = ct.rating?.min ?? 1;
    const max = ct.rating?.max ?? 5;
    const levels = Array.from({ length: max - min + 1 }, (_, i) => max - i);
    panels.push(
      <HBars key="custom-levels" title="Sessions at each level" series={COUNT_SERIES} labelWidth={110} unit={['session', 'sessions']}
        rows={levels.map(level => {
          const label = ct.rating?.levelLabels?.[level - min];
          return { name: label ? `${level} ${label}` : String(level), count: recorded.filter(r => r.value === level).length };
        })} />,
    );
  }
  if (ct?.kind === 'yesno' && customChartShown(ct, 'yesno-sessions')) {
    panels.push(
      <HBars key="custom-yesno" title="Sessions answered" series={COUNT_SERIES} labelWidth={60} unit={['session', 'sessions']}
        rows={[{ name: 'Yes', count: data.filter(d => d.met === true).length }, { name: 'No', count: data.filter(d => d.met === false).length }]} />,
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
  if (usesPromptCounters(goal) && (!ct || customChartShown(ct, 'prompts'))) {
    const totals = promptTotals();
    data.forEach(d => Object.entries(promptTotals(d)).forEach(([k, v]) => { totals[k] += v; }));
    const rows = tallyRows(Object.entries(totals).map(([k, v]) => [PROMPT_LABELS[k] ?? k, v]));
    if (rows.length > 0) panels.push(<HBars key="prompts" title="Prompt levels" series={COUNT_SERIES} rows={rows} />);
  }
  if (panels.length === 0) return null;
  return <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{panels}</div>;
};

const PERIOD_UNIT_LABEL: Record<TimeGrouping, string> = {
  session: 'per session',
  week: 'weekly average',
  month: 'monthly average',
};

const GoalChartCard: React.FC<{
  goal: Goal;
  sessions: SessionData[];
  studentName?: string;
  studentIep?: StudentIep;
  grouping: TimeGrouping;
  defaultView: GoalChartView;
  onViewChange?: (view: GoalChartView) => void;
}> = ({ goal, sessions, studentName, studentIep, grouping, defaultView, onViewChange }) => {
  const info = goalMeasureInfo(goal);
  const type = captureTypeOf(goal);
  const direction = goalDirection(goal);
  const target = goal.sessionTargetValue;
  const recorded = useMemo(() => recordedSessions(goal, sessions), [goal, sessions]);
  const behaviorRecorded = useMemo(() => recordedSessions(goal, sessions, true), [goal, sessions]);
  const gasTick = (level: number) => (level > 0 ? `+${level}` : String(level));

  const customPrefersBar = type === 'CUSTOM' && customChartStyle(goal.customType) === 'bar';
  const [localView, setLocalView] = useState<GoalChartView>(() => (customPrefersBar ? 'bar' : (defaultView !== 'line' ? defaultView : readGoalChartView())));
  const activeView: GoalChartView = localView;

  const handleSelectView = (next: GoalChartView) => {
    setLocalView(next);
    // Don't let clicking 'bar' on a custom bar-style goal overwrite the global default for other goals.
    if (!customPrefersBar || next !== 'bar') onViewChange?.(next);
  };

  const isCommFunctions = type === 'COMMUNICATION_FUNCTIONS';
  // A Communication Functions goal measured by total uses: the main line counts uses, not different functions.
  const commByUses = isCommFunctions && measuresCommUses(goal);
  const aim = aimLine(goal, recorded[0]?.session.date);
  const points = useMemo(() => groupGoalPoints(goal, recorded, grouping, aim), [goal, recorded, grouping, aim]);

  const onTrack = aimStatus(goal, aim, recorded.map(r => ({ date: r.session.date, value: r.value })));
  const mastery = masterySessions(goal);
  const hasResponses = goalResponses(goal) !== null && points.length > 0 && (type !== 'CUSTOM' || !goal.customType || customChartShown(goal.customType, 'responses'));
  const asBars = activeView === 'bar';
  const ProgressChart = asBars ? ComposedChart : LineChart;
  const hasCommUsesChart = isCommFunctions && points.length > 0;
  const isLatency = toolTypeOf(type) === 'BEHAVIOR_LATENCY';
  const allSessions = isLatency ? behaviorRecorded : recorded;
  const latestUnanswered = isLatency && allSessions.length > 0 && Number.isNaN(allSessions[allSessions.length - 1].value);
  const values = recorded.map(r => r.value);
  const average = values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const metCount = target === undefined ? null : allSessions.filter(r => !Number.isNaN(r.value) && sessionMeetsTarget(goal, r.data, target)).length;
  const isGas = type === 'GOAL_ATTAINMENT_SCALE';
  const yMax = info.max ?? Math.ceil(Math.max(...values, ...points.map(p => p.value), target ?? 0, aim?.start.value ?? 0, aim?.end.value ?? 0, 1) * 1.1);
  const notes = allSessions.map(r => ({ date: r.session.date, text: goalNotes(r.data) })).filter(n => n.text).slice(-3).reverse();
  const storyWords = type === 'STORY_ELEMENTS' ? recorded.reduce((total, r) => total + scoreStory(r.data).linkingWords, 0) : null;

  const lineChartConfig: ChartConfig = isCommFunctions
    ? {
        value: { label: 'Without a prompt (total)', color: 'hsl(var(--primary))' },
        spontaneousFunctions: { label: 'Spontaneous', color: 'hsl(var(--comm-spontaneous))' },
        emergingFunctions: { label: commByUses ? 'Emerging' : 'Emerging only', color: 'hsl(var(--comm-emerging))' },
        aim: { label: 'Aim line', color: 'hsl(var(--muted-foreground))' },
      }
    : {
        value: { label: info.label, color: 'hsl(var(--primary))' },
        aim: { label: 'Aim line', color: 'hsl(var(--chart-2))' },
      };

  const explain = goalStatExplanations(goal, recorded.map(r => ({ date: r.session.date, value: r.value, data: r.data })), aim, mastery, allSessions.length);
  const latestValue = latestUnanswered ? 'No response' : values.length ? `${values[values.length - 1]}${info.unit}` : '—';
  const stats = [
    { label: 'Sessions with data', value: String(allSessions.length), explanation: explain.sessions },
    { label: 'Latest', value: latestValue, explanation: allSessions.length ? explain.latest : undefined },
    { label: 'Average', value: average === null ? '—' : `${average}${info.unit}`, explanation: average === null ? undefined : explain.average },
    ...(metCount === null ? [] : [{ label: 'Met target', value: allSessions.length ? `${metCount} of ${allSessions.length}` : '—', explanation: allSessions.length ? explain.metTarget : undefined }]),
    ...(onTrack ? [{ label: 'Aim line', value: AIM_STATUS_LABELS[onTrack], explanation: explain.aimLine }] : []),
  ];
  const mastered =
    target !== undefined &&
    allSessions.length >= mastery &&
    allSessions.slice(-mastery).every(r => !Number.isNaN(r.value) && sessionMeetsTarget(goal, r.data, target));

  const formatCellValue = (val: number) => {
    if (isGas) return Number.isInteger(val) ? gasLevelText(goal, val) : gasLevelLabel(val);
    return `${val}${info.unit}`;
  };

  const hasAnyTablePrompts = points.some(p => Boolean(p.promptsSummary));
  const hasAnyTableNotes = points.some(p => Boolean(p.notes));

  return (
    <Card id={goalCardId(goal.id)} className="lg:col-span-2 scroll-mt-20">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle><ExpandableGoalName goal={goal} studentName={studentName} studentIep={studentIep} /></CardTitle>
            <CardDescription className="mt-1">
              {goalTypeLabel(goal)} · {info.label} ({PERIOD_UNIT_LABEL[grouping]})
              {target !== undefined && ` · Target ${formatGoalTarget(goal, target, goal.targetDirection, goal.sessionTargetUses)}`}
              {storyWords !== null && ` · ${storyWords} linking words`}
              {target !== undefined && ` · Mastery: ${mastery} in a row`}
              {mastered && <span className="ml-2 inline-block rounded-full border border-green-500/50 bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">Mastered</span>}
            </CardDescription>
          </div>
          {points.length > 0 && (
            <ViewModeToggle
              label={`View mode for ${goal.name}`}
              value={activeView}
              onChange={handleSelectView}
              options={[
                { value: 'line', label: 'Line', icon: <TrendingUp className="h-3.5 w-3.5" aria-hidden /> },
                { value: 'bar', label: 'Bars', icon: <BarChart3 className="h-3.5 w-3.5" aria-hidden /> },
                { value: 'table', label: 'Table', icon: <Table2 className="h-3.5 w-3.5" aria-hidden /> },
              ]}
            />
          )}
        </div>
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
        ) : activeView === 'table' ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {grouping === 'session'
                ? 'Exact figures recorded in each session, oldest to newest.'
                : `Figures grouped ${grouping === 'week' ? 'by week' : 'by month'} (average ${info.label.toLowerCase()} and pooled counts).`}
            </p>
            <div className="max-h-[360px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{grouping === 'session' ? 'Session' : grouping === 'week' ? 'Week' : 'Month'}</TableHead>
                    <TableHead>{info.label}</TableHead>
                    {target !== undefined && <TableHead>Target</TableHead>}
                    {hasResponses && <TableHead>Responses</TableHead>}
                    {hasAnyTablePrompts && <TableHead>Prompts</TableHead>}
                    {hasAnyTableNotes && <TableHead>Notes</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {points.map((pt, idx) => (
                    <TableRow key={`${pt.label}-${idx}`}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {pt.fullLabel}
                        {grouping !== 'session' && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {pt.sessionCount} {pt.sessionCount === 1 ? 'session' : 'sessions'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums font-medium">{formatCellValue(pt.value)}</TableCell>
                      {target !== undefined && (
                        <TableCell>
                          {grouping !== 'session' ? (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {pt.metCount} of {pt.sessionCount} met
                            </span>
                          ) : pt.metTarget ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                              <Check className="h-3 w-3" aria-hidden /> Met
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not met</span>
                          )}
                        </TableCell>
                      )}
                      {hasResponses && (
                        <TableCell className="text-xs tabular-nums">
                          {pt.opportunities ? (
                            <>
                              <span className="font-medium text-foreground">{pt.correct ?? 0}/{pt.opportunities}</span>
                              <span className="text-muted-foreground">
                                {pt.approximate ? ` · ${pt.approximate} approx` : ''}
                                {pt.incorrect ? ` · ${pt.incorrect} err` : ''}
                              </span>
                            </>
                          ) : '—'}
                        </TableCell>
                      )}
                      {hasAnyTablePrompts && (
                        <TableCell className="text-xs text-muted-foreground">{pt.promptsSummary || '—'}</TableCell>
                      )}
                      {hasAnyTableNotes && (
                        <TableCell className="max-w-xs text-xs text-muted-foreground">{pt.notes || '—'}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className={hasResponses || hasCommUsesChart ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
            <div>
              {isCommFunctions && <p className="text-sm font-medium mb-1">{commByUses ? 'Uses without a prompt, all functions' : 'Functions'} ({PERIOD_UNIT_LABEL[grouping]})</p>}
              {asBars && target !== undefined && !isGas && (
                <p className="mb-1 text-xs text-muted-foreground">
                  Green bars met the target ({formatGoalTarget(goal, target, goal.targetDirection, goal.sessionTargetUses)}).
                </p>
              )}
              <div className={isCommFunctions ? 'h-[260px] w-full' : 'h-[240px] w-full'}>
                <ChartContainer config={lineChartConfig} className="h-full w-full">
                  <ProgressChart data={points} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={!asBars} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis domain={[info.min ?? 0, yMax]} unit={info.unit === '%' ? '%' : undefined} tickLine={false} axisLine={false} tickMargin={8}
                      ticks={isGas ? [...GAS_LEVELS] : (info.max !== undefined && info.max <= 10 ? Array.from({ length: info.max + 1 }, (_, i) => i) : undefined)}
                      tickFormatter={isGas ? gasTick : undefined}
                      allowDecimals={grouping !== 'session' || toolTypeOf(type) === 'BEHAVIOR_DURATION' || toolTypeOf(type) === 'BEHAVIOR_LATENCY' || type === 'LANGUAGE_SAMPLE'} />
                    {isGas ? (
                      <ChartTooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0].payload as { fullLabel: string; value: number; sessionCount: number };
                          return (
                            <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                              <p className="font-medium">
                                {row.fullLabel}
                                {grouping !== 'session' ? ` (${row.sessionCount} ${row.sessionCount === 1 ? 'session' : 'sessions'})` : ''}
                              </p>
                              <p>{Number.isInteger(row.value) ? gasLevelText(goal, row.value) : `Average level: ${gasLevelLabel(row.value)}`}</p>
                            </div>
                          );
                        }}
                      />
                    ) : (
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            indicator={asBars ? 'dot' : 'line'}
                            labelFormatter={(_, payload) => {
                              const row = payload?.[0]?.payload as { fullLabel?: string; sessionCount?: number; metCount?: number } | undefined;
                              if (!row?.fullLabel) return '';
                              if (grouping !== 'session' && row.sessionCount) {
                                return `${row.fullLabel} · ${row.sessionCount} ${row.sessionCount === 1 ? 'session' : 'sessions'}`;
                              }
                              return row.fullLabel;
                            }}
                            formatter={isCommFunctions ? (commByUses ? unitTooltipFormatter(lineChartConfig, 'use', 'uses') : unitTooltipFormatter(lineChartConfig, 'function', 'functions')) : undefined}
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
                    {asBars ? (
                      <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        {points.map((pt, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            fill={pt.metTarget === true ? 'hsl(var(--chart-2))' : 'var(--color-value)'}
                          />
                        ))}
                      </Bar>
                    ) : (
                      <Line type={isGas ? 'linear' : 'monotone'} dataKey="value" stroke="var(--color-value)" strokeWidth={isCommFunctions ? 2.5 : 2} dot={true} />
                    )}
                    {isCommFunctions && <Line type="monotone" dataKey="spontaneousFunctions" stroke="var(--color-spontaneousFunctions)" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />}
                    {isCommFunctions && <Line type="monotone" dataKey="emergingFunctions" stroke="var(--color-emergingFunctions)" strokeWidth={2} strokeDasharray="2 3" dot={{ r: 3 }} />}
                    {aim && <Line type="linear" dataKey="aim" stroke="var(--color-aim)" strokeWidth={1.5} strokeDasharray="2 3" dot={false} />}
                  </ProgressChart>
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
              <div>
                <p className="text-sm font-medium mb-1">
                  {grouping === 'session' ? 'Responses per session' : grouping === 'week' ? 'Responses per week' : 'Responses per month'}
                </p>
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
              </div>
            )}
            {hasCommUsesChart && (
              <div>
                <p className="text-sm font-medium mb-1">
                  {grouping === 'session' ? 'Uses per session' : grouping === 'week' ? 'Uses per week' : 'Uses per month'}
                </p>
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
        {activeView !== 'table' && notes.length > 0 && (
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

const GoalCharts: React.FC<GoalChartsProps> = ({
  studentSessions,
  goals,
  studentName,
  studentIep,
  grouping = 'session',
  defaultView = 'line',
  onViewChange,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {goals.map(goal => (
      <GoalChartCard
        key={goal.id}
        goal={goal}
        sessions={studentSessions}
        studentName={studentName}
        studentIep={studentIep}
        grouping={grouping}
        defaultView={defaultView}
        onViewChange={onViewChange}
      />
    ))}
  </div>
);

export default GoalCharts;
