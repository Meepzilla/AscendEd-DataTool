
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useStudentData } from '@/hooks/use-student-data';
import type { Student, SessionData, Goal, PromptType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart2, Download, Info, RefreshCw, Lightbulb, MessageSquare, TrendingUp, AlertTriangle } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { generateTechnicalSummary } from '@/ai/flows/technical-summary-generation'; 
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PROMPT_COLORS, PROMPT_TYPES } from '@/lib/constants';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import type { DateRange } from "react-day-picker";
import { useSearchParams } from 'next/navigation';
import { formatDate } from '@/lib/helpers';
import { useErrorLog } from '@/hooks/use-error-log';


// Helper to transform session data for charts
const transformSessionDataForChart = (sessions: SessionData[], selectedGoalId?: string) => {
  return sessions.map(session => {
    let correct = 0;
    let incorrect = 0;
    let opportunities = 0;
    let promptCounts: Record<PromptType, number> = PROMPT_TYPES.reduce((acc, pt) => ({...acc, [pt]:0}), {} as Record<PromptType, number>);

    session.goals.forEach(goalData => {
      if (selectedGoalId && goalData.goalId !== selectedGoalId) return;
      
      if (goalData.data.correct !== undefined && goalData.data.incorrect !== undefined) {
        correct += Number(goalData.data.correct) || 0;
        incorrect += Number(goalData.data.incorrect) || 0;
        opportunities += (Number(goalData.data.correct) || 0) + (Number(goalData.data.incorrect) || 0);
      } else if (goalData.data.opportunities !== undefined && (goalData.data.successfulResponses !== undefined || goalData.data.correctProductions !== undefined)){
        const successes = Number(goalData.data.successfulResponses ?? goalData.data.correctProductions) || 0;
        opportunities += Number(goalData.data.opportunities) || 0;
        correct += successes;
        incorrect += (Number(goalData.data.opportunities) || 0) - successes;
      } else if (goalData.goalType === 'FLUENCY_SYLLABLE_STUTTER') {
        const totalSyllables = Number(goalData.data.totalSyllables) || 0;
        const stutteredSyllables = Number(goalData.data.stutteredSyllables) || 0;
        opportunities += totalSyllables;
        correct += totalSyllables - stutteredSyllables;
        incorrect += stutteredSyllables;
      }
      
      PROMPT_TYPES.forEach(pt => {
        if (goalData.data[pt] && typeof goalData.data[pt] === 'number') {
          promptCounts[pt] = (promptCounts[pt] || 0) + (goalData.data[pt] as number);
        }
      });
    });
    
    const accuracy = opportunities > 0 ? (correct / opportunities) * 100 : 0;
    
    return {
      date: new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      accuracy: parseFloat(accuracy.toFixed(1)),
      correct,
      incorrect,
      opportunities,
      ...promptCounts,
    };
  }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()); 
};


