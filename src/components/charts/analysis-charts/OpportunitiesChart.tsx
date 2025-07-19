'use client';

import React from 'react';
import type { Goal } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';

interface OpportunitiesChartProps {
  chartData: any[];
  selectedGoalId?: string;
  activeStudentGoals: Goal[];
}

const OpportunitiesChart: React.FC<OpportunitiesChartProps> = ({ chartData, selectedGoalId, activeStudentGoals }) => {
  const opportunitiesChartConfig = { opportunities: { label: 'Opportunities', color: 'hsl(var(--chart-1))' } } as const;
  const goalName = selectedGoalId ? activeStudentGoals.find(g => g.id === selectedGoalId)?.name : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Total Opportunities {goalName ? `(${goalName})` : '(Overall - Active Goals)'}
        </CardTitle>
        <CardDescription>Total number of opportunities (e.g., trials) per session for active goals.</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ChartContainer config={opportunitiesChartConfig} className="h-full w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line type="monotone" dataKey="opportunities" stroke="var(--color-opportunities)" strokeWidth={2} dot={true} name="Opportunities" />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default OpportunitiesChart;
