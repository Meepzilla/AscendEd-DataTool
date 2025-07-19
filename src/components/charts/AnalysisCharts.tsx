
'use client';

import React, { useState, useMemo } from 'react';
import type { Student, SessionData, Goal, PromptType, GoalType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, Lightbulb, MessageSquare, TrendingUp, AlertTriangle, Workflow, Shuffle, BarChart2 } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, LineChart, Line, Sankey, Tooltip as RechartsTooltip, ScatterChart, Scatter } from 'recharts';
import { generateTechnicalSummary } from '@/ai/flows/technical-summary-generation';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PROMPT_COLORS, PROMPT_TYPES } from '@/lib/promptConstants';
import { formatDate } from '@/lib/helpers';
import { useErrorLog } from '@/hooks/use-error-log';

// Helper to transform session data for charts
const transformSessionDataForChart = (sessions: SessionData[], studentGoals: Goal[], selectedGoalId?: string) => {
  return sessions.map(session => {
    let sessionCorrect = 0;
    let sessionIncorrect = 0;
    let sessionOpportunities = 0;
    let promptCounts: Record<PromptType, number> = PROMPT_TYPES.reduce((acc, pt) => ({ ...acc, [pt]: 0 }), {} as Record<PromptType, number>);

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
          currentGoalOpportunities = currentGoalCorrect + currentGoalIncorrect;
          break;
        case 'LANGUAGE_COMPREHENSION':
          currentGoalCorrect = Number(goalData.data.questionsCorrect) || 0;
          currentGoalIncorrect = Number(goalData.data.questionsIncorrect) || 0;
          currentGoalOpportunities = currentGoalCorrect + currentGoalIncorrect;
          break;
        case 'LANGUAGE_EXPRESSION':
          currentGoalCorrect = Number(goalData.data.successfulResponses) || 0;
          currentGoalIncorrect = Number(goalData.data.unsuccessfulResponses) || 0;
          currentGoalOpportunities = currentGoalCorrect + currentGoalIncorrect;
          break;
        case 'PHONOLOGICAL_PROCESSES':
          currentGoalCorrect = Number(goalData.data.correctProductions) || 0;
          currentGoalIncorrect = Number(goalData.data.incorrectProductions) || 0;
          currentGoalOpportunities = currentGoalCorrect + currentGoalIncorrect;
          break;
        case 'FLUENCY_SYLLABLE_STUTTER':
          const totalSyllables = Number(goalData.data.totalSyllables) || 0;
          const stutteredSyllables = Number(goalData.data.stutteredSyllables) || 0;
          currentGoalOpportunities = totalSyllables;
          currentGoalCorrect = Math.max(0, totalSyllables - stutteredSyllables);
          currentGoalIncorrect = stutteredSyllables;
          break;
        case 'FEEDING_SWALLOWING':
          currentGoalCorrect = Number(goalData.data.trialsAccepted) || 0;
          currentGoalIncorrect = Number(goalData.data.trialsRefused) || 0;
          currentGoalOpportunities = currentGoalCorrect + currentGoalIncorrect;
          break;
        case 'SEQUENCED_TRIALS':
          currentGoalCorrect = Number(goalData.data.successfulAttempts) || 0;
          currentGoalIncorrect = Number(goalData.data.failedAttempts) || 0;
          currentGoalOpportunities = currentCorrect + currentIncorrect;
          break;
        default:
          break;
      }

      sessionCorrect += currentGoalCorrect;
      sessionIncorrect += currentGoalIncorrect;
      sessionOpportunities += currentGoalOpportunities;
      
      PROMPT_TYPES.forEach(pt => {
        if (goalData.data[pt] && typeof goalData.data[pt] === 'number') {
          promptCounts[pt] = (promptCounts[pt] || 0) + (Number(goalData.data[pt]) || 0);
        }
      });
    });
    
    const accuracy = sessionOpportunities > 0 ? (sessionCorrect / sessionOpportunities) * 100 : 0;
    
    const totalPrompts = PROMPT_TYPES.reduce((sum, pt) => {
        if (pt !== 'Independent' && promptCounts[pt]) {
            return sum + (promptCounts[pt] as number);
        }
        return sum;
    }, 0);

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

interface SankeyNode { name: string; color?: string; }
interface SankeyLink { source: number; target: number; value: number; }
interface SankeyData { nodes: SankeyNode[]; links: SankeyLink[]; }

