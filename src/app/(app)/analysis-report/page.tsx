
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
const transformSessionDataForChart = (sessions: SessionData[], studentGoals: Goal[], selectedGoalId?: string) => {
  return sessions.map(session => {
    let sessionCorrect = 0;
    let sessionIncorrect = 0;
    let sessionOpportunities = 0;
    let promptCounts: Record<PromptType, number> = Object.fromEntries(PROMPT_TYPES.map(pt => [pt, 0])) as Record<PromptType, number>;

    session.goals.forEach(goalData => {
      const currentGoal = studentGoals.find(g => g.id === goalData.goalId);
      if (currentGoal?.isArchived) return; // Skip archived goals
      
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
          // If opportunities field is present and is a number, it is the authoritative total
          if (typeof goalData.data.opportunities === 'number') {
            currentGoalOpportunities = goalData.data.opportunities;
            currentGoalIncorrect = Math.max(0, currentGoalOpportunities - currentGoalCorrect); // Ensure incorrect is not negative
          } else { // If opportunities is not set, sum successful and unsuccessful
            currentGoalIncorrect = Number(goalData.data.unsuccessfulResponses) || 0;
            currentGoalOpportunities = currentGoalCorrect + currentGoalIncorrect;
          }
          break;
        case 'PHONOLOGICAL_PROCESSES':
          currentGoalCorrect = Number(goalData.data.correctProductions) || 0;
          if (typeof goalData.data.opportunities === 'number') {
            currentGoalOpportunities = goalData.data.opportunities;
            currentGoalIncorrect = Math.max(0, currentGoalOpportunities - currentGoalCorrect);
          } else {
            currentGoalIncorrect = Number(goalData.data.incorrectProductions) || 0;
            currentGoalOpportunities = currentGoalCorrect + currentGoalIncorrect;
          }
          break;
        case 'FLUENCY_SYLLABLE_STUTTER':
          const totalSyllables = Number(goalData.data.totalSyllables) || 0;
          const stutteredSyllables = Number(goalData.data.stutteredSyllables) || 0;
          currentGoalOpportunities = totalSyllables;
          currentGoalCorrect = Math.max(0, totalSyllables - stutteredSyllables);
          currentGoalIncorrect = stutteredSyllables;
          break;
        default:
          // For QUALITATIVE_OBSERVATION or other types, no quantitative data is added
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
    
    return {
      date: new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      accuracy: parseFloat(accuracy.toFixed(1)),
      correct: sessionCorrect,
      incorrect: sessionIncorrect,
      opportunities: sessionOpportunities,
      ...promptCounts,
    };
  }); 
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
  const activeStudentGoals = useMemo(() => selectedStudent?.goals.filter(g => !g.isArchived) || [], [selectedStudent]);


  useEffect(() => {
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

  const chartData = useMemo(() => transformSessionDataForChart(studentSessions, selectedStudent?.goals || [], selectedGoalId), [studentSessions, selectedStudent?.goals, selectedGoalId]);
  
  const promptUsageData = useMemo(() => {
    const aggregatedPrompts: Record<PromptType, number> = Object.fromEntries(PROMPT_TYPES.map(pt => [pt, 0])) as Record<PromptType, number>;
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
        `On ${formatDate(s.date)}: Activity "${s.activity}", Notes: "${s.notes}". Goals covered: ${s.goals.filter(sg => { const goal = activeStudentGoals.find(g => g.id === sg.goalId); return goal && !goal.isArchived;}).length}.`
      ).join('\n');
      
      const primaryGoal = selectedGoalId ? activeStudentGoals.find(g=>g.id === selectedGoalId)?.name : "overall progress on active goals";

      const result = await generateTechnicalSummary({
        studentName: selectedStudent.name,
        goalName: primaryGoal || "Multiple Active Goals",
        progressData: `Recent sessions show the following trends (focus on active goals):\n${progressDataPoints}\nChart data (last 3 sessions) accuracies: ${chartData.slice(-3).map(d => `${d.accuracy}%`).join(', ')}; opportunities: ${chartData.slice(-3).map(d => d.opportunities).join(', ')}; correct: ${chartData.slice(-3).map(d => d.correct).join(', ')}; incorrect: ${chartData.slice(-3).map(d => d.incorrect).join(', ')}.`,
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

    const goalNameToExport = selectedGoalId && selectedStudent
        ? activeStudentGoals.find(g => g.id === selectedGoalId)?.name || 'Selected Active Goal (Name N/A)'
        : 'All Active Goals';

    const dataForCsv = chartData.map(row => ({
        goal: goalNameToExport, 
        ...row 
    }));
    
    const headers = Object.keys(dataForCsv[0]).join(',');
    const csvRows = dataForCsv.map(row =>
        Object.values(row)
            .map(value => {
                const stringValue = String(value);
                // Escape double quotes by doubling them, and wrap if it contains comma, double quote, or newline
                if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            })
            .join(',')
    );

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
    config[pt] = { label: pt.replace(/([A-Z])/g, ' $1').trim(), color: PROMPT_COLORS[pt] }; // Add spaces for multi-word prompt types
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
                    <BarChart2 className="h-7 w-7 text-primary"/>Analysis &amp; Reports
                </CardTitle>
                <CardDescription>Visualize student progress, analyze trends, and generate summaries (for active goals).</CardDescription>
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
                <Select value={selectedGoalId} onValueChange={(value) => {setSelectedGoalId(value === 'ALL_ACTIVE' ? undefined : value); setTechnicalSummary(null);}}>
                    <SelectTrigger className="w-full md:w-[250px]">
                        <SelectValue placeholder="Select Active Goal (Optional)" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL_ACTIVE">All Active Goals</SelectItem>
                        {activeStudentGoals.map(goal => (
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
                <CardTitle>Progress Over Time {selectedGoalId && activeStudentGoals.find(g=>g.id === selectedGoalId) ? `(${activeStudentGoals.find(g=>g.id === selectedGoalId)?.name})` : '(Overall Accuracy - Active Goals)'}</CardTitle>
                <CardDescription>Accuracy percentage across sessions for active goals.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] w-full">
                <ChartContainer config={accuracyChartConfig} className="h-full w-full">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} />
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
                <CardTitle>Response Counts {selectedGoalId && activeStudentGoals.find(g=>g.id === selectedGoalId) ? `(${activeStudentGoals.find(g=>g.id === selectedGoalId)?.name})` : '(Overall - Active Goals)'}</CardTitle>
                <CardDescription>Number of correct and incorrect responses per session for active goals.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] w-full">
                <ChartContainer config={responseCountsChartConfig} className="h-full w-full">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} />
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
                <CardTitle>Total Opportunities {selectedGoalId && activeStudentGoals.find(g=>g.id === selectedGoalId) ? `(${activeStudentGoals.find(g=>g.id === selectedGoalId)?.name})` : '(Overall - Active Goals)'}</CardTitle>
                <CardDescription>Total number of opportunities (e.g., trials) per session for active goals.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] w-full">
                <ChartContainer config={opportunitiesChartConfig} className="h-full w-full">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} allowDuplicatedCategory={false} />
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
                  <CardTitle>Prompt Usage Distribution (Active Goals)</CardTitle>
                  <CardDescription>Total count of each prompt level used across selected sessions for active goals.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px] w-full">
                  <ChartContainer config={promptChartConfig} className="h-full w-full">
                      <BarChart data={promptUsageData} layout="vertical" margin={{ left: 10, right:10 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" hide/>
                      <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} 
                        tickFormatter={(value) => value.replace(/([A-Z])/g, ' $1').trim()} // Format Y-axis labels
                      />
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
              <CardDescription>An AI-generated summary of the student's progress based on the selected data (active goals).</CardDescription>
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


    