
'use client';

import React, { useMemo } from 'react';
import type { Student, SessionData, Goal, TrialStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CheckSquare } from 'lucide-react';

interface TrialStatusChartProps {
  studentSessions: SessionData[];
  selectedStudent?: Student;
  selectedGoalId?: string;
}

const TrialStatusChart: React.FC<TrialStatusChartProps> = ({ studentSessions, selectedStudent, selectedGoalId }) => {

  const trialData = useMemo(() => {
    if (!selectedStudent) return [];

    const data = studentSessions.map(session => {
      let correct = 0;
      let incorrect = 0;
      let approximate = 0;

      session.goals.forEach(goalData => {
        if (selectedGoalId && goalData.goalId !== selectedGoalId) return;

        if (goalData.goalType === 'DISCRETE_TRIALS' && Array.isArray(goalData.data.trials)) {
          correct += goalData.data.trials.filter((t: TrialStatus) => t === 'correct').length;
          incorrect += goalData.data.trials.filter((t: TrialStatus) => t === 'incorrect').length;
          approximate += goalData.data.trials.filter((t: TrialStatus) => t === 'approximate').length;
        } else if (goalData.goalType === 'SEQUENCED_TRIALS') {
          correct += Number(goalData.data.successfulAttempts) || 0;
          incorrect += Number(goalData.data.failedAttempts) || 0;
        }
      });
      
      const totalTrials = correct + incorrect + approximate;
      if (totalTrials === 0) return null;

      return {
        date: new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        correct,
        incorrect,
        approximate,
      };
    }).filter(item => item !== null);

    return data as { date: string; correct: number; incorrect: number; approximate: number; }[];
  }, [studentSessions, selectedStudent, selectedGoalId]);
  

  if (trialData.length === 0) {
    return null; // Don't render the chart if there's no relevant data
  }

  return (
    <div className="mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-primary" />
            Trial Status Breakdown
          </CardTitle>
          <CardDescription>
            Performance on Discrete and Sequenced Trial goals across sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={trialData}
              margin={{
                top: 20, right: 30, left: 20, bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  borderColor: 'hsl(var(--border))'
                }}
              />
              <Legend />
              <Bar dataKey="correct" stackId="a" fill="hsl(var(--chart-2))" name="Correct" />
              <Bar dataKey="approximate" stackId="a" fill="hsl(var(--chart-4))" name="Approximate" />
              <Bar dataKey="incorrect" stackId="a" fill="hsl(var(--chart-5))" name="Incorrect" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrialStatusChart;
