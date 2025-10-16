
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ScatterChart, Scatter, CartesianGrid, XAxis, YAxis, Label } from 'recharts';
import { Shuffle } from 'lucide-react';

interface PerformanceScatterPlotProps {
  chartData: any[];
}

const PerformanceScatterPlot: React.FC<PerformanceScatterPlotProps> = ({ chartData }) => {
  const scatterPlotConfig = { session: { label: 'Session Performance', color: 'hsl(var(--chart-3))' } } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shuffle className="h-6 w-6 text-primary"/>Correct Responses vs. Total Prompts Used</CardTitle>
        <CardDescription>Scatter plot of total prompts used (excluding Independent) per session against total correct responses. Each dot is a session.</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ChartContainer config={scatterPlotConfig} className="h-full w-full">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="totalPrompts" name="Total Prompts Used" unit="" tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}>
              <Label value="Total Prompts Used" offset={0} position="insideBottom" />
            </XAxis>
            <YAxis type="number" dataKey="correct" name="Correct Responses" unit="" tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}>
              <Label value="Correct Responses" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
            </YAxis>
            <ChartTooltip content={<ChartTooltipContent hideIndicator cursor={false} />} />
            <Scatter name="Session Performance" data={chartData} fill="hsl(var(--chart-3))" />
          </ScatterChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default PerformanceScatterPlot;
