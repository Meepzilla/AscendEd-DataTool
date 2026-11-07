'use client';

import React, { useMemo } from 'react';
import type { Goal, SessionData } from '@/lib/types';
import { gasTScoresOverTime } from '@/lib/gas';
import { goalMeasure, withoutRunningTimers } from '@/lib/goal-measures';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { gasLevelShortLabel } from './GasTScoreLineChart';
import ExpandableGoalName from './ExpandableGoalName';
import type { StudentIep } from '@/lib/types';

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A baseline or current level for one goal: the signed number, with the goal's own written
 * description for that level underneath where one is set, or the generic short label beside it.
 * Averages show a plain signed number (an average is not a level).
 */
function LevelCell({ goal, level }: { goal: Goal; level: number | null }) {
  if (level === null || !Number.isFinite(level)) return <>—</>;
  const signed = level > 0 ? `+${round1(level)}` : String(round1(level));
  if (!Number.isInteger(level)) return <>{signed}</>;
  const custom = goal.gasLevelDescriptions?.[level + 2]?.trim();
  if (custom) {
    return (
      <>
        <span className="block">{signed}</span>
        <span className="block text-xs text-muted-foreground">{custom}</span>
      </>
    );
  }
  const label = gasLevelShortLabel(level);
  return <>{label ? `${signed} (${label})` : signed}</>;
}

/** The recorded level for one session's data: the goal measure once Track A wires it, falling back to the stored gasLevel. */
function recordedLevel(goal: Goal, data: Record<string, any>): number | null {
  const measured = goalMeasure(goal, withoutRunningTimers(data));
  if (measured !== null) return measured;
  const raw = Number(data.gasLevel);
  return Number.isFinite(raw) && raw >= -2 && raw <= 2 ? raw : null;
}

interface GasSummaryTableProps {
  sessions: SessionData[]; // oldest first
  goals: Goal[]; // the student's GAS goals in view
  studentName?: string;
  studentIep?: StudentIep;
}

/**
 * One row per GAS goal — baseline, current level, sessions recorded, average level, sessions
 * at or above expected — with the student's latest and average T-score in the header.
 */
const GasSummaryTable: React.FC<GasSummaryTableProps> = ({ sessions, goals, studentName, studentIep }) => {
  const rows = useMemo(() => goals.map(goal => {
    const levels: number[] = [];
    for (const session of sessions) {
      const data = session.goals.find(g => g.goalId === goal.id)?.data;
      if (!data) continue;
      const level = recordedLevel(goal, data);
      if (level !== null) levels.push(level);
    }
    return {
      goal,
      baseline: goal.baseline !== undefined && goal.baseline !== null ? Number(goal.baseline) : null,
      current: levels.length ? levels[levels.length - 1] : null,
      sessions: levels.length,
      average: levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : null,
      atOrAbove: levels.filter(v => v >= 0).length,
    };
  }), [sessions, goals]);

  const tScores = useMemo(() => {
    return gasTScoresOverTime(sessions, goals)
      .map(r => r.tScore)
      .filter((v): v is number => v !== null && Number.isFinite(v));
  }, [sessions, goals]);
  const latestT = tScores.length ? tScores[tScores.length - 1] : null;
  const averageT = tScores.length ? tScores.reduce((a, b) => a + b, 0) / tScores.length : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>GAS summary</CardTitle>
        <CardDescription>
          {latestT !== null
            ? `Latest T-score ${round1(latestT)}${averageT !== null ? ` · average T-score ${round1(averageT)}` : ''} (50 is the expected outcome).`
            : 'No GAS levels recorded in the selected date range.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Goal</TableHead>
              <TableHead>Baseline level</TableHead>
              <TableHead>Current level</TableHead>
              <TableHead>Sessions recorded</TableHead>
              <TableHead>Average level</TableHead>
              <TableHead>Sessions at or above expected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.goal.id}>
                <TableCell className="font-medium"><ExpandableGoalName goal={row.goal} studentName={studentName} studentIep={studentIep} /></TableCell>
                <TableCell><LevelCell goal={row.goal} level={row.baseline} /></TableCell>
                <TableCell><LevelCell goal={row.goal} level={row.current} /></TableCell>
                <TableCell>{row.sessions}</TableCell>
                <TableCell>{row.average === null ? '—' : (row.average > 0 ? `+${round1(row.average)}` : String(round1(row.average)))}</TableCell>
                <TableCell>{row.sessions ? `${row.atOrAbove} of ${row.sessions}` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default GasSummaryTable;
