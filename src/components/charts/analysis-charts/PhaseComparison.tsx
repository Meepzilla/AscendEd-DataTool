'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RELIABLE_ANALYSIS_SESSIONS, MIN_ANALYSIS_SESSIONS, type VisualAnalysis, type PhaseSummary } from '@/lib/visual-analysis';

// "Compare halves" on a goal's chart: the sessions in view split at the halfway point into a first half (A) and a
// second half (B), each with its level (median), trend line and stability (range), the way single-subject visual
// analysis reads session data (src/lib/visual-analysis.ts). The switch is remembered on this device for every card.

const PHASE_VIEW_KEY = 'ascended_phase_view';
const PHASE_VIEW_EVENT = 'ascended-phase-view';

/** Whether "Compare halves" is on, shared by every goal card on the page and remembered on this device. */
export function usePhaseView(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => {
      try { setOn(window.localStorage.getItem(PHASE_VIEW_KEY) === 'true'); } catch { /* not remembered */ }
    };
    read();
    window.addEventListener(PHASE_VIEW_EVENT, read);
    return () => window.removeEventListener(PHASE_VIEW_EVENT, read);
  }, []);
  const set = (next: boolean) => {
    setOn(next);
    try { window.localStorage.setItem(PHASE_VIEW_KEY, String(next)); } catch { /* not remembered */ }
    window.dispatchEvent(new Event(PHASE_VIEW_EVENT));
  };
  return [on, set];
}

export const PHASE_COLORS = { a: 'hsl(var(--chart-4))', b: 'hsl(var(--chart-2))' } as const;

const round = (n: number) => Math.round(n * 10) / 10;
const signed = (n: number) => (round(n) > 0 ? `+${round(n)}` : String(round(n)));

const VERDICT_TEXT = { better: 'better', worse: 'worse', flat: 'about the same' } as const;

export function PhaseToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <Button type="button" variant={on ? 'default' : 'outline'} size="sm" className="h-8 min-h-11 text-xs" aria-pressed={on}
      onClick={() => onChange(!on)}
      title="Split the sessions at the halfway point and compare the first half with the second: level (median), trend and range">
      Compare halves
    </Button>
  );
}

function PhaseCell({ phase, unit, which }: { phase: PhaseSummary; unit: string; which: 'A' | 'B' }) {
  return (
    <div className="rounded-md border p-2" style={{ borderColor: which === 'A' ? PHASE_COLORS.a : PHASE_COLORS.b }}>
      <p className="text-xs font-semibold">{which === 'A' ? 'First half (A)' : 'Second half (B)'} · {phase.count} sessions</p>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 text-xs">
        <dt className="text-muted-foreground">Level (median)</dt><dd className="font-medium tabular-nums">{round(phase.median)}{unit}</dd>
        <dt className="text-muted-foreground">Trend</dt><dd className="font-medium tabular-nums">{signed(phase.slope)}{unit} per session</dd>
        <dt className="text-muted-foreground">Range</dt><dd className="font-medium tabular-nums">{round(phase.min)}–{round(phase.max)}{unit} ({round(phase.range)})</dd>
      </dl>
    </div>
  );
}

/** The figures under the chart while "Compare halves" is on. */
export function PhaseSummaryPanel({ analysis, sessionCount, unit, targetLabel }: {
  analysis: VisualAnalysis | null;
  sessionCount: number;
  unit: string;
  /** The target as shown ("80%", "level 0"), when the goal has one. */
  targetLabel?: string;
}) {
  if (!analysis) {
    return (
      <p className="text-xs text-muted-foreground">
        Comparing halves needs at least {MIN_ANALYSIS_SESSIONS} sessions with data ({sessionCount} so far).
      </p>
    );
  }
  const { phaseA, phaseB } = analysis;
  const pace = analysis.sessionsToTarget;
  return (
    <div className="space-y-2" aria-label="First half and second half compared">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <PhaseCell phase={phaseA} unit={unit} which="A" />
        <PhaseCell phase={phaseB} unit={unit} which="B" />
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs">
        <li>
          <span className="font-medium">Level:</span> median {round(phaseA.median)}{unit} → {round(phaseB.median)}{unit}
          {' '}({signed(analysis.levelChange)}{unit}, {VERDICT_TEXT[analysis.levelVerdict]}).
        </li>
        <li>
          <span className="font-medium">Trend:</span> {signed(analysis.averageChange)}{unit} per session overall
          {' '}({VERDICT_TEXT[analysis.trendVerdict]}); {signed(phaseA.slope)} in the first half, {signed(phaseB.slope)} in the second.
        </li>
        <li>
          <span className="font-medium">Stability:</span> range {round(phaseA.range)}{unit} in the first half and {round(phaseB.range)}{unit} in the second
          {phaseB.range < phaseA.range ? ' (steadier)' : phaseB.range > phaseA.range ? ' (more variable)' : ''}.
        </li>
        {targetLabel && (
          <li>
            <span className="font-medium">Target:</span>{' '}
            {pace === 0 ? `the latest session meets the target of ${targetLabel}.`
              : pace !== null ? `at the overall pace, about ${pace} more ${pace === 1 ? 'session' : 'sessions'} to reach ${targetLabel}.`
                : `not moving toward ${targetLabel} at the overall pace.`}
          </li>
        )}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        The sessions in view are split at the halfway point{phaseA.count !== phaseB.count ? ' (the middle session goes to the second half)' : ''}.
        Dashed lines are each half&apos;s median, solid lines its trend.
        {analysis.fewSessions && ` Based on ${sessionCount} sessions: at least ${RELIABLE_ANALYSIS_SESSIONS} are recommended before judging gains, so read this with care.`}
      </p>
    </div>
  );
}