export default function AnalysisReportPage() {
  const { students, sessions, loading: dataLoading } = useStudentData();
  const searchParams = useSearchParams();
  const studentIdFromQuery = searchParams.get('studentId');
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>(studentIdFromQuery || undefined);
  const [selectedGoalId, setSelectedGoalId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [technicalSummary, setTechnicalSummary] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();
  const { addErrorLog } = useErrorLog();

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId), [students, selectedStudentId]);

  useEffect(() => {
    // studentIdFromQuery is already declared outside from searchParams
    if (studentIdFromQuery && students.find(s => s.id === studentIdFromQuery)) {
      setSelectedStudentId(studentIdFromQuery);
    } else if (!selectedStudentId && students.length > 0) {
      setSelectedStudentId(students[0].id);
    }
  }, [studentIdFromQuery, students, selectedStudentId]);


  const studentSessions = useMemo(() => {
    if (!selectedStudentId) return [];
    let filtered = sessions.filter(s => s.studentId === selectedStudentId);
    if (dateRange?.from) {
        filtered = filtered.filter(s => new Date(s.date) >= dateRange.from!);
    }
    if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(s => new Date(s.date) <= toDate);
    }
    return filtered.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sessions, selectedStudentId, dateRange]);

  const chartData = useMemo(() => transformSessionDataForChart(studentSessions, selectedGoalId), [studentSessions, selectedGoalId]);
  
  const promptUsageData = useMemo(() => {
    const aggregatedPrompts: Record<PromptType, number> = PROMPT_TYPES.reduce((acc, pt) => ({...acc, [pt]:0}), {} as Record<PromptType, number>);
    chartData.forEach(session => {
        PROMPT_TYPES.forEach(pt => {
            if(session[pt]) aggregatedPrompts[pt] += session[pt] as number;
        });
    });
    return Object.entries(aggregatedPrompts)
      .map(([name, value]) => ({ name: name as PromptType, value, fill: PROMPT_COLORS[name as PromptType] }))
      .filter(item => item.value > 0); 
  }, [chartData]);


  const handleGenerateSummary = async () => {
    if (!selectedStudent || studentSessions.length === 0) {
      toast({ title: "Info", description: "Select a student with session data to generate a summary.", variant: "default" });
      return;
    }
    setIsAiLoading(true);
    setTechnicalSummary(null);
    try {
      const progressDataPoints = studentSessions.slice(-5).map(s => 
        `On ${formatDate(s.date)}: Activity "${s.activity}", Notes: "${s.notes}". Goals covered: ${s.goals.length}.`
      ).join('\n');
      
      const primaryGoal = selectedGoalId ? selectedStudent.goals.find(g=>g.id === selectedGoalId)?.name : "overall progress";

      const result = await generateTechnicalSummary({
        studentName: selectedStudent.name,
        goalName: primaryGoal || "Multiple Goals",
        progressData: `Recent sessions show the following trends:\n${progressDataPoints}\nChart data (last 3 sessions) accuracies: ${chartData.slice(-3).map(d => `${d.accuracy}%`).join(', ')}; opportunities: ${chartData.slice(-3).map(d => d.opportunities).join(', ')}; correct: ${chartData.slice(-3).map(d => d.correct).join(', ')}; incorrect: ${chartData.slice(-3).map(d => d.incorrect).join(', ')}.`,
      });
      setTechnicalSummary(result.summary);
      toast({ title: "AI Summary Generated", description: result.progress });
    } catch (error: any) {
      console.error("Error generating technical summary:", error);
      addErrorLog({ message: 'Failed to generate AI technical summary.', source: 'AnalysisReportPage.handleGenerateSummary', details: error.message, type: 'error' });
      toast({ title: "AI Error", description: "Failed to generate summary.", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };
  
  const handleExportData = () => {
    if (chartData.length === 0) {
        toast({title:"Info", description:"No data to export.", variant:"default"});
        return;
    }
    const headers = Object.keys(chartData[0]).join(',');
    const csvRows = chartData.map(row => Object.values(row).join(','));
    const csvString = `${headers}\n${csvRows.join('\n')}`;
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${selectedStudent?.name || 'student'}_progress_report.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    toast({title:"Exported", description:"Data exported as CSV."});
  };

  const accuracyChartConfig = {
    accuracy: { label: 'Accuracy (%)', color: 'hsl(var(--primary))' },
  } as const;

  const responseCountsChartConfig = {
    correct: { label: 'Correct', color: 'hsl(var(--chart-2))' }, 
    incorrect: { label: 'Incorrect', color: 'hsl(var(--chart-5))' }, 
  } as const;

  const opportunitiesChartConfig = {
    opportunities: { label: 'Opportunities', color: 'hsl(var(--chart-1))' }, 
  } as const;

  const promptChartConfig = PROMPT_TYPES.reduce((config, pt) => {
    config[pt] = { label: pt, color: PROMPT_COLORS[pt] };
    return config;
  }, {} as Record<PromptType, { label: string; color: string }>);


  if (dataLoading && students.length === 0) {
    return <AnalysisReportSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
             <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <BarChart2 className="h-7 w-7 text-primary"/>Analysis & Reports
                </CardTitle>
                <CardDescription>Visualize student progress, analyze trends, and generate summaries.</CardDescription>
             </div>
             <Button onClick={handleExportData} size="sm" variant="outline" disabled={chartData.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Export Data
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <Select value={selectedStudentId} onValueChange={(value) => {setSelectedStudentId(value); setSelectedGoalId(undefined); setTechnicalSummary(null);}}>
              <SelectTrigger className="w-full md:w-[250px]">
                <SelectValue placeholder="Select Student" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStudent && (
                <Select value={selectedGoalId} onValueChange={(value) => {setSelectedGoalId(value === 'ALL' ? undefined : value); setTechnicalSummary(null);}}>
                    <SelectTrigger className="w-full md:w-[250px]">
                        <SelectValue placeholder="Select Goal (Optional)" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Goals</SelectItem>
                        {selectedStudent.goals.map(goal => (
                        <SelectItem key={goal.id} value={goal.id}>{goal.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
            <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full md:w-auto"/>
          </div>
        </CardContent>
      </Card>

      {!selectedStudentId ? (
        <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
                <Info className="h-10 w-10 mx-auto mb-3 text-primary"/>
                <p className="text-lg">Please select a student to view their analysis report.</p>
            </CardContent>
        </Card>
      ) : studentSessions.length === 0 && !dataLoading ? (
        <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-500"/>
                <p className="text-lg">No session data found for {selectedStudent?.name || 'the selected student'} within the selected date range.</p>
                <p>Try adjusting the filters or record new session data.</p>
            </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Progress Over Time {selectedGoalId && selectedStudent?.goals.find(g=>g.id === selectedGoalId) ? `(${selectedStudent?.goals.find(g=>g.id === selectedGoalId)?.name})` : '(Overall Accuracy)'}</CardTitle>
                <CardDescription>Accuracy percentage across sessions.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] w-full">
                <ChartContainer config={accuracyChartConfig} className="h-full w-full">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis unit="%" domain={[0,100]} tickLine={false} axisLine={false} tickMargin={8}/>
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <Line type="monotone" dataKey="accuracy" stroke="var(--color-accuracy)" strokeWidth={2} dot={true} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Response Counts {selectedGoalId && selectedStudent?.goals.find(g=>g.id === selectedGoalId) ? `(${selectedStudent?.goals.find(g=>g.id === selectedGoalId)?.name})` : '(Overall)'}</CardTitle>
                <CardDescription>Number of correct and incorrect responses per session.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] w-full">
                <ChartContainer config={responseCountsChartConfig} className="h-full w-full">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}/>
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line type="monotone" dataKey="correct" stroke="var(--color-correct)" strokeWidth={2} dot={true} name="Correct" />
                    <Line type="monotone" dataKey="incorrect" stroke="var(--color-incorrect)" strokeWidth={2} dot={true} name="Incorrect" />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total Opportunities {selectedGoalId && selectedStudent?.goals.find(g=>g.id === selectedGoalId) ? `(${selectedStudent?.goals.find(g=>g.id === selectedGoalId)?.name})` : '(Overall)'}</CardTitle>
                <CardDescription>Total number of opportunities (e.g., trials) per session.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] w-full">
                <ChartContainer config={opportunitiesChartConfig} className="h-full w-full">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}/>
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line type="monotone" dataKey="opportunities" stroke="var(--color-opportunities)" strokeWidth={2} dot={true} name="Opportunities" />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {promptUsageData.length > 0 && (
              <Card>
                  <CardHeader>
                  <CardTitle>Prompt Usage Distribution</CardTitle>
                  <CardDescription>Total count of each prompt level used across selected sessions.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px] w-full">
                  <ChartContainer config={promptChartConfig} className="h-full w-full">
                      <BarChart data={promptUsageData} layout="vertical" margin={{ left: 10, right:10 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" hide/>
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} />
                      <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                      <Bar dataKey="value" radius={5} />
                       <ChartLegend content={<ChartLegendContent />} />
                      </BarChart>
                  </ChartContainer>
                  </CardContent>
              </Card>
             )}
           </div>
           
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <CardTitle className="flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary"/>AI-Powered Technical Summary</CardTitle>
                <Button onClick={handleGenerateSummary} disabled={isAiLoading} size="sm">
                  {isAiLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                  {technicalSummary ? 'Re-generate' : 'Generate Summary'}
                </Button>
              </div>
              <CardDescription>An AI-generated summary of the student's progress based on the selected data.</CardDescription>
            </CardHeader>
            <CardContent>
              {isAiLoading && <Skeleton className="h-24 w-full" />}
              {!isAiLoading && technicalSummary && (
                <div className="p-4 border rounded-md bg-muted/50 whitespace-pre-wrap text-sm leading-relaxed">
                  {technicalSummary}
                </div>
              )}
              {!isAiLoading && !technicalSummary && (
                <p className="text-muted-foreground">Click "Generate Summary" to get an AI analysis.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function AnalysisReportSkeleton() {
    return (
         <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                            <Skeleton className="h-8 w-56 mb-1" />
                            <Skeleton className="h-4 w-80" />
                        </div>
                        <Skeleton className="h-9 w-32" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-2">
                        <Skeleton className="h-10 w-full md:w-[250px]" />
                        <Skeleton className="h-10 w-full md:w-[250px]" />
                        <Skeleton className="h-10 w-full md:flex-grow" />
                    </div>
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card><CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
            </div>
            <Card><CardHeader><Skeleton className="h-7 w-1/3 mb-1" /><Skeleton className="h-4 w-1/2" /></CardHeader><CardContent><Skeleton className="h-[200px] w-full" /></CardContent></Card>
        </div>
    )
}

