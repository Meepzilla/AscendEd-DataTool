'use client';

import React from 'react';
import type { Goal } from '@/lib/types';
import type { TimeGrouping } from '@/lib/report-filters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { FEW_OPPORTUNITIES, POOLED_TREND_SESSIONS, dotRadius } from '@/lib/trial-weights';

interface ProgressOverTimeChartProps {
  chartData: any[];
  selectedGoalId?: string;
  activeStudentGoals: Goal[];
  grouping?: TimeGrouping;
}

const AccuracyDot = (props: { cx?: number; cy?: number; payload?: { opportunities?: number; accuracy?: number | null }; index?: number }) => {
  const { cx, cy, payload, index } = props;
  if (cx === undefined || cy === undefined || payload?.accuracy === null || payload?.accuracy === undefined) return <g key={`dot-${index}`} />;
  const opportunities = payload.opportunities ?? 0;
  const few = opportunities < FEW_OPPORTUNITIES;
  return (
    <circle
      key={`dot-${index}`}
      cx={cx}
      cy={cy}
      r={dotRadius(opportunities)}
      stroke="var(--color-accuracy)"
      strokeWidth={2}
      fill={few ? 'hsl(var(--background))' : 'var(--color-accuracy)'}
    />
  );
};

const ProgressOverTimeChart: React.FC<ProgressOverTimeChartProps> = ({
  chartData,
  selectedGoalId,
  activeStudentGoals,
  grouping = 'session',
}) => {
  const bucketPlural = grouping === 'session' ? 'sessions' : grouping === 'week' ? 'weeks' : 'months';
  const accuracyChartConfig = {
    accuracy: { label: 'Accuracy (%)', color: 'hsl(var(--primary))' },
    weightedTrend: { label: `Trend (last ${POOLED_TREND_SESSIONS} ${bucketPlural} pooled)`, color: 'hsl(var(--muted-foreground))' },
  } as const;
  const goalName = selectedGoalId ? activeStudentGoals.find(g => g.id === selectedGoalId)?.name : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Trial Accuracy Trend {goalName ? `(${goalName})` : '(All Trial Goals Pooled)'}
        </CardTitle>
        <CardDescription>
          Overall percentage correct across {bucketPlural}. Larger dots had more trials; hollow dots had fewer than {FEW_OPPORTUNITIES} trials, so read them with care. The dashed line pools the last {POOLED_TREND_SESSIONS} {bucketPlural} to smooth low-trial days.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ChartContainer config={accuracyChartConfig} className="h-full w-full">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} />
            <YAxis unit="%" domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as { fullLabel?: string; sessionCount?: number } | undefined;
                    if (!row?.fullLabel) return '';
                    return grouping !== 'session' && row.sessionCount && row.sessionCount > 1
                      ? `${row.fullLabel} · ${row.sessionCount} sessions`
                      : row.fullLabel;
                  }}
                  formatter={(value, name, item) => {
                    const row = item?.payload as { correct?: number; opportunities?: number } | undefined;
                    const label = accuracyChartConfig[name as keyof typeof accuracyChartConfig]?.label ?? name;
                    const detail = name === 'accuracy' && row?.opportunities ? ` (${row.correct ?? 0} of ${row.opportunities})` : '';
                    return (
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-mono font-medium tabular-nums text-foreground">{value}%{detail}</span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Line type="monotone" dataKey="accuracy" stroke="var(--color-accuracy)" strokeWidth={2} dot={AccuracyDot} activeDot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="weightedTrend" stroke="var(--color-weightedTrend)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
            <ChartLegend content={<ChartLegendContent />} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default ProgressOverTimeChart;
