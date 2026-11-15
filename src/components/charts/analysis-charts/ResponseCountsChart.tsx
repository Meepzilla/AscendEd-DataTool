'use client';

import React from 'react';
import type { Goal } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';

interface ResponseCountsChartProps {
  chartData: any[];
  selectedGoalId?: string;
  activeStudentGoals: Goal[];
}

// Responses per session as stacked bars: correct, approximate and incorrect make up each bar, so its height is
// the session's opportunities. (This replaces two line charts, Response Counts and Total Opportunities, that
// showed the same numbers.)
const ResponseCountsChart: React.FC<ResponseCountsChartProps> = ({ chartData, selectedGoalId, activeStudentGoals }) => {
  const config = {
    correct: { label: 'Correct', color: 'hsl(var(--chart-2))' },
    approximate: { label: 'Approximate', color: 'hsl(var(--chart-4))' },
    incorrect: { label: 'Incorrect', color: 'hsl(var(--chart-5))' },
  } as const;
  const goalName = selectedGoalId ? activeStudentGoals.find(g => g.id === selectedGoalId)?.name : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Responses per Session {goalName ? `(${goalName})` : '(All Active Goals)'}
        </CardTitle>
        <CardDescription>
          Correct, approximate and incorrect responses in each session. The height of a bar is the session&apos;s
          opportunities; tap a bar for the counts.
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
                    const row = payload?.[0]?.payload as { opportunities?: number } | undefined;
                    return row?.opportunities !== undefined ? `${label} · ${row.opportunities} ${row.opportunities === 1 ? 'opportunity' : 'opportunities'}` : label;
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
