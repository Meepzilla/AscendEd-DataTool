'use client';

import React from 'react';
import type { Goal } from '@/lib/types';
import type { TimeGrouping } from '@/lib/report-filters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';

interface ResponseCountsChartProps {
  chartData: any[];
  selectedGoalId?: string;
  activeStudentGoals: Goal[];
  grouping?: TimeGrouping;
}

const ResponseCountsChart: React.FC<ResponseCountsChartProps> = ({
  chartData,
  selectedGoalId,
  activeStudentGoals,
  grouping = 'session',
}) => {
  const config = {
    correct: { label: 'Correct', color: 'hsl(var(--chart-2))' },
    approximate: { label: 'Approximate', color: 'hsl(var(--chart-4))' },
    incorrect: { label: 'Incorrect', color: 'hsl(var(--chart-5))' },
  } as const;
  const goalName = selectedGoalId ? activeStudentGoals.find(g => g.id === selectedGoalId)?.name : null;
  const periodTitle = grouping === 'session' ? 'per Session' : grouping === 'week' ? 'per Week' : 'per Month';
  const periodNoun = grouping === 'session' ? 'session' : grouping === 'week' ? 'week' : 'month';

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Response Volume {periodTitle} {goalName ? `(${goalName})` : '(All Trial Goals)'}
        </CardTitle>
        <CardDescription>
          Stacked Correct, Approximate, and Incorrect counts in each {periodNoun}. Total bar height shows practice volume (opportunities).
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ChartContainer config={config} className="h-full w-full">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as { fullLabel?: string; opportunities?: number } | undefined;
                    const base = row?.fullLabel ?? label;
                    return row?.opportunities !== undefined
                      ? `${base} · ${row.opportunities} ${row.opportunities === 1 ? 'opportunity' : 'opportunities'}`
                      : base;
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="correct" stackId="responses" fill="var(--color-correct)" />
            <Bar dataKey="approximate" stackId="responses" fill="var(--color-approximate)" />
            <Bar dataKey="incorrect" stackId="responses" fill="var(--color-incorrect)" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default ResponseCountsChart;
