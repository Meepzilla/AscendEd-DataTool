
'use client';

import React, { useState, useMemo, lazy, Suspense } from 'react';
import type { Student, SessionData, Goal, PromptType } from '@/lib/types';
import { BEHAVIOR_GOAL_TYPES } from '@/lib/goal-constants';
import { goalResponses } from '@/lib/goal-measures';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';
import { AI_ENABLED } from '@/lib/features';

// Lazy load the individual chart components
const ProgressOverTimeChart = lazy(() => import('./analysis-charts/ProgressOverTimeChart'));
const ResponseCountsChart = lazy(() => import('./analysis-charts/ResponseCountsChart'));
const OpportunitiesChart = lazy(() => import('./analysis-charts/OpportunitiesChart'));
const PerformanceScatterPlot = lazy(() => import('./analysis-charts/PerformanceScatterPlot'));
const PromptUsageChart = lazy(() => import('./analysis-charts/PromptUsageChart'));
const GoalPerformanceSankey = lazy(() => import('./analysis-charts/GoalPerformanceSankey'));
const AiSummary = lazy(() => import('./analysis-charts/AiSummary'));
const SyllableFluencyChart = lazy(() => import('./analysis-charts/SyllableFluencyChart'));
const DysfluencyTypesChart = lazy(() => import('./analysis-charts/DysfluencyTypesChart'));
const DataSummary = lazy(() => import('./analysis-charts/DataSummary'));
const GoalCharts = lazy(() => import('./analysis-charts/GoalCharts'));


