
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Waves } from 'lucide-react';

interface DysfluencyTypesChartProps {
  chartData: any[];
}

const DysfluencyTypesChart: React.FC<DysfluencyTypesChartProps> = ({ chartData }) => {
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
            <Waves className="h-6 w-6 text-primary" />
            Dysfluency Types
        </CardTitle>
        <CardDescription>Counts of different dysfluency types per session.</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="blocks" stackId="a" fill="var(--color-blocks)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="repetitions" stackId="a" fill="var(--color-repetitions)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="prolongations" stackId="a" fill="var(--color-prolongations)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="interjections" stackId="a" fill="var(--color-interjections)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default DysfluencyTypesChart;