const transformDataForSankeyChart = (sessions: SessionData[], studentActiveGoals: Goal[]): SankeyData => {
  const rawNodes: SankeyNode[] = [];
  const rawLinks: { source: string; target: string; value: number }[] = [];
  const nodeMap: Record<string, number> = {};

  const addRawNode = (name: string, color?: string): void => {
    if (nodeMap[name] === undefined) {
      nodeMap[name] = rawNodes.length;
      rawNodes.push({ name, color });
    } else if (color && !rawNodes[nodeMap[name]].color) {
      rawNodes[nodeMap[name]].color = color;
    }
  };
  
  const aggregatedGoalStats: Record<string, { opportunities: number; correct: number; incorrect: number; name: string; type: GoalType; }> = {};

  sessions.forEach(session => {
    session.goals.forEach(goalDataEntry => {
      const originalGoal = studentActiveGoals.find(g => g.id === goalDataEntry.goalId);
      if (!originalGoal || originalGoal.isArchived) return;

      if (!aggregatedGoalStats[originalGoal.id]) {
        aggregatedGoalStats[originalGoal.id] = { opportunities: 0, correct: 0, incorrect: 0, name: originalGoal.name, type: originalGoal.type, };
      }

      let currentCorrect = 0, currentIncorrect = 0, currentOpportunities = 0;
      switch (originalGoal.type) {
        case 'ARTICULATION': currentCorrect = Number(goalDataEntry.data.correct) || 0; currentIncorrect = Number(goalDataEntry.data.incorrect) || 0; currentOpportunities = currentCorrect + currentIncorrect; break;
        case 'LANGUAGE_COMPREHENSION': currentCorrect = Number(goalDataEntry.data.questionsCorrect) || 0; currentIncorrect = Number(goalDataEntry.data.questionsIncorrect) || 0; currentOpportunities = currentCorrect + currentIncorrect; break;
        case 'LANGUAGE_EXPRESSION': currentCorrect = Number(goalDataEntry.data.successfulResponses) || 0; currentIncorrect = Number(goalDataEntry.data.unsuccessfulResponses) || 0; currentOpportunities = currentCorrect + currentIncorrect; break;
        case 'PHONOLOGICAL_PROCESSES': currentCorrect = Number(goalDataEntry.data.correctProductions) || 0; currentIncorrect = Number(goalDataEntry.data.incorrectProductions) || 0; currentOpportunities = currentCorrect + currentIncorrect; break;
        case 'FLUENCY_SYLLABLE_STUTTER': const totalSyllables = Number(goalDataEntry.data.totalSyllables) || 0; const stutteredSyllables = Number(goalDataEntry.data.stutteredSyllables) || 0; currentOpportunities = totalSyllables; currentCorrect = Math.max(0, totalSyllables - stutteredSyllables); currentIncorrect = stutteredSyllables; break;
        case 'FEEDING_SWALLOWING': currentCorrect = Number(goalDataEntry.data.trialsAccepted) || 0; currentIncorrect = Number(goalDataEntry.data.trialsRefused) || 0; currentOpportunities = currentCorrect + currentIncorrect; break;
        case 'SEQUENCED_TRIALS': currentCorrect = Number(goalDataEntry.data.successfulAttempts) || 0; currentIncorrect = Number(goalDataEntry.data.failedAttempts) || 0; currentOpportunities = currentCorrect + currentIncorrect; break;
        default: return;
      }
      aggregatedGoalStats[originalGoal.id].opportunities += currentOpportunities;
      aggregatedGoalStats[originalGoal.id].correct += currentCorrect;
      aggregatedGoalStats[originalGoal.id].incorrect += currentIncorrect;
    });
  });

  const correctOutcomeNodeName = "Correct Outcomes", incorrectOutcomeNodeName = "Incorrect Outcomes";
  addRawNode(correctOutcomeNodeName, 'hsl(var(--chart-2))');
  addRawNode(incorrectOutcomeNodeName, 'hsl(var(--chart-5))');

  const goalTypeNodeNames: Set<string> = new Set();
  Object.values(aggregatedGoalStats).forEach(stats => {
    if (stats.opportunities > 0) {
      goalTypeNodeNames.add(stats.type);
      addRawNode(stats.name, 'hsl(var(--chart-4))');
    }
  });
  goalTypeNodeNames.forEach(type => addRawNode(type, 'hsl(var(--chart-1))'));

  Object.values(aggregatedGoalStats).forEach(stats => {
    if (stats.opportunities <= 0) return;
    rawLinks.push({ source: stats.type, target: stats.name, value: stats.opportunities });
    if (stats.correct > 0) rawLinks.push({ source: stats.name, target: correctOutcomeNodeName, value: stats.correct });
    if (stats.incorrect > 0) rawLinks.push({ source: stats.name, target: incorrectOutcomeNodeName, value: stats.incorrect });
  });
  
  const linkedNodeNames = new Set<string>();
  rawLinks.forEach(link => { linkedNodeNames.add(link.source); linkedNodeNames.add(link.target); });
  const finalNodes: SankeyNode[] = rawNodes.filter(node => linkedNodeNames.has(node.name));
  const finalNodeMap: Record<string, number> = {};
  finalNodes.forEach((node, index) => { finalNodeMap[node.name] = index; });
  const finalLinks: SankeyLink[] = rawLinks.filter(link => finalNodeMap[link.source] !== undefined && finalNodeMap[link.target] !== undefined).map(link => ({ source: finalNodeMap[link.source], target: finalNodeMap[link.target], value: link.value, }));

  return { nodes: finalNodes, links: finalLinks };
};

