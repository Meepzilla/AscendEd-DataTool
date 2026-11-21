'use client';

import React from 'react';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { Goal } from '@/lib/types';
import { formatSampleLength, lengthDistribution, sampleUnit, sessionSampleUnit, summarizeSample, utteranceLengths } from '@/lib/language-sample';
import { ITEM_MASTERY_RUN, itemHistory, listItems, masteredOverTime } from '@/lib/item-mastery';

// The report charts that fit language sample (MLU) and item mastery goals, under the goal's own measure chart:
// - language sample: how many utterances there were of each length over the date range, and each session's
//   sample size with its longest utterance;
// - item mastery: how many items were mastered as of each session, and a table of every item's results by session
//   (a text view of the same data, readable by screen readers).

interface Recorded { data: Record<string, any>; label: string }

const LENGTH_CONFIG: ChartConfig = { count: { label: 'Utterances', color: 'hsl(var(--chart-1))' } };
const SAMPLE_CONFIG: ChartConfig = {
  utterances: { label: 'Utterances', color: 'hsl(var(--chart-3))' },
  longest: { label: 'Longest utterance', color: 'hsl(var(--chart-2))' },
};
const MASTERED_CONFIG: ChartConfig = { mastered: { label: 'Items mastered', color: 'hsl(var(--chart-2))' } };

export function LanguageSampleCharts({ goal, recorded, showLengths = true, showSample = true }: { goal: Goal; recorded: Recorded[]; showLengths?: boolean; showSample?: boolean }) {
  const sessions = recorded.map(r => ({ label: r.label, lengths: utteranceLengths(r.data), unit: sessionSampleUnit(r.data, goal) }));
  const unit = sampleUnit(goal);
  // Utterances counted in another unit (the goal's unit was changed later) are left out of the pooled chart.
  const pooled = sessions.filter(s => s.unit === unit).flatMap(s => s.lengths);
  if (!sessions.some(s => s.lengths.length) || (!showLengths && !showSample)) return null;
  const summary = summarizeSample(pooled);
  const distribution = lengthDistribution(pooled);
  const perSession = sessions.map(s => {
    const one = summarizeSample(s.lengths);
    return { label: s.label, utterances: one.utterances, longest: one.longest };
  });
  const unitWord = unit === 'morphemes' ? 'morphemes' : 'words';

  return (
    <div className="grid grid-cols-1 gap-4 md:col-span-3 md:grid-cols-2">
      {showLengths && <div>
        <p className="mb-1 text-sm font-medium">Utterance lengths ({unitWord})</p>
        <p className="mb-1 text-xs text-muted-foreground">
          {summary.utterances} utterances in the date range · MLU {summary.mlu === null ? '—' : formatSampleLength(summary.mlu, unit)} · longest {summary.longest}
        </p>
        <div className="h-[220px] w-full">
          <ChartContainer config={LENGTH_CONFIG} className="h-full w-full">
            <BarChart data={distribution} margin={{ top: 10, right: 10, left: -20, bottom: 5 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(l: unknown) => `${l} ${unitWord}`} />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>}
      {showSample && <div>
        <p className="mb-1 text-sm font-medium">Sample size and longest utterance per session</p>
        <p className="mb-1 text-xs text-muted-foreground">Bars: utterances recorded. Line: the longest utterance ({unitWord}).</p>
        <div className="h-[220px] w-full">
          <ChartContainer config={SAMPLE_CONFIG} className="h-full w-full">
            <ComposedChart data={perSession} margin={{ top: 10, right: 10, left: -20, bottom: 5 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="utterances" fill="var(--color-utterances)" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="longest" stroke="var(--color-longest)" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
            </ComposedChart>
          </ChartContainer>
        </div>
      </div>}
    </div>
  );
}

/** How many session columns the item table shows (the most recent ones). */
const ITEM_TABLE_SESSIONS = 8;

export function ItemMasteryCharts({ goal, recorded }: { goal: Goal; recorded: Recorded[] }) {
  const history = itemHistory(recorded.map(r => r.data), listItems(goal));
  const tried = history.filter(h => h.tries > 0);
  if (!tried.length) return null;
  const total = Math.max(listItems(goal).length, tried.length);
  const overTime = masteredOverTime(history, recorded.length).map((mastered, i) => ({ label: recorded[i].label, mastered }));
  const masteredNow = history.filter(h => h.mastered).length;
  const firstColumn = Math.max(0, recorded.length - ITEM_TABLE_SESSIONS);
  const columns = recorded.slice(firstColumn);

  return (
    <div className="space-y-4 md:col-span-3">
      <div>
        <p className="mb-1 text-sm font-medium">Items mastered</p>
        <p className="mb-1 text-xs text-muted-foreground">
          {masteredNow} of {total} items mastered (correct {ITEM_MASTERY_RUN} sessions in a row).
        </p>
        <div className="h-[220px] w-full">
          <ChartContainer config={MASTERED_CONFIG} className="h-full w-full">
            <LineChart data={overTime} margin={{ top: 10, right: 20, left: -20, bottom: 5 }} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} domain={[0, total]} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <ReferenceLine y={total} stroke="hsl(var(--chart-5))" strokeDasharray="6 4"
                label={{ value: `All ${total}`, position: 'insideTopRight', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Line type="stepAfter" dataKey="mastered" stroke="var(--color-mastered)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ChartContainer>
        </div>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">Item by item</p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <caption className="sr-only">
              Each item&apos;s result by session: ✓ correct, ✕ incorrect, · not tried{firstColumn > 0 ? `; the last ${ITEM_TABLE_SESSIONS} sessions` : ''}.
            </caption>
            <thead className="bg-muted/40">
              <tr>
                <th scope="col" className="px-2 py-1 text-left font-medium">Item</th>
                {columns.map((c, i) => <th key={i} scope="col" className="px-1 py-1 text-center font-medium whitespace-nowrap">{c.label}</th>)}
                <th scope="col" className="px-2 py-1 text-right font-medium">Correct</th>
                <th scope="col" className="px-2 py-1 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.label} className="border-t">
                  <th scope="row" className="px-2 py-1 text-left font-medium">{h.label}</th>
                  {h.results.slice(firstColumn).map((r, i) => (
                    <td key={i} className={`px-1 py-1 text-center ${r === true ? 'text-green-700 dark:text-green-400' : r === false ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'}`}>
                      <span aria-label={r === true ? 'correct' : r === false ? 'incorrect' : 'not tried'}>{r === true ? '✓' : r === false ? '✕' : '·'}</span>
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right tabular-nums">{h.tries ? `${h.correct} of ${h.tries}` : '—'}</td>
                  <td className="px-2 py-1">
                    {h.mastered
                      ? <span className="rounded-full border border-green-500/50 bg-green-500/15 px-2 py-0.5 font-semibold text-green-700 dark:text-green-400">Mastered</span>
                      : h.tries ? <span className="text-muted-foreground">Practicing</span> : <span className="text-muted-foreground">Not tried</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">✓ correct · ✕ incorrect · · not tried in that session.</p>
      </div>
    </div>
  );
}
