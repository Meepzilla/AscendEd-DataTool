
'use client';

import React, { useMemo } from 'react';
import type { Student } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sigma, Percent, CheckCircle, XCircle, HelpCircle, Target } from 'lucide-react';

interface DataSummaryProps {
  studentSessions: any[];
  selectedStudent?: Student;
  selectedGoalId?: string;
  chartData: any[];
}

const DataSummary: React.FC<DataSummaryProps> = ({ studentSessions, selectedStudent, selectedGoalId, chartData }) => {

  const summaryStats = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        sessionCount: 0,
        avgAccuracy: 0,
        totalCorrect: 0,
        totalIncorrect: 0,
        totalApproximate: 0,
        totalOpportunities: 0,
      };
    }

    const totalCorrect = chartData.reduce((acc, session) => acc + (session.correct || 0), 0);
    const totalIncorrect = chartData.reduce((acc, session) => acc + (session.incorrect || 0), 0);
    const totalApproximate = chartData.reduce((acc, session) => acc + (session.approximate || 0), 0);
    const totalOpportunities = chartData.reduce((acc, session) => acc + (session.opportunities || 0), 0);
    
    const avgAccuracy = totalOpportunities > 0 ? (totalCorrect / totalOpportunities) * 100 : 0;

    return {
      sessionCount: studentSessions.length,
      avgAccuracy: parseFloat(avgAccuracy.toFixed(1)),
      totalCorrect,
      totalIncorrect,
      totalApproximate,
      totalOpportunities,
    };
  }, [chartData, studentSessions]);

  const stats = [
    { label: 'Total Sessions', value: summaryStats.sessionCount, icon: Sigma },
    { label: 'Avg. Accuracy', value: `${summaryStats.avgAccuracy}%`, icon: Percent },
    { label: 'Total Opportunities', value: summaryStats.totalOpportunities, icon: Target },
    { label: 'Total Correct', value: summaryStats.totalCorrect, icon: CheckCircle, color: 'text-green-500' },
    { label: 'Total Incorrect', value: summaryStats.totalIncorrect, icon: XCircle, color: 'text-red-500' },
    { label: 'Total Approximate', value: summaryStats.totalApproximate, icon: HelpCircle, color: 'text-yellow-500' },
  ];

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Data Summary</CardTitle>
        <CardDescription>
          A quantitative overview of the selected data for {selectedStudent?.name || 'the student'}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          {stats.map((stat, index) => (
            <div key={index} className="p-4 rounded-lg bg-muted/50 flex flex-col items-center justify-center">
              <stat.icon className={`h-6 w-6 mb-2 ${stat.color || 'text-primary'}`} />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DataSummary;