const CustomSankeyNode = ({ x, y, width, height, index, payload, containerWidth }: any) => {
  if (!payload || typeof payload.name === 'undefined') return null;

  const nodeName = String(payload.name);
  const nodeValue = payload.value !== undefined ? ` (${payload.value.toLocaleString()})` : '';
  const nodeLabel = `${nodeName}${nodeValue}`;
  const textFill = 'hsl(var(--foreground))';

  // Robust check for first, middle, and last columns
  const isFirstColumn = payload.depth === 0;
  const isLastColumn = payload.sourceLinks.length === 0;
  const isMiddleColumn = !isFirstColumn && !isLastColumn;

  let textAnchor = 'start';
  let textX = width + 6; // Default to right of the node

  if (isFirstColumn) {
      textAnchor = 'end';
      textX = -6;
  } else if (isLastColumn) {
      textAnchor = 'start';
      textX = width + 6;
  } else { // Middle column
      textAnchor = 'middle';
      textX = width / 2;
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <rect height={height} width={width} fill={payload.color || "hsl(var(--muted))"} strokeWidth="0" rx="2" ry="2"/>
      <text x={textX} y={height / 2} textAnchor={textAnchor} dominantBaseline="middle" fill={textFill} fontSize="12">
        {nodeLabel}
      </text>
    </g>
  );
};

export interface AnalysisChartsProps {
  studentSessions: SessionData[];
  selectedStudent?: Student;
  selectedGoalId?: string;
  sessionsLoading: boolean;
}

