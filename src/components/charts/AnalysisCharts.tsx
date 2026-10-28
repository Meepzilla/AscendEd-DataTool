
'use client';

import React, { useState, useMemo, lazy, Suspense } from 'react';
import type { Student, SessionData, Goal, PromptType, GoalType, TrialStatus } from '@/lib/types';
import { scoreStory, summarizeCommunicationFunctions } from '@/lib/goal-constants';
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
      
      let currentGoalCorrect = 0, currentGoalIncorrect = 0, currentGoalApproximate = 0;
      const data = { ...(goalData.data || {}) };

      switch (goalData.goalType) {
        case 'ARTICULATION':
        case 'LANGUAGE_COMPREHENSION':
        case 'LANGUAGE_EXPRESSION':
        case 'PHONOLOGICAL_PROCESSES':
        case 'AAC':
            currentGoalCorrect = Number(data.correct || data.questionsCorrect || data.successfulResponses || data.correctProductions || 0);
            currentGoalIncorrect = Number(data.incorrect || data.questionsIncorrect || data.unsuccessfulResponses || data.incorrectProductions || 0);
            currentGoalApproximate = Number(data.approximate) || 0;
            break;
        case 'DISCRETE_TRIALS':
             if (Array.isArray(data.trials)) {
                currentGoalCorrect = data.trials.filter((t: TrialStatus) => t === 'correct').length;
                currentGoalIncorrect = data.trials.filter((t: TrialStatus) => t === 'incorrect').length;
                currentGoalApproximate = data.trials.filter((t: TrialStatus) => t === 'approximate').length;
            }
            break;
        case 'SEQUENCED_TRIALS':
            currentGoalCorrect = Number(data.successfulAttempts || 0);
            currentGoalIncorrect = Number(data.failedAttempts || 0);
            currentGoalApproximate = Number(data.approximate || 0);
            break;
        case 'FLUENCY_SYLLABLE_STUTTER':
            const currentTotalSyllables = Number(data.totalSyllables) || 0;
            const currentStutteredSyllables = Number(data.stutteredSyllables) || 0;
            currentGoalCorrect = Math.max(0, currentTotalSyllables - currentStutteredSyllables);
            currentGoalIncorrect = currentStutteredSyllables;
            day.totalSyllables += currentTotalSyllables;
            day.stutteredSyllables += currentStutteredSyllables;
            day.blocks += Number(data.blocks) || 0;
            day.repetitions += Number(data.repetitions) || 0;
            day.prolongations += Number(data.prolongations) || 0;
            day.interjections += Number(data.interjections) || 0;
            break;
        case 'FEEDING_SWALLOWING':
            currentGoalCorrect = Number(data.trialsAccepted) || 0;
            currentGoalIncorrect = Number(data.trialsRefused) || 0;
            break;
        case 'STORY_CHAMPS': {
            // Story grammar points earned vs. missed.
            const story = scoreStory(data);
            currentGoalCorrect = story.points;
            currentGoalIncorrect = story.maxPoints - story.points;
            break;
        }
        case 'COMMUNICATION_FUNCTIONS': {
            // Spontaneous uses count as correct, prompted uses as approximate.
            const summary = summarizeCommunicationFunctions(data);
            currentGoalCorrect = summary.spontaneous;
            currentGoalApproximate = summary.prompted;
            break;
        }
      }
      
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

  return (
    <div className="space-y-6">
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
