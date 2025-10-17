
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { MessageSquareQuote } from 'lucide-react';

interface SyllableFluencyChartProps {
  chartData: any[];
}

const SyllableFluencyChart: React.FC<SyllableFluencyChartProps> = ({ chartData }) => {
  const chartConfig = {
    totalSyllables: { label: 'Total Syllables', color: 'hsl(var(--chart-1))' },
    stutteredSyllables: { label: 'Stuttered Syllables', color: 'hsl(var(--chart-5))' },
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <MessageSquareQuote className="h-6 w-6 text-primary" />
            Syllable Fluency
        </CardTitle>
        <CardDescription>Total syllables vs. stuttered syllables per session.</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line type="monotone" dataKey="totalSyllables" stroke="var(--color-totalSyllables)" strokeWidth={2} dot={true} name="Total Syllables" />
            <Line type="monotone" dataKey="stutteredSyllables" stroke="var(--color-stutteredSyllables)" strokeWidth={2} dot={true} name="Stuttered Syllables" />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default SyllableFluencyChart;
