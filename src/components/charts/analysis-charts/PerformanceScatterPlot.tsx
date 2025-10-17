
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Label } from 'recharts';
import { HelpCircle } from 'lucide-react';

interface PerformanceScatterPlotProps {
  chartData: any[];
}

const PerformanceScatterPlot: React.FC<PerformanceScatterPlotProps> = ({ chartData }) => {
  const histogramData = useMemo(() => {
    const bins = {
      '0 Prompts': 0,
      '1-5 Prompts': 0,
      '6-10 Prompts': 0,
      '11-15 Prompts': 0,
      '16-20 Prompts': 0,
      '21+ Prompts': 0,
    };

    chartData.forEach(session => {
      const prompts = session.totalPrompts;
      if (prompts === 0) bins['0 Prompts']++;
      else if (prompts >= 1 && prompts <= 5) bins['1-5 Prompts']++;
      else if (prompts >= 6 && prompts <= 10) bins['6-10 Prompts']++;
      else if (prompts >= 11 && prompts <= 15) bins['11-15 Prompts']++;
      else if (prompts >= 16 && prompts <= 20) bins['16-20 Prompts']++;
      else if (prompts > 20) bins['21+ Prompts']++;
    });

    return Object.entries(bins).map(([name, value]) => ({ name, 'Number of Sessions': value }));
  }, [chartData]);
  
  const chartConfig = { sessions: { label: 'Number of Sessions', color: 'hsl(var(--chart-2))' } } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HelpCircle className="h-6 w-6 text-primary"/>Prompt Usage Distribution</CardTitle>
        <CardDescription>Frequency of total prompts used per session (excluding Independent).</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart data={histogramData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-45} textAnchor="end" height={60} />
            <YAxis allowDecimals={false}>
               <Label value="Number of Sessions" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
            </YAxis>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="Number of Sessions" fill="var(--color-sessions)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default PerformanceScatterPlot;
