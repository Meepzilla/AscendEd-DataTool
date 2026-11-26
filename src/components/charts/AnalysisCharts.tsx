'use client';

import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { AlertTriangle, CalendarDays, CheckSquare, HandHelping, Target } from 'lucide-react';
import type { Student, SessionData, Goal } from '@/lib/types';
import { captureTypeOf } from '@/lib/goal-constants';
import { goalMeasure, goalResponses, withoutRunningTimers } from '@/lib/goal-measures';
import { GAS_LEVELS } from '@/lib/gas';
import { buildCombinedChartSeries } from '@/lib/report-chart-views';
import {
  readGoalChartView,
  readReportTab,
  readTimeGrouping,
  rememberGoalChartView,
  rememberReportTab,
  rememberTimeGrouping,
  REPORT_TAB_DESCRIPTIONS,
  REPORT_TAB_LABELS,
  TIME_GROUPING_LABELS,
  TIME_GROUPINGS,
  type GoalChartView,
  type ReportTab,
  type TimeGrouping,
} from '@/lib/report-filters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ViewModeToggle from './analysis-charts/ViewModeToggle';

// Lazy load individual chart sections so only the active tab's charts are loaded and sized
const GoalSummaryTable = lazy(() => import('./analysis-charts/GoalSummaryTable'));
const GoalCharts = lazy(() => import('./analysis-charts/GoalCharts'));
const GasTScoreLineChart = lazy(() => import('./analysis-charts/GasTScoreLineChart'));
const GasSummaryTable = lazy(() => import('./analysis-charts/GasSummaryTable'));
const PromptingOverview = lazy(() => import('./analysis-charts/PromptingOverview'));
const DataSummary = lazy(() => import('./analysis-charts/DataSummary'));
const GoalOutcomeComparison = lazy(() => import('./analysis-charts/GoalOutcomeComparison'));
const ProgressOverTimeChart = lazy(() => import('./analysis-charts/ProgressOverTimeChart'));
const ResponseCountsChart = lazy(() => import('./analysis-charts/ResponseCountsChart'));
const TrialStatusChart = lazy(() => import('./analysis-charts/TrialStatusChart'));
const SyllableFluencyChart = lazy(() => import('./analysis-charts/SyllableFluencyChart'));
const DysfluencyTypesChart = lazy(() => import('./analysis-charts/DysfluencyTypesChart'));
const AttendanceCard = lazy(() => import('./analysis-charts/AttendanceCard'));

const GAS_LEVEL_VALUES = GAS_LEVELS.map(info => info.level);
const GAS_LEVEL_LABELS: Record<number, string> = Object.fromEntries(GAS_LEVELS.map(info => [info.level, info.description]));

