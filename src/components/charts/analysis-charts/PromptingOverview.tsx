'use client';

import React, { useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, HandHelping, Layers, Percent, Sparkles, TrendingUp } from 'lucide-react';
import type { Goal, PromptType, SessionData } from '@/lib/types';
import { buildPromptSummary, PROMPT_DISPLAY_LABELS, type CombinedChartRow } from '@/lib/report-chart-views';
import type { TimeGrouping } from '@/lib/report-filters';
import { PROMPT_COLORS, PROMPT_TYPES } from '@/lib/promptConstants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import StatTile from './StatTile';
import ViewModeToggle from './ViewModeToggle';

interface PromptingOverviewProps {
  studentSessions: SessionData[];
  activeStudentGoals: Goal[];
  selectedGoalId?: string;
  chartData: CombinedChartRow[];
  grouping: TimeGrouping;
}

type FadingChartMode = 'stacked' | 'rate';
type BreakdownMode = 'by-type' | 'by-session';

const PROMPT_STACK_CONFIG: ChartConfig = Object.fromEntries(
  PROMPT_TYPES.map(pt => [pt, { label: PROMPT_DISPLAY_LABELS[pt], color: PROMPT_COLORS[pt] }]),
);

const INDEPENDENCE_LINE_CONFIG: ChartConfig = {
  independenceRate: { label: 'Independent (%)', color: 'hsl(var(--primary))' },
};

