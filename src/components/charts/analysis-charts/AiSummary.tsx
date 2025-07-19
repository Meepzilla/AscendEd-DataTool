'use client';

import React, { useState } from 'react';
import type { Student, SessionData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RefreshCw, Lightbulb, MessageSquare } from 'lucide-react';
import { generateTechnicalSummary } from '@/ai/flows/technical-summary-generation';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorLog } from '@/hooks/use-error-log';
import { formatDate } from '@/lib/helpers';

interface AiSummaryProps {
  studentSessions: SessionData[];
  selectedStudent?: Student;
  selectedGoalId?: string;
  chartData: any[];
}

const AiSummary: React.FC<AiSummaryProps> = ({ studentSessions, selectedStudent, selectedGoalId, chartData }) => {
  const [technicalSummary, setTechnicalSummary] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();
  const { addErrorLog } = useErrorLog();

  const handleGenerateSummary = async () => {
    if (!selectedStudent || studentSessions.length === 0) {
      toast({ title: "Info", description: "Select a student with session data to generate a summary.", variant: "default" });
      return;
    }
    setIsAiLoading(true);
    setTechnicalSummary(null);
    try {
      const activeStudentGoals = selectedStudent.goals.filter(g => !g.isArchived);
      const progressDataPoints = studentSessions.slice(-5).map(s => `On ${formatDate(s.date)}: Activity "${s.activity}", Notes: "${s.notes}". Goals covered: ${s.goals.filter(sg => { const goal = activeStudentGoals.find(g => g.id === sg.goalId); return goal && !goal.isArchived; }).length}.`).join('\n');
      const primaryGoal = selectedGoalId ? activeStudentGoals.find(g => g.id === selectedGoalId)?.name : "overall progress on active goals";
      const chartDataSummary = chartData.slice(-3);
      const summaryText = `Recent sessions show the following trends (focus on active goals):\n${progressDataPoints}\nChart data (last ${chartDataSummary.length} sessions) accuracies: ${chartDataSummary.map(d => `${d.accuracy}%`).join(', ')}; opportunities: ${chartDataSummary.map(d => d.opportunities).join(', ')}; correct responses: ${chartDataSummary.map(d => d.correct).join(', ')}; incorrect responses: ${chartDataSummary.map(d => d.incorrect).join(', ')}; total prompts used (excluding independent): ${chartDataSummary.map(d => d.totalPrompts).join(', ')}.`;

      const result = await generateTechnicalSummary({
        studentName: selectedStudent.name,
        goalName: primaryGoal || "Multiple Active Goals",
        progressData: summaryText,
      });
      setTechnicalSummary(result.summary);
      toast({ title: "AI Summary Generated", description: result.progress });
    } catch (error: any) {
      console.error("Error generating technical summary:", error);
      addErrorLog({ message: 'Failed to generate AI technical summary.', source: 'AiSummary.handleGenerateSummary', details: error.message, type: 'error' });
      toast({ title: "AI Error", description: "Failed to generate summary.", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
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
        {!isAiLoading && technicalSummary && <div className="p-4 border rounded-md bg-muted/50 whitespace-pre-wrap text-sm leading-relaxed">{technicalSummary}</div>}
        {!isAiLoading && !technicalSummary && <p className="text-muted-foreground">Click "Generate Summary" to get an AI analysis.</p>}
      </CardContent>
    </Card>
  );
};

export default AiSummary;