/** Recordings at each attainment level across the GAS goals in view (plain bars, no chart library). */
const GasLevelDistribution: React.FC<{ studentSessions: SessionData[]; goals: Goal[] }> = ({ studentSessions, goals }) => {
  const counts = useMemo(() => {
    const tally = new Map<number, number>(GAS_LEVEL_VALUES.map(l => [l, 0]));
    for (const session of studentSessions) {
      for (const goal of goals) {
        const data = (session.goals ?? []).find(g => g.goalId === goal.id)?.data;
        if (!data) continue;
        const value = goalMeasure(goal, withoutRunningTimers(data));
        if (value !== null && Number.isFinite(value) && tally.has(value)) tally.set(value, (tally.get(value) ?? 0) + 1);
      }
    }
    return GAS_LEVEL_VALUES.map(level => ({ level, count: tally.get(level) ?? 0 }));
  }, [studentSessions, goals]);
  const total = counts.reduce((a, r) => a + r.count, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attainment-level distribution</CardTitle>
        <CardDescription>
          Recorded levels across all GAS goals in view: each goal&apos;s level in each session counts once{total ? ` (${total} recorded ${total === 1 ? 'level' : 'levels'}).` : '.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No GAS levels recorded in the selected date range.</p>
        ) : counts.map(({ level, count }) => (
          <div key={level} className="flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0">{level > 0 ? `+${level}` : level} · {GAS_LEVEL_LABELS[level]}</span>
            <div className="h-4 flex-1 rounded bg-muted">
              <div className="h-4 rounded bg-primary" style={{ width: `${(count / total) * 100}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-muted-foreground">{count} ({Math.round((count / total) * 100)}%)</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export interface AnalysisChartsProps {
  /** Held sessions in the selected date range (oldest first). */
  studentSessions: SessionData[];
  /** All sessions in the selected date range, including missed sessions (for Attendance). */
  periodSessions?: SessionData[];
  /** All the student's held sessions, outside the date range too (GAS levels carry forward from before it). */
  studentHistory?: SessionData[];
  selectedStudent?: Student;
  selectedGoalId?: string;
  sessionsLoading: boolean;
  activeTab?: ReportTab;
  onTabChange?: (tab: ReportTab) => void;
}

const ChartSuspenseFallback = () => (
  <Card>
    <CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader>
    <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
  </Card>
);

const AnalysisCharts: React.FC<AnalysisChartsProps> = ({
  studentSessions,
  periodSessions,
  studentHistory,
  selectedStudent,
  selectedGoalId,
  sessionsLoading,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const allRangeSessions = periodSessions ?? studentSessions;

  const [internalTab, setInternalTab] = useState<ReportTab>('progress');
  const [grouping, setGrouping] = useState<TimeGrouping>('session');
  const [defaultGoalView, setDefaultGoalView] = useState<GoalChartView>('line');

  useEffect(() => {
    setInternalTab(readReportTab());
    setGrouping(readTimeGrouping());
    setDefaultGoalView(readGoalChartView());
  }, []);

  const currentTab = controlledTab ?? internalTab;
  const selectTab = (next: ReportTab) => {
    setInternalTab(next);
    rememberReportTab(next);
    onTabChange?.(next);
  };

  const selectGrouping = (next: TimeGrouping) => {
    setGrouping(next);
    rememberTimeGrouping(next);
  };

  const selectDefaultGoalView = (next: GoalChartView) => {
    rememberGoalChartView(next);
    setDefaultGoalView(next);
  };

  const activeStudentGoals = useMemo(
    () => selectedStudent?.goals.filter(g => !g.isArchived) || [],
    [selectedStudent],
  );

  const goalsInView = useMemo(
    () => activeStudentGoals.filter(g => !selectedGoalId || g.id === selectedGoalId),
    [activeStudentGoals, selectedGoalId],
  );

  const chartData = useMemo(
    () => buildCombinedChartSeries(studentSessions, selectedStudent?.goals || [], grouping, selectedGoalId),
    [studentSessions, selectedStudent?.goals, grouping, selectedGoalId],
  );

  const hasTrialGoals = useMemo(
    () => goalsInView.some(g => goalResponses(g) !== null),
    [goalsInView],
  );

  const hasFluencyData = useMemo(
    () => goalsInView.some(g => captureTypeOf(g) === 'FLUENCY_SYLLABLE_STUTTER') && chartData.some(d => d.totalSyllables > 0),
    [goalsInView, chartData],
  );

  const hasGasGoals = useMemo(
    () => goalsInView.some(g => captureTypeOf(g) === 'GOAL_ATTAINMENT_SCALE'),
    [goalsInView],
  );
  const gasGoals = useMemo(
    () => goalsInView.filter(g => captureTypeOf(g) === 'GOAL_ATTAINMENT_SCALE'),
    [goalsInView],
  );
  const allGasGoals = useMemo(
    () => activeStudentGoals.filter(g => captureTypeOf(g) === 'GOAL_ATTAINMENT_SCALE'),
    [activeStudentGoals],
  );

  if (sessionsLoading) {
    return <AnalysisReportChartsSkeleton />;
  }

  if (studentSessions.length === 0 && allRangeSessions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-500" />
          <p className="text-lg">
            No session data found for {selectedStudent?.name || 'the selected student'} within the selected date range.
          </p>
          <p>Try adjusting the filters or record new session data.</p>
        </CardContent>
      </Card>
    );
  }

  const onlyMissedInRange = studentSessions.length === 0 && allRangeSessions.length > 0;

  const missedOnlyNotice = (
    <Card>
      <CardContent className="p-8 text-center text-muted-foreground space-y-3">
        <AlertTriangle className="h-9 w-9 mx-auto text-amber-500" />
        <p className="text-base text-foreground font-medium">
          No held sessions in this date range ({allRangeSessions.length} missed {allRangeSessions.length === 1 ? 'session' : 'sessions'} recorded).
        </p>
        <p className="text-sm">
          Missed sessions aren&apos;t plotted on progress charts. Open Attendance to review them by month and on the calendar.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => selectTab('attendance')}>
          Open Attendance Tab
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Tabs value={currentTab} onValueChange={v => selectTab(v as ReportTab)} className="space-y-4">
      <div className="rounded-lg border bg-card p-3 shadow-sm space-y-2.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
            <TabsTrigger value="progress" className="min-h-9 gap-1.5">
              <Target className="h-4 w-4" aria-hidden />
              {REPORT_TAB_LABELS.progress}
            </TabsTrigger>
            <TabsTrigger value="prompts" className="min-h-9 gap-1.5">
              <HandHelping className="h-4 w-4" aria-hidden />
              {REPORT_TAB_LABELS.prompts}
            </TabsTrigger>
            <TabsTrigger value="trials" className="min-h-9 gap-1.5">
              <CheckSquare className="h-4 w-4" aria-hidden />
              {REPORT_TAB_LABELS.trials}
            </TabsTrigger>
            <TabsTrigger value="attendance" className="min-h-9 gap-1.5">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {REPORT_TAB_LABELS.attendance}
            </TabsTrigger>
          </TabsList>

          {currentTab !== 'attendance' && !onlyMissedInRange && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Group dates:</span>
              <ViewModeToggle
                label="Group chart dates by"
                value={grouping}
                onChange={selectGrouping}
                options={TIME_GROUPINGS.map(g => ({ value: g, label: TIME_GROUPING_LABELS[g] }))}
              />
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {REPORT_TAB_DESCRIPTIONS[currentTab]}
          {currentTab !== 'attendance' && grouping !== 'session' && (
            <span> · Charts are grouped <strong>{TIME_GROUPING_LABELS[grouping].toLowerCase()}</strong> to smooth day-to-day variation.</span>
          )}
        </p>
      </div>

      <TabsContent value="progress" className="mt-0 space-y-6">
        {onlyMissedInRange ? (
          missedOnlyNotice
        ) : (
          <>
            {!selectedGoalId && selectedStudent && goalsInView.length > 1 && (
              <Suspense fallback={<ChartSuspenseFallback />}>
                <GoalSummaryTable student={selectedStudent} goals={goalsInView} sessions={studentSessions} />
              </Suspense>
            )}

            {goalsInView.length > 0 && (
              <Suspense fallback={<ChartSuspenseFallback />}>
                {!selectedGoalId && (
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-semibold">Goal by Goal</h2>
                      <p className="text-sm text-muted-foreground">
                        Switch any goal between Line, Bars, and Table to inspect trends, target-meeting sessions, or exact numbers.
                      </p>
                    </div>
                  </div>
                )}
                <GoalCharts
                  studentSessions={studentSessions}
                  goals={goalsInView}
                  studentName={selectedStudent?.name}
                  studentIep={selectedStudent?.iep}
                  grouping={grouping}
                  defaultView={defaultGoalView}
                  onViewChange={selectDefaultGoalView}
                />
              </Suspense>
            )}

            {hasGasGoals && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Goal Attainment Scaling</h2>
                  <p className="text-sm text-muted-foreground">
                    Composite T-score across all GAS goals (50 = expected outcome) and attainment distribution.
                  </p>
                </div>
                <Suspense fallback={<ChartSuspenseFallback />}>
                  <GasTScoreLineChart sessions={studentSessions} history={studentHistory} goals={allGasGoals} />
                </Suspense>
                <Suspense fallback={<ChartSuspenseFallback />}>
                  <GasSummaryTable
                    sessions={studentSessions}
                    history={studentHistory}
                    goals={gasGoals}
                    tScoreGoals={allGasGoals}
                    studentName={selectedStudent?.name}
                    studentIep={selectedStudent?.iep}
                  />
                </Suspense>
                <GasLevelDistribution studentSessions={studentSessions} goals={gasGoals} />
              </div>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="prompts" className="mt-0 space-y-6">
        {onlyMissedInRange ? (
          missedOnlyNotice
        ) : (
          <Suspense fallback={<ChartSuspenseFallback />}>
            <PromptingOverview
              studentSessions={studentSessions}
              activeStudentGoals={activeStudentGoals}
              selectedGoalId={selectedGoalId}
              chartData={chartData}
              grouping={grouping}
            />
          </Suspense>
        )}
      </TabsContent>

      <TabsContent value="trials" className="mt-0 space-y-6">
        {onlyMissedInRange ? (
          missedOnlyNotice
        ) : (
          <>
            <Suspense fallback={<ChartSuspenseFallback />}>
              <DataSummary
                studentSessions={studentSessions}
                selectedStudent={selectedStudent}
                selectedGoalId={selectedGoalId}
                chartData={chartData}
              />
            </Suspense>

            {!hasTrialGoals && !hasFluencyData ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground space-y-2">
                  <p className="font-medium text-foreground">
                    {selectedGoalId
                      ? 'This goal is not scored with discrete correct/incorrect trials.'
                      : 'No trial-based or syllable-fluency goals are active for this student.'}
                  </p>
                  <p>
                    Goals measured by ratings, occurrences, duration, steps, language samples, or GAS levels show their own tailored charts on the <strong>Goal Progress</strong> tab.
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={() => selectTab('progress')}>
                    View Goal Progress
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {hasTrialGoals && (
                  <>
                    <Suspense fallback={<ChartSuspenseFallback />}>
                      <GoalOutcomeComparison
                        studentSessions={studentSessions}
                        activeStudentGoals={activeStudentGoals}
                        selectedGoalId={selectedGoalId}
                      />
                    </Suspense>
                    <Suspense fallback={<ChartSuspenseFallback />}>
                      <ProgressOverTimeChart
                        chartData={chartData}
                        selectedGoalId={selectedGoalId}
                        activeStudentGoals={activeStudentGoals}
                        grouping={grouping}
                      />
                    </Suspense>
                    <Suspense fallback={<ChartSuspenseFallback />}>
                      <ResponseCountsChart
                        chartData={chartData}
                        selectedGoalId={selectedGoalId}
                        activeStudentGoals={activeStudentGoals}
                        grouping={grouping}
                      />
                    </Suspense>
                    <Suspense fallback={<ChartSuspenseFallback />}>
                      <TrialStatusChart
                        studentSessions={studentSessions}
                        selectedStudent={selectedStudent}
                        selectedGoalId={selectedGoalId}
                      />
                    </Suspense>
                  </>
                )}

                {hasFluencyData && (
                  <>
                    <Suspense fallback={<ChartSuspenseFallback />}>
                      <SyllableFluencyChart chartData={chartData} grouping={grouping} />
                    </Suspense>
                    <Suspense fallback={<ChartSuspenseFallback />}>
                      <DysfluencyTypesChart chartData={chartData} grouping={grouping} />
                    </Suspense>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="attendance" className="mt-0 space-y-6">
        <Suspense fallback={<ChartSuspenseFallback />}>
          <AttendanceCard sessions={allRangeSessions} />
        </Suspense>
      </TabsContent>
    </Tabs>
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
