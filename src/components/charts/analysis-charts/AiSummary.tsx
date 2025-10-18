'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { Student, SessionData, Goal } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { generateTechnicalSummary } from '@/ai/flows/technical-summary-generation';
import { useErrorLog } from '@/hooks/use-error-log';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/helpers';

interface AiSummaryProps {
  studentSessions: SessionData[];
  selectedStudent?: Student;
  selectedGoalId?: string;
  chartData: any[]; // The aggregated data used by other charts
}

const AiSummary: React.FC<AiSummaryProps> = ({ studentSessions, selectedStudent, selectedGoalId, chartData }) => {
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addErrorLog } = useErrorLog();
  const { toast } = useToast();

  const handleGenerateSummary = useCallback(async () => {
    if (!selectedStudent || studentSessions.length === 0) {
      toast({ title: "Not enough data", description: "Cannot generate summary without a selected student and session data.", variant: "default" });
      return;
    }
    
    setIsLoading(true);
    setSummary('');

    try {
      const dateRangeString = chartData.length > 0 
        ? `${chartData[0].date} to ${chartData[chartData.length - 1].date}`
        : 'N/A';

      const goalFilterString = selectedGoalId 
        ? selectedStudent.goals.find(g => g.id === selectedGoalId)?.name || 'Selected Goal'
        : 'All Active Goals';

      const result = await generateTechnicalSummary({
        studentName: selectedStudent.name,
        dateRange: dateRangeString,
        goalFilter: goalFilterString,
        sessions: studentSessions.map(s => ({
            date: formatDate(s.date),
            activity: s.activity,
            notes: s.notes,
            goals: s.goals.map(g => ({
                goalName: g.goalName,
                goalType: g.goalType,
                data: g.data
            }))
        })),
      });

      if (result.summary) {
        setSummary(result.summary);
        toast({ title: "AI Summary Generated", description: "A technical summary has been created based on the current data." });
      } else {
        throw new Error("AI returned an empty summary.");
      }
    } catch (error: any) {
      console.error("Failed to generate AI summary:", error);
      addErrorLog({
        message: 'AI technical summary generation failed.',
        source: 'AiSummary.handleGenerateSummary',
        details: error.message,
        type: 'error',
      });
      toast({
        title: "AI Error",
        description: "Could not generate the summary. Please check the console for details.",
        variant: "destructive",
      });
      setSummary("Failed to generate summary. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedStudent, studentSessions, chartData, selectedGoalId, addErrorLog, toast]);

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            AI Technical Summary
          </CardTitle>
          <CardDescription>
            Generate a data-driven narrative of student performance.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <Button variant="outline" size="sm" onClick={handleGenerateSummary} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
          )}
          <Button onClick={handleGenerateSummary} disabled={isLoading} size="sm">
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Generate Summary</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {summary ? (
          <Textarea
            value={summary}
            readOnly
            className="w-full h-40 bg-muted/50 text-sm"
            placeholder="AI-generated summary will appear here..."
          />
        ) : (
          <div className="text-center text-muted-foreground p-8 border border-dashed rounded-md">
            <p>Click "Generate Summary" to create an AI-powered analysis of the selected data.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AiSummary;
