'use client';

import React, { useMemo } from 'react';
import type { Student } from '@/lib/types';
import { goalMeasure, withoutRunningTimers } from '@/lib/goal-measures';
import { isSampleGoal, sessionMatchesGoalUnit } from '@/lib/language-sample';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sigma, Percent, CheckCircle, XCircle, HelpCircle, Target } from 'lucide-react';
import StatTile from './StatTile';
import { summaryExplanations } from '@/lib/report-formulas';

interface DataSummaryProps {
  studentSessions: any[];
  selectedStudent?: Student;
  selectedGoalId?: string;
  chartData: any[];
}

const DataSummary: React.FC<DataSummaryProps> = ({ studentSessions, selectedStudent, selectedGoalId, chartData }) => {

  const selectedGoal = selectedGoalId ? selectedStudent?.goals.find(g => g.id === selectedGoalId) : undefined;
  const summaryStats = useMemo(() => {
    // With nothing charted (no goal in view was recorded in the sessions) the totals are 0, but the sessions held in the
    // range still count: the session count below does not come from the chart data.
    const rows = chartData ?? [];
    const totalCorrect = rows.reduce((acc, session) => acc + (session.correct || 0), 0);
    const totalIncorrect = rows.reduce((acc, session) => acc + (session.incorrect || 0), 0);
    const totalApproximate = rows.reduce((acc, session) => acc + (session.approximate || 0), 0);
    const totalOpportunities = rows.reduce((acc, session) => acc + (session.opportunities || 0), 0);
    
    const avgAccuracy = totalOpportunities > 0 ? (totalCorrect / totalOpportunities) * 100 : 0;

    return {
      // With one goal selected, the sessions where something was recorded for it.
      sessionCount: selectedGoal
        ? studentSessions.filter(session => {
            const raw = session.goals?.find((g: { goalId: string }) => g.goalId === selectedGoal.id)?.data;
            if (!raw) return false;
            const data = withoutRunningTimers(raw);
            if (isSampleGoal(selectedGoal) && !sessionMatchesGoalUnit(data, selectedGoal)) return false;
            return goalMeasure(selectedGoal, data) !== null;
          }).length
        : studentSessions.length,
      avgAccuracy: parseFloat(avgAccuracy.toFixed(1)),
      totalCorrect,
      totalIncorrect,
      totalApproximate,
      totalOpportunities,
    };
  }, [chartData, studentSessions, selectedGoal]);

  // How each figure is worked out, shown when it is tapped or hovered.
  const explain = summaryExplanations({
    correct: summaryStats.totalCorrect, incorrect: summaryStats.totalIncorrect,
    approximate: summaryStats.totalApproximate, opportunities: summaryStats.totalOpportunities,
  }, !!selectedGoal);
  const stats = [
    { label: 'Total Sessions', value: summaryStats.sessionCount, icon: Sigma, explanation: explain.sessions },
    // All trials pooled (each goal card shows its average per session). None for goals that aren't trial-based.
    { label: 'Overall Accuracy (all trials)', value: summaryStats.totalOpportunities > 0 ? `${summaryStats.avgAccuracy}%` : '—', icon: Percent, explanation: explain.accuracy },
    { label: 'Total Opportunities', value: summaryStats.totalOpportunities, icon: Target, explanation: explain.opportunities },
    { label: 'Total Correct', value: summaryStats.totalCorrect, icon: CheckCircle, color: 'text-green-500', explanation: explain.correct },
    { label: 'Total Incorrect', value: summaryStats.totalIncorrect, icon: XCircle, color: 'text-red-500', explanation: explain.incorrect },
    { label: 'Total Approximate', value: summaryStats.totalApproximate, icon: HelpCircle, color: 'text-yellow-500', explanation: explain.approximate },
  ];

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Data Summary</CardTitle>
        <CardDescription>
          A quantitative overview of the selected data for {selectedStudent?.name || 'the student'}. Tap a figure to see how it is worked out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          {stats.map(stat => (
            <StatTile key={stat.label} label={stat.label} value={stat.value} explanation={stat.explanation} className="p-4" valueClassName="text-2xl"
              icon={<stat.icon className={`h-6 w-6 mb-2 ${stat.color || 'text-primary'}`} aria-hidden />} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DataSummary;
