'use client';

import React, { useMemo } from 'react';
import type { Goal, SessionData } from '@/lib/types';
import { gasTScoresOverTime, GAS_LEVELS } from '@/lib/gas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { ScatterChart, Scatter, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts';

/** Short labels for the five attainment levels, for tooltips and tick text. */
export function gasLevelShortLabel(level: number): string {
  return GAS_LEVELS.find(l => l.level === level)?.label ?? '';
}

const formatLevel = (level: number) => {
  const signed = level > 0 ? `+${level}` : String(level);
  const label = gasLevelShortLabel(level);
  return label ? `${signed} (${label})` : signed;
};

const shortDate = (time: number) => new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

interface GasTScoreChartProps {
  sessions: SessionData[]; // oldest first
  goals: Goal[]; // the student's GAS goals in view
}

interface TScorePoint {
  date: string;
  tScore: number;
  levels: { goalId: string; goalName: string; level: number }[];
}

/**
 * One dot per session date: the student's GAS T-score over time (T = 50 is the expected
 * outcome). With one GAS goal the plot is a straight rescale of its levels; with several
 * goals it is the composite. T-scores sit roughly in 20-80 for the level range -2 to +2.
 */
const GasTScoreChart: React.FC<GasTScoreChartProps> = ({ sessions, goals }) => {
  const points = useMemo<TScorePoint[]>(() => {
    // gasTScoresOverTime returns one point per session date with levels by goal id; dates with
    // no level recorded yet (tScore null) have no dot.
    return gasTScoresOverTime(sessions, goals)
      .filter(p => p.tScore !== null && !Number.isNaN(new Date(p.date).getTime()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(p => ({
        date: p.date,
        tScore: p.tScore as number,
        levels: Object.entries(p.levels).map(([goalId, level]) => ({
          goalId,
          goalName: goals.find(g => g.id === goalId)?.name ?? goalId,
          level,
        })),
      }));
  }, [sessions, goals]);

  const data = useMemo(
    () => points.map(p => ({ time: new Date(p.date).getTime(), tScore: Math.round(p.tScore * 10) / 10, point: p })),
    [points],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>GAS T-score over time</CardTitle>
        <CardDescription>
          Composite T-score across the student&apos;s GAS goals (50 is the expected outcome). One dot per session date; levels carry forward from the last session where each goal was recorded.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] w-full">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No GAS levels recorded in the selected date range.</p>
        ) : (
          <ChartContainer config={{ tScore: { label: 'T-score', color: 'hsl(var(--chart-1))' } }} className="h-full w-full">
            <ScatterChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="time" domain={['dataMin', 'dataMax']} tickFormatter={shortDate} tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis domain={[20, 80]} tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload.point as TScorePoint;
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-md">
                      <p className="font-medium">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p>T-score: {Math.round(p.tScore * 10) / 10}</p>
                      {p.levels.map(l => (
                        <p key={l.goalId} className="text-muted-foreground">{l.goalName}: {formatLevel(l.level)}</p>
                      ))}
                    </div>
                  );
                }}
              />
              <ReferenceLine y={50} stroke="hsl(var(--chart-5))" strokeDasharray="6 4"
                label={{ value: 'Expected (T = 50)', position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Scatter dataKey="tScore" fill="var(--color-tScore)" />
            </ScatterChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default GasTScoreChart;