// Helper to transform session data for charts
const transformSessionDataForChart = (sessions: SessionData[], studentGoals: Goal[], selectedGoalId?: string) => {
  const dailyData: Record<string, any> = {};

  sessions.forEach(session => {
    const sessionDate = new Date(session.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (!dailyData[sessionDate]) {
      dailyData[sessionDate] = {
        date: new Date(sessionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sessionCount: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        totalApproximate: 0,
        totalOpportunities: 0,
        totalPrompts: 0,
        promptCounts: { 'Independent': 0, 'Visual': 0, 'Verbal': 0, 'Gestural': 0, 'PartialPhysical': 0, 'Imitation': 0 },
        totalSyllables: 0,
        stutteredSyllables: 0,
        blocks: 0,
        repetitions: 0,
        prolongations: 0,
        interjections: 0,
      };
    }
    
    const day = dailyData[sessionDate];
    day.sessionCount += 1;

    session.goals.forEach(goalData => {
      const currentGoal = studentGoals.find(g => g.id === goalData.goalId);
      if (currentGoal?.isArchived) return;
      if (selectedGoalId && goalData.goalId !== selectedGoalId) return;
      
      const data = { ...(goalData.data || {}) };

      if (goalData.goalType === 'FLUENCY_SYLLABLE_STUTTER') {
          // Syllable counts feed the fluency charts, not the response totals.
          day.totalSyllables += Number(data.totalSyllables) || 0;
          day.stutteredSyllables += Number(data.stutteredSyllables) || 0;
          day.blocks += Number(data.blocks) || 0;
          day.repetitions += Number(data.repetitions) || 0;
          day.prolongations += Number(data.prolongations) || 0;
          day.interjections += Number(data.interjections) || 0;
      }

      // Response totals and accuracy count only trial-based goals (correct / incorrect / approximate
      // responses). Other goal types are measured differently (story points, functions, syllables,
      // ratings, behavior counts) and are reported on their own cards, so counting their points as
      // "opportunities" or "incorrect" would inflate the totals.
      const responses = goalResponses(goalData.goalType, data);
      const currentGoalCorrect = responses?.correct ?? 0;
      const currentGoalIncorrect = responses?.incorrect ?? 0;
      const currentGoalApproximate = responses?.approximate ?? 0;

      day.totalCorrect += currentGoalCorrect;
      day.totalIncorrect += currentGoalIncorrect;
      day.totalApproximate += currentGoalApproximate;
      day.totalOpportunities += currentGoalCorrect + currentGoalIncorrect + currentGoalApproximate;

      Object.keys(day.promptCounts).forEach(pt => {
        const key = pt as PromptType;
        if (data[key] && typeof data[key] === 'number') {
          day.promptCounts[key] += Number(data[key]);
        }
      });
    });
  });

  return Object.values(dailyData).map(day => {
    const accuracy = day.totalOpportunities > 0 ? (day.totalCorrect / day.totalOpportunities) * 100 : 0;
    const totalPrompts = Object.entries(day.promptCounts).reduce((sum, [key, value]) => key !== 'Independent' ? sum + (value as number) : sum, 0);
    return {
      date: day.date,
      accuracy: parseFloat(accuracy.toFixed(1)),
      correct: day.totalCorrect,
      incorrect: day.totalIncorrect,
      approximate: day.totalApproximate,
      opportunities: day.totalOpportunities,
      totalPrompts: totalPrompts,
      ...day.promptCounts,
      totalSyllables: day.totalSyllables,
      stutteredSyllables: day.stutteredSyllables,
      blocks: day.blocks,
      repetitions: day.repetitions,
      prolongations: day.prolongations,
      interjections: day.interjections,
    };
  }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export interface AnalysisChartsProps {
  studentSessions: SessionData[];
  selectedStudent?: Student;
  selectedGoalId?: string;
  sessionsLoading: boolean;
}

const ChartSuspenseFallback = () => (
    <Card>
        <CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
    </Card>
);

const AnalysisCharts: React.FC<AnalysisChartsProps> = ({ studentSessions, selectedStudent, selectedGoalId, sessionsLoading }) => {
  
  const activeStudentGoals = useMemo(() => selectedStudent?.goals.filter(g => !g.isArchived) || [], [selectedStudent]);
  const chartData = useMemo(() => transformSessionDataForChart(studentSessions, selectedStudent?.goals || [], selectedGoalId), [studentSessions, selectedStudent?.goals, selectedGoalId]);
  
  // Every goal also gets its own card, charted by its own measure against its target. Behavior goals are
  // measured in counts, minutes, % or seconds, so the accuracy overview is hidden when only they are in view.
  const goalsInView = useMemo(
    () => activeStudentGoals.filter(g => !selectedGoalId || g.id === selectedGoalId),
    [activeStudentGoals, selectedGoalId],
  );
  const behaviorOnly = goalsInView.length > 0 && goalsInView.every(g => BEHAVIOR_GOAL_TYPES.includes(g.type));

  const hasPromptUsageData = useMemo(() => {
    return chartData.some(session => Object.keys(session).some(key => key !== 'totalPrompts' && key !== 'Independent' && session[key as keyof typeof session] > 0));
  }, [chartData]);
  
  const hasFluencyData = useMemo(() => {
    if (selectedGoalId) {
        return activeStudentGoals.some(g => g.id === selectedGoalId && g.type === 'FLUENCY_SYLLABLE_STUTTER');
    }
    return activeStudentGoals.some(g => g.type === 'FLUENCY_SYLLABLE_STUTTER');
  }, [activeStudentGoals, selectedGoalId]);


  if (sessionsLoading) {
    return <AnalysisReportChartsSkeleton />;
  }
  if (studentSessions.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground">
        <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-500"/><p className="text-lg">No session data found for {selectedStudent?.name || 'the selected student'} within the selected date range.</p><p>Try adjusting the filters or record new session data.</p>
      </CardContent></Card>
    );
  }

  const goalCharts = goalsInView.length > 0 && (
    <Suspense fallback={<ChartSuspenseFallback />}>
      {!selectedGoalId && <h2 className="text-xl font-semibold">Goal by Goal</h2>}
      <GoalCharts studentSessions={studentSessions} goals={goalsInView} />
    </Suspense>
  );

  if (behaviorOnly) {
    return (
      <div className="space-y-6">
        <Suspense fallback={<ChartSuspenseFallback />}>
          {AI_ENABLED && <AiSummary studentSessions={studentSessions} selectedStudent={selectedStudent} selectedGoalId={selectedGoalId} chartData={chartData} />}
        </Suspense>
        {goalCharts}
      </div>
    );
  }

  return (
    <div className="space-y-6">
       {selectedGoalId && goalCharts}
       <Suspense fallback={<ChartSuspenseFallback />}>
            <DataSummary studentSessions={studentSessions} selectedStudent={selectedStudent} selectedGoalId={selectedGoalId} chartData={chartData} />
       </Suspense>
       <Suspense fallback={<ChartSuspenseFallback />}>
            {AI_ENABLED && <AiSummary studentSessions={studentSessions} selectedStudent={selectedStudent} selectedGoalId={selectedGoalId} chartData={chartData} />}
        </Suspense>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<ChartSuspenseFallback />}>
          <ProgressOverTimeChart chartData={chartData} selectedGoalId={selectedGoalId} activeStudentGoals={activeStudentGoals} />
        </Suspense>
        <Suspense fallback={<ChartSuspenseFallback />}>
          <ResponseCountsChart chartData={chartData} selectedGoalId={selectedGoalId} activeStudentGoals={activeStudentGoals} />
        </Suspense>
        {hasFluencyData && (
          <>
            <Suspense fallback={<ChartSuspenseFallback />}>
                <SyllableFluencyChart chartData={chartData} />
            </Suspense>
            <Suspense fallback={<ChartSuspenseFallback />}>
                <DysfluencyTypesChart chartData={chartData} />
            </Suspense>
          </>
        )}
        <Suspense fallback={<ChartSuspenseFallback />}>
          <OpportunitiesChart chartData={chartData} selectedGoalId={selectedGoalId} activeStudentGoals={activeStudentGoals} />
        </Suspense>
        <Suspense fallback={<ChartSuspenseFallback />}>
          <PerformanceScatterPlot chartData={chartData} />
        </Suspense>
        {hasPromptUsageData && (
          <Suspense fallback={<ChartSuspenseFallback />}>
            <div className="lg:col-span-2">
              <PromptUsageChart chartData={chartData} />
            </div>
          </Suspense>
        )}
        <Suspense fallback={<ChartSuspenseFallback />}>
            <GoalPerformanceSankey studentSessions={studentSessions} activeStudentGoals={activeStudentGoals} selectedGoalId={selectedGoalId} />
        </Suspense>
       
      </div>
      {!selectedGoalId && goalCharts}
    </div>
  );
};

export function AnalysisReportChartsSkeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSuspenseFallback />
            <ChartSuspenseFallback />
            <ChartSuspenseFallback />
            <ChartSuspenseFallback />
        </div>
    );
}

export default AnalysisCharts;