const AnalysisCharts: React.FC<AnalysisChartsProps> = ({ studentSessions, selectedStudent, selectedGoalId, sessionsLoading }) => {
  const [technicalSummary, setTechnicalSummary] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();
  const { addErrorLog } = useErrorLog();
  
  const activeStudentGoals = useMemo(() => selectedStudent?.goals.filter(g => !g.isArchived) || [], [selectedStudent]);
  const chartData = useMemo(() => transformSessionDataForChart(studentSessions, selectedStudent?.goals || [], selectedGoalId), [studentSessions, selectedStudent?.goals, selectedGoalId]);
  const promptUsageData = useMemo(() => {
    const aggregatedPrompts: Record<PromptType, number> = Object.fromEntries(PROMPT_TYPES.map(pt => [pt, 0])) as Record<PromptType, number>;
    chartData.forEach(session => { PROMPT_TYPES.forEach(pt => { if(session[pt]) aggregatedPrompts[pt] += session[pt] as number; }); });
    return Object.entries(aggregatedPrompts).map(([name, value]) => ({ name: name as PromptType, value, fill: PROMPT_COLORS[name as PromptType] })).filter(item => item.value > 0); 
  }, [chartData]);
  const sankeyData = useMemo(() => {
    if (!selectedStudent || studentSessions.length === 0 || activeStudentGoals.length === 0) return { nodes: [], links: [] };
    const goalsForSankey = selectedGoalId ? activeStudentGoals.filter(g => g.id === selectedGoalId) : activeStudentGoals;
    return transformDataForSankeyChart(studentSessions, goalsForSankey);
  }, [studentSessions, activeStudentGoals, selectedStudent, selectedGoalId]);
  
  const accuracyChartConfig = { accuracy: { label: 'Accuracy (%)', color: 'hsl(var(--primary))' } } as const;
  const responseCountsChartConfig = { correct: { label: 'Correct', color: 'hsl(var(--chart-2))' }, incorrect: { label: 'Incorrect', color: 'hsl(var(--chart-5))' } } as const;
  const opportunitiesChartConfig = { opportunities: { label: 'Opportunities', color: 'hsl(var(--chart-1))' } } as const;
  const scatterPlotConfig = { session: { label: 'Session Performance', color: 'hsl(var(--chart-3))' } } as const;
  const promptChartConfig = PROMPT_TYPES.reduce((config, pt) => { config[pt] = { label: pt.replace(/([A-Z])/g, ' $1').trim(), color: PROMPT_COLORS[pt] }; return config; }, {} as Record<PromptType, { label: string; color: string }>);

  const handleGenerateSummary = async () => {
    if (!selectedStudent || studentSessions.length === 0) { toast({ title: "Info", description: "Select a student with session data to generate a summary.", variant: "default" }); return; }
    setIsAiLoading(true); setTechnicalSummary(null);
    try {
      const progressDataPoints = studentSessions.slice(-5).map(s => `On ${formatDate(s.date)}: Activity "${s.activity}", Notes: "${s.notes}". Goals covered: ${s.goals.filter(sg => { const goal = activeStudentGoals.find(g => g.id === sg.goalId); return goal && !goal.isArchived;}).length}.`).join('\n');
      const primaryGoal = selectedGoalId ? activeStudentGoals.find(g=>g.id === selectedGoalId)?.name : "overall progress on active goals";
      const chartDataSummary = chartData.slice(-3);
      const summaryText = `Recent sessions show the following trends (focus on active goals):
${progressDataPoints}
Chart data (last ${chartDataSummary.length} sessions) accuracies: ${chartDataSummary.map(d => `${d.accuracy}%`).join(', ')}; opportunities: ${chartDataSummary.map(d => d.opportunities).join(', ')}; correct responses: ${chartDataSummary.map(d => d.correct).join(', ')}; incorrect responses: ${chartDataSummary.map(d => d.incorrect).join(', ')}; total prompts used (excluding independent): ${chartDataSummary.map(d => d.totalPrompts).join(', ')}.`;
      const result = await generateTechnicalSummary({ studentName: selectedStudent.name, goalName: primaryGoal || "Multiple Active Goals", progressData: summaryText, });
      setTechnicalSummary(result.summary); toast({ title: "AI Summary Generated", description: result.progress });
    } catch (error: any) {
      console.error("Error generating technical summary:", error); addErrorLog({ message: 'Failed to generate AI technical summary.', source: 'AnalysisCharts.handleGenerateSummary', details: error.message, type: 'error' }); toast({ title: "AI Error", description: "Failed to generate summary.", variant: "destructive" });
    } finally { setIsAiLoading(false); }
  };

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
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle>Progress Over Time {selectedGoalId && activeStudentGoals.find(g=>g.id === selectedGoalId) ? `(${activeStudentGoals.find(g=>g.id === selectedGoalId)?.name})` : '(Overall Accuracy - Active Goals)'}</CardTitle><CardDescription>Accuracy percentage across sessions for active goals.</CardDescription></CardHeader><CardContent className="h-[300px] w-full">
          <ChartContainer config={accuracyChartConfig} className="h-full w-full"><LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} /><YAxis unit="%" domain={[0,100]} tickLine={false} axisLine={false} tickMargin={8}/><ChartTooltip content={<ChartTooltipContent indicator="line" />} /><Line type="monotone" dataKey="accuracy" stroke="var(--color-accuracy)" strokeWidth={2} dot={true} /><ChartLegend content={<ChartLegendContent />} /></LineChart></ChartContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Response Counts {selectedGoalId && activeStudentGoals.find(g=>g.id === selectedGoalId) ? `(${activeStudentGoals.find(g=>g.id === selectedGoalId)?.name})` : '(Overall - Active Goals)'}</CardTitle><CardDescription>Number of correct and incorrect responses per session for active goals.</CardDescription></CardHeader><CardContent className="h-[300px] w-full">
          <ChartContainer config={responseCountsChartConfig} className="h-full w-full"><LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} /><YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}/><ChartTooltip content={<ChartTooltipContent indicator="line" />} /><ChartLegend content={<ChartLegendContent />} /><Line type="monotone" dataKey="correct" stroke="var(--color-correct)" strokeWidth={2} dot={true} name="Correct" /><Line type="monotone" dataKey="incorrect" stroke="var(--color-incorrect)" strokeWidth={2} dot={true} name="Incorrect" /></LineChart></ChartContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Total Opportunities {selectedGoalId && activeStudentGoals.find(g=>g.id === selectedGoalId) ? `(${activeStudentGoals.find(g=>g.id === selectedGoalId)?.name})` : '(Overall - Active Goals)'}</CardTitle><CardDescription>Total number of opportunities (e.g., trials) per session for active goals.</CardDescription></CardHeader><CardContent className="h-[300px] w-full">
          <ChartContainer config={opportunitiesChartConfig} className="h-full w-full"><LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} /><YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}/><ChartTooltip content={<ChartTooltipContent indicator="line" />} /><ChartLegend content={<ChartLegendContent />} /><Line type="monotone" dataKey="opportunities" stroke="var(--color-opportunities)" strokeWidth={2} dot={true} name="Opportunities" /></LineChart></ChartContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Shuffle className="h-6 w-6 text-primary"/>Correct Responses vs. Total Prompts Used</CardTitle><CardDescription>Scatter plot of total prompts used (excluding Independent) per session against total correct responses. Each dot is a session.</CardDescription></CardHeader><CardContent className="h-[300px] w-full">
            <ChartContainer config={scatterPlotConfig} className="h-full w-full"><ScatterChart margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="totalPrompts" name="Total Prompts Used" unit="" tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}/><YAxis type="number" dataKey="correct" name="Correct Responses" unit="" tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}/><ChartTooltip content={<ChartTooltipContent hideIndicator cursor={false} />} /><Scatter name="Session Performance" data={chartData} fill="hsl(var(--chart-3))" /></ScatterChart></ChartContainer>
        </CardContent></Card>
        {promptUsageData.length > 0 && (
          <Card className="lg:col-span-2"><CardHeader><CardTitle>Prompt Usage Distribution (Active Goals)</CardTitle><CardDescription>Total count of each prompt level used across selected sessions for active goals.</CardDescription></CardHeader><CardContent className="h-[300px] w-full">
            <ChartContainer config={promptChartConfig} className="h-full w-full"><BarChart data={promptUsageData} layout="vertical" margin={{ left: 10, right:10 }}><CartesianGrid horizontal={false} /><XAxis type="number" hide/><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} tickFormatter={(value) => value.replace(/([A-Z])/g, ' $1').trim()} /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Bar dataKey="value" radius={5} /><ChartLegend content={<ChartLegendContent />} /></BarChart></ChartContainer>
          </CardContent></Card>
         )}
       </div>
       {sankeyData.links.length > 0 && (
        <Card className="col-span-1 lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Workflow className="h-6 w-6 text-primary"/>Goal Performance Flow</CardTitle><CardDescription>Flow of opportunities from Goal Type to Specific Goal, then to Correct/Incorrect outcomes for {selectedGoalId ? `goal: ${activeStudentGoals.find(g=>g.id === selectedGoalId)?.name || 'selected goal'}` : 'all active goals'}.</CardDescription></CardHeader><CardContent className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%"><Sankey data={sankeyData} node={<CustomSankeyNode />} nodePadding={20} margin={{ top: 5, right: 120, bottom: 5, left: 120 }} linkCurviness={0.5} iterations={32}><RechartsTooltip formatter={(value:any, name:any) => [value.toLocaleString(), name.replace(/([A-Z])/g, ' $1').trim()]} /></Sankey></ResponsiveContainer>
        </CardContent></Card>
       )}
      <Card>
        <CardHeader><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"><CardTitle className="flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary"/>AI-Powered Technical Summary</CardTitle><Button onClick={handleGenerateSummary} disabled={isAiLoading} size="sm">{isAiLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}{technicalSummary ? 'Re-generate' : 'Generate Summary'}</Button></div><CardDescription>An AI-generated summary of the student's progress based on the selected data (active goals).</CardDescription></CardHeader>
        <CardContent>{isAiLoading && <Skeleton className="h-24 w-full" />}{!isAiLoading && technicalSummary && <div className="p-4 border rounded-md bg-muted/50 whitespace-pre-wrap text-sm leading-relaxed">{technicalSummary}</div>}{!isAiLoading && !technicalSummary && <p className="text-muted-foreground">Click "Generate Summary" to get an AI analysis.</p>}</CardContent>
      </Card>
    </>
  );
};

export function AnalysisReportChartsSkeleton() {
    return (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        </div>
    );
}

export default AnalysisCharts;
