'use client';

import React, { useState, useMemo, lazy, Suspense } from 'react';
import type { Student, SessionData, Goal, PromptType, GoalType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';

// Lazy load the individual chart components
const ProgressOverTimeChart = lazy(() => import('./analysis-charts/ProgressOverTimeChart'));
const ResponseCountsChart = lazy(() => import('./analysis-charts/ResponseCountsChart'));
const OpportunitiesChart = lazy(() => import('./analysis-charts/OpportunitiesChart'));
const PerformanceScatterPlot = lazy(() => import('./analysis-charts/PerformanceScatterPlot'));
const PromptUsageChart = lazy(() => import('./analysis-charts/PromptUsageChart'));
const GoalPerformanceSankey = lazy(() => import('./analysis-charts/GoalPerformanceSankey'));
const AiSummary = lazy(() => import('./analysis-charts/AiSummary'));


// Helper to transform session data for charts
const transformSessionDataForChart = (sessions: SessionData[], studentGoals: Goal[], selectedGoalId?: string) => {
  return sessions.map(session => {
    let sessionCorrect = 0;
    let sessionIncorrect = 0;
    let sessionOpportunities = 0;
    let promptCounts: Record<PromptType, number> = {
        'Independent': 0, 'Visual': 0, 'Verbal': 0, 'Gestural': 0, 'PartialPhysical': 0, 'Imitation': 0
    };

    session.goals.forEach(goalData => {
      const currentGoal = studentGoals.find(g => g.id === goalData.goalId);
      if (currentGoal?.isArchived) return;
      if (selectedGoalId && goalData.goalId !== selectedGoalId) return;

      let currentGoalCorrect = 0;
      let currentGoalIncorrect = 0;
      let currentGoalOpportunities = 0;

      switch (goalData.goalType) {
        case 'ARTICULATION':
            currentGoalCorrect = Number(goalData.data.correct) || 0;
            currentGoalIncorrect = Number(goalData.data.incorrect) || 0;
            break;
        case 'LANGUAGE_COMPREHENSION':
            currentGoalCorrect = Number(goalData.data.questionsCorrect) || 0;
            currentGoalIncorrect = Number(goalData.data.questionsIncorrect) || 0;
            break;
        case 'LANGUAGE_EXPRESSION':
            currentGoalCorrect = Number(goalData.data.successfulResponses) || 0;
            currentGoalIncorrect = Number(goalData.data.unsuccessfulResponses) || 0;
            break;
        case 'PHONOLOGICAL_PROCESSES':
            currentGoalCorrect = Number(goalData.data.correctProductions) || 0;
            currentGoalIncorrect = Number(goalData.data.incorrectProductions) || 0;
            break;
        case 'FLUENCY_SYLLABLE_STUTTER':
            const totalSyllables = Number(goalData.data.totalSyllables) || 0;
            const stutteredSyllables = Number(goalData.data.stutteredSyllables) || 0;
            currentGoalCorrect = Math.max(0, totalSyllables - stutteredSyllables);
            currentGoalIncorrect = stutteredSyllables;
            break;
        case 'FEEDING_SWALLOWING':
            currentGoalCorrect = Number(goalData.data.trialsAccepted) || 0;
            currentGoalIncorrect = Number(goalData.data.trialsRefused) || 0;
            break;
        case 'SEQUENCED_TRIALS':
            currentGoalCorrect = Number(goalData.data.successfulAttempts) || 0;
            currentGoalIncorrect = Number(goalData.data.failedAttempts) || 0;
            break;
      }
      
      currentGoalOpportunities = currentGoalCorrect + currentGoalIncorrect;
      sessionCorrect += currentGoalCorrect;
      sessionIncorrect += currentGoalIncorrect;
      sessionOpportunities += currentGoalOpportunities;

      Object.keys(promptCounts).forEach(pt => {
        const key = pt as PromptType;
        if (goalData.data[key] && typeof goalData.data[key] === 'number') {
          promptCounts[key] = (promptCounts[key] || 0) + (Number(goalData.data[key]) || 0);
        }
      });
    });

    const accuracy = sessionOpportunities > 0 ? (sessionCorrect / sessionOpportunities) * 100 : 0;
    const totalPrompts = Object.entries(promptCounts).reduce((sum, [key, value]) => key !== 'Independent' ? sum + value : sum, 0);

    return {
      date: new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      accuracy: parseFloat(accuracy.toFixed(1)),
      correct: sessionCorrect,
      incorrect: sessionIncorrect,
      opportunities: sessionOpportunities,
      totalPrompts: totalPrompts,
      ...promptCounts,
    };
  });
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
  
  const hasPromptUsageData = useMemo(() => {
    return chartData.some(session => Object.keys(session).some(key => key !== 'totalPrompts' && key !== 'Independent' && session[key as PromptType] > 0));
  }, [chartData]);

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

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Suspense fallback={<ChartSuspenseFallback />}>
                <ProgressOverTimeChart chartData={chartData} selectedGoalId={selectedGoalId} activeStudentGoals={activeStudentGoals} />
            </Suspense>
            <Suspense fallback={<ChartSuspenseFallback />}>
                <ResponseCountsChart chartData={chartData} selectedGoalId={selectedGoalId} activeStudentGoals={activeStudentGoals} />
            </Suspense>
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
        </div>
        
        <Suspense fallback={<ChartSuspenseFallback />}>
            <GoalPerformanceSankey studentSessions={studentSessions} activeStudentGoals={activeStudentGoals} selectedGoalId={selectedGoalId} />
        </Suspense>

        <Suspense fallback={<ChartSuspenseFallback />}>
            <AiSummary studentSessions={studentSessions} selectedStudent={selectedStudent} selectedGoalId={selectedGoalId} chartData={chartData} />
        </Suspense>
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
