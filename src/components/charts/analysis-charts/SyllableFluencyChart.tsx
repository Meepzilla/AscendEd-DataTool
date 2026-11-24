'use client';

import React, { useMemo, useState } from 'react';
import { Hash, MessageSquareQuote, Percent } from 'lucide-react';
import type { TimeGrouping } from '@/lib/report-filters';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import ViewModeToggle from './ViewModeToggle';

interface SyllableFluencyChartProps {
  chartData: any[];
  grouping?: TimeGrouping;
}

type FluencyView = 'percent' | 'counts';

const SyllableFluencyChart: React.FC<SyllableFluencyChartProps> = ({ chartData, grouping = 'session' }) => {
  const [view, setView] = useState<FluencyView>('percent');
  const fluencyRows = useMemo(() => chartData.filter(r => (r.totalSyllables ?? 0) > 0), [chartData]);
  const periodNoun = grouping === 'session' ? 'session' : grouping === 'week' ? 'week' : 'month';

  const countsConfig = {
    totalSyllables: { label: 'Total Syllables', color: 'hsl(var(--chart-1))' },
    stutteredSyllables: { label: 'Stuttered Syllables', color: 'hsl(var(--chart-5))' },
  } as const;

  const pctConfig = {
    fluencyPct: { label: 'Fluent Syllables (%)', color: 'hsl(var(--chart-2))' },
  } as const;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareQuote className="h-5 w-5 text-primary" aria-hidden />
              Syllable Fluency
            </CardTitle>
            <CardDescription>
              {view === 'percent'
                ? `Percentage of fluent (unstuttered) syllables per ${periodNoun}.`
                : `Total syllables spoken versus stuttered syllables per ${periodNoun}.`}
            </CardDescription>
          </div>
          <ViewModeToggle
            label="Syllable fluency chart mode"
            value={view}
            onChange={setView}
            options={[
              { value: 'percent', label: '% Fluent', icon: <Percent className="h-3.5 w-3.5" aria-hidden /> },
              { value: 'counts', label: 'Counts', icon: <Hash className="h-3.5 w-3.5" aria-hidden /> },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        {view === 'percent' ? (
          <ChartContainer config={pctConfig} className="h-full w-full">
            <LineChart data={fluencyRows} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} />
              <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={(value, _name, item) => {
                      const row = item?.payload as { totalSyllables?: number; stutteredSyllables?: number } | undefined;
                      const detail = row?.totalSyllables
                        ? ` (${row.stutteredSyllables ?? 0} stuttered of ${row.totalSyllables})`
                        : '';
                      return (
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="text-muted-foreground">Fluent Syllables</span>
                          <span className="font-mono font-medium tabular-nums text-foreground">{value}%{detail}</span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Line type="monotone" dataKey="fluencyPct" stroke="var(--color-fluencyPct)" strokeWidth={2.5} dot={true} connectNulls />
            </LineChart>
          </ChartContainer>
        ) : (
          <ChartContainer config={countsConfig} className="h-full w-full">
            <LineChart data={fluencyRows} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="totalSyllables" stroke="var(--color-totalSyllables)" strokeWidth={2} dot={true} name="Total Syllables" />
              <Line type="monotone" dataKey="stutteredSyllables" stroke="var(--color-stutteredSyllables)" strokeWidth={2} dot={true} name="Stuttered Syllables" />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default SyllableFluencyChart;
