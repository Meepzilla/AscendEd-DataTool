
'use client';

import React from 'react';
import type { Goal } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';

interface ResponseCountsChartProps {
  chartData: any[];
  selectedGoalId?: string;
  activeStudentGoals: Goal[];
}

const ResponseCountsChart: React.FC<ResponseCountsChartProps> = ({ chartData, selectedGoalId, activeStudentGoals }) => {
  const responseCountsChartConfig = { 
    correct: { label: 'Correct', color: 'hsl(var(--chart-2))' }, 
    incorrect: { label: 'Incorrect', color: 'hsl(var(--chart-5))' },
    approximate: { label: 'Approximate', color: 'hsl(var(--chart-4))' },
  } as const;
  const goalName = selectedGoalId ? activeStudentGoals.find(g => g.id === selectedGoalId)?.name : null;

  return (
    
      
        
          Response Counts {goalName ? `(${goalName})` : '(Overall - Active Goals)'}
        
        Number of correct, incorrect, and approximate responses per session for active goals.
      
      
        
          
            
              
              
              
            
            
            
              
            
          
        
      
    
  );
};

export default ResponseCountsChart;
