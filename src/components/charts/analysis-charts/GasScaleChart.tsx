'use client';

import React, { useEffect, useState } from 'react';
import type { Goal } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/helpers';
import {
  GAS_LEVELS, formatGasLevel, gasBaselineLevel, gasScaleSummary, gasTargetLevel, gasTimeframeText,
} from '@/lib/gas';

// The Goal Attainment Scale drawn the way Sohlberg, Hamilton & Turkstra (Transforming Cognitive Rehabilitation,
// ch. 5) lay it out: the aim, context, timeframe and measurement plan on top, then one column per level from -2
// (much less than expected) to +2 (much better than expected), each with what that level looks like for this
// student. The student's baseline, the target level and the latest recorded level are marked on the columns, with
// the number of sessions recorded at each level. On a narrow screen the columns stack, highest level first.
// "Student's words" swaps the level names for the book's person-centered wording ("Where I am now", …).

const WORDING_KEY = 'ascended_gas_student_wording';

function readWording(): boolean {
  try {
    return window.localStorage.getItem(WORDING_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeWording(on: boolean) {
  try {
    window.localStorage.setItem(WORDING_KEY, String(on));
  } catch {
    // Not remembered; the switch still works for this view.
  }
}

interface GasScaleChartProps {
  goal: Goal;
  /** The recorded levels, one per session, oldest first. */
  points: { date: string; value: number }[];
  /** For the printed report: no switch, plain print-friendly colors. */
  print?: boolean;
  className?: string;
}

export default function GasScaleChart({ goal, points, print = false, className }: GasScaleChartProps) {
  const [studentWords, setStudentWords] = useState(false);
  useEffect(() => { setStudentWords(readWording()); }, []);

  const target = gasTargetLevel(goal);
  const baseline = gasBaselineLevel(goal);
  const summary = gasScaleSummary(points, target);
  const timeframe = gasTimeframeText(goal, formatDate);
  const header = [
    ['Aim', goal.name],
    ['Context', goal.gasContext],
    ['Timeframe', timeframe],
    ['Measurement plan', goal.gasMeasurementPlan],
  ].filter((row): row is [string, string] => typeof row[1] === 'string' && row[1].trim() !== '');
  const written = GAS_LEVELS.some(info => (goal.gasLevelDescriptions?.[info.level + 2] ?? '').trim() !== '');
  const maxCount = Math.max(1, ...Object.values(summary.counts));

  return (
    <section aria-label="Goal Attainment Scale" className={cn('space-y-2 break-inside-avoid', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Goal Attainment Scale</p>
        {!print && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={studentWords}
              onCheckedChange={on => { setStudentWords(on); writeWording(on); }}
              aria-label="Show the levels in the student's words"
            />
            Student&apos;s words
          </label>
        )}
      </div>

      {header.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          {header.map(([term, value]) => (
            <React.Fragment key={term}>
              <dt className="font-semibold">{term}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}

      {/* Lowest level on the left as in the book; stacked highest first on a narrow screen. */}
      <ol className="flex flex-col-reverse gap-1.5 sm:grid sm:grid-cols-5" aria-label="Levels, from -2 to +2">
        {GAS_LEVELS.map(info => {
          const level = info.level;
          const description = (goal.gasLevelDescriptions?.[level + 2] ?? '').trim();
          const count = summary.counts[level] ?? 0;
          const isLatest = summary.latest?.level === level;
          const marks = [
            baseline === level && 'Baseline',
            target === level && 'Target',
            isLatest && 'Latest',
          ].filter((m): m is string => !!m);
          const name = studentWords ? info.studentWording : info.description;
          return (
            <li
              key={level}
              aria-label={`Level ${formatGasLevel(level)}, ${info.description}${marks.length ? ` (${marks.join(', ').toLowerCase()})` : ''}: ${description || 'no description written'}. ${count} ${count === 1 ? 'session' : 'sessions'}.`}
              className={cn(
                'flex min-w-0 flex-col rounded-md border p-2 text-xs',
                level === target && 'border-primary bg-primary/5',
                baseline === level && level !== target && 'border-dashed border-foreground/40',
                isLatest && !print && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                isLatest && print && 'border-2 border-foreground',
              )}
            >
              <div className="flex items-baseline gap-1.5 sm:block">
                <span className="text-base font-bold tabular-nums">{formatGasLevel(level)}</span>
                <span className="font-semibold leading-tight sm:block">{name}</span>
              </div>
              {studentWords && <span className="text-[10px] text-muted-foreground">{info.description}</span>}
              {marks.length > 0 && (
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {marks.map(mark => (
                    <span key={mark} className="rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight">{mark}</span>
                  ))}
                </span>
              )}
              <p className={cn('mt-1 flex-grow break-words', !description && 'italic text-muted-foreground')}>
                {description || 'Not written yet'}
              </p>
              <div className="mt-1.5" aria-hidden="true">
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
              </div>
              <span className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                {count} {count === 1 ? 'session' : 'sessions'}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-muted-foreground">
        {summary.latest
          ? <>Latest: level <span className="font-semibold text-foreground">{formatGasLevel(summary.latest.level)}</span> on {formatDate(summary.latest.date)}.
              {' '}Level {formatGasLevel(target)} or better in {summary.atTarget} of {summary.total} {summary.total === 1 ? 'session' : 'sessions'}.</>
          : 'No levels recorded yet.'}
        {!written && ' Write what each level looks like for this student in Edit Goal (Level Descriptions).'}
      </p>
    </section>
  );
}
