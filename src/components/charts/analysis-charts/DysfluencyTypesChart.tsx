'use client';

import React, { useMemo } from 'react';
import { Waves } from 'lucide-react';
import type { TimeGrouping } from '@/lib/report-filters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';

interface DysfluencyTypesChartProps {
  chartData: any[];
  grouping?: TimeGrouping;
}

const DysfluencyTypesChart: React.FC<DysfluencyTypesChartProps> = ({ chartData, grouping = 'session' }) => {
  const rows = useMemo(
    () => chartData.filter(r => (r.totalSyllables ?? 0) > 0 || (r.blocks ?? 0) + (r.repetitions ?? 0) + (r.prolongations ?? 0) + (r.interjections ?? 0) > 0),
    [chartData],
  );
  const periodNoun = grouping === 'session' ? 'session' : grouping === 'week' ? 'week' : 'month';

  const chartConfig = {
    blocks: { label: 'Blocks', color: 'hsl(var(--chart-1))' },
    repetitions: { label: 'Repetitions', color: 'hsl(var(--chart-2))' },
    prolongations: { label: 'Prolongations', color: 'hsl(var(--chart-3))' },
    interjections: { label: 'Interjections', color: 'hsl(var(--chart-4))' },
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Waves className="h-5 w-5 text-primary" aria-hidden />
          Dysfluency Types Over Time
        </CardTitle>
        <CardDescription>
          Breakdown of blocks, repetitions, prolongations, and interjections per {periodNoun}, showing which stutter patterns occur most.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart data={rows} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="blocks" stackId="a" fill="var(--color-blocks)" />
            <Bar dataKey="repetitions" stackId="a" fill="var(--color-repetitions)" />
            <Bar dataKey="prolongations" stackId="a" fill="var(--color-prolongations)" />
            <Bar dataKey="interjections" stackId="a" fill="var(--color-interjections)" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default DysfluencyTypesChart;
