'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import { PROMPT_TYPES, PROMPT_COLORS } from '@/lib/promptConstants';
import type { PromptType } from '@/lib/types';

interface PromptUsageChartProps {
  chartData: any[];
}

const PromptUsageChart: React.FC<PromptUsageChartProps> = ({ chartData }) => {
  const promptUsageData = useMemo(() => {
    const aggregatedPrompts: Record<PromptType, number> = Object.fromEntries(PROMPT_TYPES.map(pt => [pt, 0])) as Record<PromptType, number>;
    chartData.forEach(session => { PROMPT_TYPES.forEach(pt => { if (session[pt]) aggregatedPrompts[pt] += session[pt] as number; }); });
    return Object.entries(aggregatedPrompts).map(([name, value]) => ({ name: name as PromptType, value, fill: PROMPT_COLORS[name as PromptType] })).filter(item => item.value > 0);
  }, [chartData]);
  
  const promptChartConfig = PROMPT_TYPES.reduce((config, pt) => {
    config[pt] = { label: pt.replace(/([A-Z])/g, ' $1').trim(), color: PROMPT_COLORS[pt] };
    return config;
  }, {} as Record<PromptType, { label: string; color: string }>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt Usage Distribution (Active Goals)</CardTitle>
        <CardDescription>Total count of each prompt level used across selected sessions for active goals.</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ChartContainer config={promptChartConfig} className="h-full w-full">
          <BarChart data={promptUsageData} layout="vertical" margin={{ left: 10, right: 10 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} tickFormatter={(value) => value.replace(/([A-Z])/g, ' $1').trim()} />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="value" radius={5} />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default PromptUsageChart;
