import React from 'react';
import { formatDate } from '@/lib/helpers';
import { dateValue } from '@/lib/aim-line';
import type { GoalProgress } from '@/lib/report-narrative';

// A small line chart of one goal's sessions for the printed progress report: one point per session, the target
// as a dashed line, and the first and last dates. With an aim line (baseline to target by the target date) the
// sessions are placed by date and the aim line is drawn from the baseline to the target date. Plain SVG with a
// fixed drawing size scaled to the page width, so it looks the same on screen and on paper.

const W = 640;
const H = 170;
const PAD = { top: 12, right: 16, bottom: 26, left: 44 };
const MUTED = 'hsl(210 15% 38%)';
const TARGET = 'hsl(35 80% 30%)';
const AIM = 'hsl(205 45% 32%)';
const DATA = 'hsl(35 75% 45%)';

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find(s => s * magnitude >= value)!;
  return step * magnitude;
}

export default function ProgressReportChart({ progress }: { progress: GoalProgress }) {
  const { points, target, unit, max, measureLabel, aim } = progress;
  if (points.length === 0) return null;

  const top = max ?? niceMax(Math.max(...points.map(p => p.value), target ?? 0, aim?.start.value ?? 0) * 1.1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  // Placed by date along the aim line's span when there is one; otherwise evenly, one step per session.
  const times = points.map(p => dateValue(p.date));
  const t0 = aim ? Math.min(aim.start.time, times[0]) : 0;
  const t1 = aim ? Math.max(aim.end.time, times[times.length - 1]) : 0;
  const xTime = (t: number) => PAD.left + (t1 > t0 ? ((t - t0) / (t1 - t0)) * innerW : innerW / 2);
  const x = (i: number) => aim ? xTime(times[i]) : PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (Math.min(Math.max(v, 0), top) / top) * innerH;
  const ticks = [0, top / 2, top];
  const label = (v: number) => `${Number(v.toFixed(1))}${unit.trim() === '%' ? '%' : ''}`;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const firstDate = aim ? formatDate(new Date(t0)) : formatDate(points[0].date);
  const lastDate = aim ? formatDate(new Date(t1)) : formatDate(points[points.length - 1].date);
  const summary = `${measureLabel} across ${points.length} session${points.length === 1 ? '' : 's'}, from ${formatDate(points[0].date)} to ${formatDate(points[points.length - 1].date)}: ${points.map(p => label(p.value)).join(', ')}${target !== undefined ? `. Target ${label(target)}` : ''}${aim ? `. Aim line from ${label(aim.start.value)} on ${formatDate(new Date(aim.start.time))} to ${label(aim.end.value)} on ${formatDate(new Date(aim.end.time))}` : ''}.`;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={summary}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="hsl(210 15% 88%)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={MUTED}>{label(t)}</text>
          </g>
        ))}
        {target !== undefined && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} stroke={TARGET} strokeWidth={1.5} strokeDasharray="6 4" />
            {/* At the left, with a white outline so a data point or line under it can't make it unreadable. */}
            <text x={PAD.left + 4} y={y(target) - 5} fontSize={11} fill={TARGET} stroke="#fff" strokeWidth={3} paintOrder="stroke">Target {label(target)}</text>
          </g>
        )}
        {aim && (
          <g>
            <line x1={xTime(aim.start.time)} y1={y(aim.start.value)} x2={xTime(aim.end.time)} y2={y(aim.end.value)} stroke={AIM} strokeWidth={1.5} strokeDasharray="2 3" />
            <circle cx={xTime(aim.start.time)} cy={y(aim.start.value)} r={4} fill="#fff" stroke={AIM} strokeWidth={1.5} />
            <text x={xTime(aim.start.time) + 7} y={y(aim.start.value) + 14} fontSize={11} fill={AIM} stroke="#fff" strokeWidth={3} paintOrder="stroke">Baseline {label(aim.start.value)}</text>
            <text x={xTime(aim.end.time) - 4} y={y(aim.end.value) + 14} textAnchor="end" fontSize={11} fill={AIM} stroke="#fff" strokeWidth={3} paintOrder="stroke">Aim line</text>
          </g>
        )}
        <path d={line} fill="none" stroke={DATA} strokeWidth={2.5} strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={3.5} fill={DATA} stroke="#fff" strokeWidth={1.5} />
        ))}
        <text x={PAD.left} y={H - 6} fontSize={11} fill={MUTED}>{firstDate}</text>
        {(aim || points.length > 1) && (
          <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize={11} fill={MUTED}>{lastDate}</text>
        )}
      </svg>
    </figure>
  );
}