const PromptingOverview: React.FC<PromptingOverviewProps> = ({
  studentSessions,
  activeStudentGoals,
  selectedGoalId,
  chartData,
  grouping,
}) => {
  const [fadingMode, setFadingMode] = useState<FadingChartMode>('stacked');
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>('by-type');

  const summary = useMemo(
    () => buildPromptSummary(studentSessions, activeStudentGoals, selectedGoalId),
    [studentSessions, activeStudentGoals, selectedGoalId],
  );

  const usedPromptTypes = useMemo(
    () => PROMPT_TYPES.filter(pt => summary.levels.some(l => l.key === pt && l.count > 0)),
    [summary.levels],
  );

  const fadingRows = useMemo(
    () => chartData.filter(r => r.totalPromptTallies > 0),
    [chartData],
  );

  if (summary.promptCapableGoalCount === 0 && summary.totalTallied === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandHelping className="h-5 w-5 text-primary" aria-hidden />
            Prompting &amp; Independence
          </CardTitle>
          <CardDescription>
            {selectedGoalId
              ? 'The selected goal uses its own specialized scoring rather than general prompt-level tallies.'
              : 'None of the active goals in view use general prompt-level counters.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Goals such as Communication Functions, Task Analysis, Story Elements, GAS, and Behavior report their own support or context breakdowns directly on their card under <strong>Goal Progress</strong>.
        </CardContent>
      </Card>
    );
  }

  const periodNoun = grouping === 'session' ? 'session' : grouping === 'week' ? 'week' : 'month';
  const promptBreakdownText = summary.levels
    .filter(l => !l.isIndependent && l.count > 0)
    .map(l => `${l.label} ${l.count}`)
    .join(', ');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Support &amp; Independence Summary</CardTitle>
          <CardDescription>
            Overview of independent versus prompted responses across prompt-tracking goals in the selected dates. Tap any figure to see how it is calculated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Independence Rate"
              value={summary.independenceRate !== null ? `${summary.independenceRate}%` : '—'}
              icon={<Percent className="mb-1.5 h-5 w-5 text-primary" aria-hidden />}
              className="p-3"
              valueClassName="text-2xl"
              explanation={
                summary.totalTallied > 0
                  ? `Independent responses ÷ all tallied prompt levels × 100 = ${summary.totalIndependent} ÷ ${summary.totalTallied} × 100 = ${summary.independenceRate}%.`
                  : 'No prompt-level buttons (Independent, Visual, Verbal, Gestural, Partial physical, Imitation) were tallied in this date range.'
              }
            />
            <StatTile
              label="Independent Tally"
              value={summary.totalIndependent}
              icon={<Sparkles className="mb-1.5 h-5 w-5 text-green-600 dark:text-green-400" aria-hidden />}
              className="p-3"
              valueClassName="text-2xl"
              explanation="Total times the Independent counter was tapped during sessions in this range."
            />
            <StatTile
              label="Prompted Tally"
              value={summary.totalPrompted}
              icon={<HandHelping className="mb-1.5 h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />}
              className="p-3"
              valueClassName="text-2xl"
              explanation={
                summary.totalPrompted > 0
                  ? `Total non-independent cues tallied (${promptBreakdownText}).${summary.mostUsedPrompt ? ` Most frequent cue: ${summary.mostUsedPrompt.label} (${summary.mostUsedPrompt.count}).` : ''}`
                  : 'Zero non-independent prompts were tallied in this range.'
              }
            />
            <StatTile
              label="Unprompted Sessions"
              value={summary.sessionsWithPromptGoals > 0 ? `${summary.unpromptedSessions} of ${summary.sessionsWithPromptGoals}` : '—'}
              icon={<CheckCircle2 className="mb-1.5 h-5 w-5 text-primary" aria-hidden />}
              className="p-3"
              valueClassName="text-2xl"
              explanation="Sessions where a prompt-tracking goal was worked on and zero non-independent prompts were recorded."
            />
          </div>
        </CardContent>
      </Card>

      {summary.totalTallied === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">No prompt-level tallies recorded yet in this date range</p>
            <p>
              {summary.sessionsWithPromptGoals > 0
                ? `${summary.sessionsWithPromptGoals} ${summary.sessionsWithPromptGoals === 1 ? 'session was' : 'sessions were'} recorded without prompt-level button counts. Tap Independent, Visual, Verbal, Gestural, Partial physical, or Imitation during Data Entry to track prompt fading here.`
                : 'Record prompt levels on a goal card in Data Entry to view cue breakdowns and independence trends over time.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Prompt Fading Over Time</CardTitle>
                  <CardDescription>
                    {fadingMode === 'stacked'
                      ? `Cue counts per ${periodNoun}. Look for heavier cues shrinking or Independent responses growing across time.`
                      : `Share of tallied responses completed independently in each ${periodNoun}. A rising line indicates prompt fading.`}
                  </CardDescription>
                </div>
                <ViewModeToggle
                  label="Prompt fading chart mode"
                  value={fadingMode}
                  onChange={setFadingMode}
                  options={[
                    { value: 'stacked', label: 'Cue Stack', icon: <Layers className="h-3.5 w-3.5" aria-hidden /> },
                    { value: 'rate', label: '% Independent', icon: <TrendingUp className="h-3.5 w-3.5" aria-hidden /> },
                  ]}
                />
              </div>
            </CardHeader>
            <CardContent className="h-[300px] w-full">
              {fadingMode === 'stacked' ? (
                <ChartContainer config={PROMPT_STACK_CONFIG} className="h-full w-full">
                  <BarChart data={fadingRows} margin={{ top: 8, right: 12, left: -12, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_, payload) => {
                            const row = payload?.[0]?.payload as CombinedChartRow | undefined;
                            if (!row) return '';
                            return grouping !== 'session' && row.sessionCount > 1
                              ? `${row.fullLabel} · ${row.sessionCount} sessions`
                              : row.fullLabel;
                          }}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    {usedPromptTypes.map((pt: PromptType) => (
                      <Bar key={pt} dataKey={pt} stackId="prompts" fill={PROMPT_COLORS[pt]} />
                    ))}
                  </BarChart>
                </ChartContainer>
              ) : (
                <ChartContainer config={INDEPENDENCE_LINE_CONFIG} className="h-full w-full">
                  <LineChart data={fadingRows} margin={{ top: 10, right: 16, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          labelFormatter={(_, payload) => {
                            const row = payload?.[0]?.payload as CombinedChartRow | undefined;
                            return row?.fullLabel ?? '';
                          }}
                          formatter={(value, _name, item) => {
                            const row = item?.payload as CombinedChartRow | undefined;
                            const detail = row ? ` (${row.Independent} of ${row.totalPromptTallies})` : '';
                            return (
                              <div className="flex w-full items-center justify-between gap-3">
                                <span className="text-muted-foreground">Independent</span>
                                <span className="font-mono font-medium tabular-nums text-foreground">{value}%{detail}</span>
                              </div>
                            );
                          }}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="independenceRate"
                      stroke="var(--color-independenceRate)"
                      strokeWidth={2.5}
                      dot={true}
                      connectNulls
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>
                    {breakdownMode === 'by-type' ? 'Prompt Types Used' : 'Sessions by Support Needed'}
                  </CardTitle>
                  <CardDescription>
                    {breakdownMode === 'by-type'
                      ? 'Which cue levels the student relied on most across the selected dates.'
                      : 'How many sessions needed zero prompts versus light (1–5) or heavier (6+) prompting.'}
                  </CardDescription>
                </div>
                <ViewModeToggle
                  label="Prompt breakdown mode"
                  value={breakdownMode}
                  onChange={setBreakdownMode}
                  options={[
                    { value: 'by-type', label: 'By Cue Type', icon: <BarChart3 className="h-3.5 w-3.5" aria-hidden /> },
                    { value: 'by-session', label: 'By Session', icon: <Layers className="h-3.5 w-3.5" aria-hidden /> },
                  ]}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {breakdownMode === 'by-type' ? (
                <div className="space-y-2.5 pt-1">
                  {summary.levels.map(level => (
                    <div key={level.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium text-foreground">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: level.color }} aria-hidden />
                          {level.label}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          <strong className="font-medium text-foreground">{level.count}</strong> ({level.sharePct}%)
                        </span>
                      </div>
                      <div className="h-3.5 w-full rounded bg-muted">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${summary.totalTallied > 0 ? (level.count / summary.totalTallied) * 100 : 0}%`,
                            backgroundColor: level.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5 pt-1">
                  {summary.sessionBins.map(bin => {
                    const sharePct = summary.sessionsWithPromptGoals > 0
                      ? Math.round((bin.count / summary.sessionsWithPromptGoals) * 100)
                      : 0;
                    return (
                      <div key={bin.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{bin.label}</span>
                          <span className="tabular-nums text-muted-foreground">
                            <strong className="font-medium text-foreground">{bin.count}</strong>{' '}
                            {bin.count === 1 ? 'session' : 'sessions'} ({sharePct}%)
                          </span>
                        </div>
                        <div className="h-3.5 w-full rounded bg-muted">
                          <div
                            className="h-full rounded bg-[hsl(var(--chart-2))] transition-all"
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PromptingOverview;
