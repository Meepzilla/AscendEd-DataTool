
'use client';

import React from 'react';
import type { Goal } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';

interface ResponseCountsChartProps {
  chartData: any[];
  selectedGoalId?: string;
  activeStudentGoals: Goal[];
}

const ResponseCountsChart: React.FC<ResponseCountsChartProps> = ({ chartData, selectedGoalId, activeStudentGoals }) => {
  const responseCountsChartConfig = { 
    correct: { label: 'Correct', color: 'hsl(var(--chart-2))' }, 
    incorrect: { label: 'Incorrect', color: 'hsl(var(--chart-5))' },
    approximate: { label: 'Approximate', color: 'hsl(var(--chart-4))' },
  } as const;
  const goalName = selectedGoalId ? activeStudentGoals.find(g => g.id === selectedGoalId)?.name : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Response Counts {goalName ? `(${goalName})` : '(Overall - Active Goals)'}
        </CardTitle>
        <CardDescription>
          Number of correct, incorrect, and approximate responses per session for active goals.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ChartContainer config={responseCountsChartConfig} className="h-full w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}/>
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line type="monotone" dataKey="correct" stroke="var(--color-correct)" strokeWidth={2} dot={true} />
            <Line type="monotone" dataKey="incorrect" stroke="var(--color-incorrect)" strokeWidth={2} dot={true} />
            <Line type="monotone" dataKey="approximate" stroke="var(--color-approximate)" strokeWidth={2} dot={true} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default ResponseCountsChart;
