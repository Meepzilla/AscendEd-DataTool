
'use client';

import React, { useMemo } from 'react';
import type { Goal, SessionData, PromptType, GoalType, TrialStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sankey, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Workflow } from 'lucide-react';
import { PROMPT_TYPES } from '@/lib/promptConstants';

interface SankeyNode { name: string; color?: string; }
interface SankeyLink { source: number; target: number; value: number; }
interface SankeyData { nodes: SankeyNode[]; links: SankeyLink[]; }

const transformDataForSankeyChart = (sessions: SessionData[], studentActiveGoals: Goal[]): SankeyData => {
  const nodeMap: Record<string, number> = {};
  const addNode = (name: string) => {
    if (nodeMap[name] === undefined) {
      nodeMap[name] = Object.keys(nodeMap).length;
    }
  };

  const rawLinks: { source: string; target: string; value: number }[] = [];

  sessions.forEach(session => {
    session.goals.forEach(goalDataEntry => {
      const originalGoal = studentActiveGoals.find(g => g.id === goalDataEntry.goalId);
      if (!originalGoal || originalGoal.isArchived) return;

      let currentCorrect = 0, currentIncorrect = 0, currentApproximate = 0;
      const data = goalDataEntry.data || {};

      switch (originalGoal.type) {
        case 'ARTICULATION':
            currentCorrect = Number(data.correct) || 0;
            currentIncorrect = Number(data.incorrect) || 0;
            currentApproximate = Number(data.approximate) || 0;
            break;
        case 'LANGUAGE_COMPREHENSION':
            currentCorrect = Number(data.questionsCorrect) || 0;
            currentIncorrect = Number(data.questionsIncorrect) || 0;
            currentApproximate = Number(data.approximate) || 0;
            break;
        case 'LANGUAGE_EXPRESSION':
            currentCorrect = Number(data.successfulResponses) || 0;
            currentIncorrect = Number(data.unsuccessfulResponses) || 0;
            currentApproximate = Number(data.approximate) || 0;
            break;
        case 'PHONOLOGICAL_PROCESSES':
            currentCorrect = Number(data.correctProductions) || 0;
            currentIncorrect = Number(data.incorrectProductions) || 0;
            currentApproximate = Number(data.approximate) || 0;
            break;
        case 'FLUENCY_SYLLABLE_STUTTER':
            const totalSyllables = Number(data.totalSyllables) || 0;
            const stutteredSyllables = Number(data.stutteredSyllables) || 0;
            currentCorrect = Math.max(0, totalSyllables - stutteredSyllables);
            currentIncorrect = stutteredSyllables;
            break;
        case 'FEEDING_SWALLOWING':
            currentCorrect = Number(data.trialsAccepted) || 0;
            currentIncorrect = Number(data.trialsRefused) || 0;
            break;
        case 'SEQUENCED_TRIALS':
            currentCorrect = Number(data.successfulAttempts) || 0;
            currentIncorrect = Number(data.failedAttempts) || 0;
            currentApproximate = Number(data.approximate) || 0;
            break;
        case 'DISCRETE_TRIALS':
            if (Array.isArray(data.trials)) {
                currentCorrect = data.trials.filter((t: TrialStatus) => t === 'correct').length;
                currentIncorrect = data.trials.filter((t: TrialStatus) => t === 'incorrect').length;
                currentApproximate = data.trials.filter((t: TrialStatus) => t === 'approximate').length;
            }
            break;
      }
      
      const totalOpportunities = currentCorrect + currentIncorrect + currentApproximate;
      if (totalOpportunities === 0) return;

      const goalNodeName = `${originalGoal.name} (${originalGoal.type})`;
      addNode(goalNodeName);
      if (currentCorrect > 0) {
        addNode('Correct');
        rawLinks.push({ source: goalNodeName, target: 'Correct', value: currentCorrect });
      }
      if (currentIncorrect > 0) {
        addNode('Incorrect');
        rawLinks.push({ source: goalNodeName, target: 'Incorrect', value: currentIncorrect });
      }
      if (currentApproximate > 0) {
        addNode('Approximate');
        rawLinks.push({ source: goalNodeName, target: 'Approximate', value: currentApproximate });
      }
    });
  });

  const nodes = Object.keys(nodeMap).map(name => {
    let color;
    if (name === 'Correct') color = 'hsl(var(--chart-2))';
    else if (name === 'Incorrect') color = 'hsl(var(--chart-5))';
    else if (name === 'Approximate') color = 'hsl(var(--chart-4))';
    else color = 'hsl(var(--primary))';
    return { name, color };
  });
  
  // Aggregate links correctly
  const linkMap: Record<string, number> = {};
  rawLinks.forEach(link => {
      const sourceIndex = nodeMap[link.source];
      const targetIndex = nodeMap[link.target];
      if(sourceIndex === undefined || targetIndex === undefined) return;
      const key = `${sourceIndex}-${targetIndex}`;
      linkMap[key] = (linkMap[key] || 0) + link.value;
  });
  const aggregatedLinks = Object.keys(linkMap).map(key => {
      const [source, target] = key.split('-').map(Number);
      return { source, target, value: linkMap[key] };
  });

  return { nodes, links: aggregatedLinks };
};

const CustomSankeyNode = ({ x, y, width, height, index, payload, containerWidth }: any) => {
    if (!payload || typeof payload.name === 'undefined') return null;
  
    const nodeName = String(payload.name);
    const nodeValue = payload.value !== undefined ? ` (${payload.value.toLocaleString(undefined, {maximumFractionDigits: 1})})` : '';
    const nodeLabel = `${nodeName}${nodeValue}`;
  
    const isFirstColumn = payload.depth === 0;
    const isLastColumn = payload.sourceLinks.length > 0 && payload.targetLinks.length === 0;
  
    let textAnchor = 'start';
    let foreignObjectX = width + 6;
    let foreignObjectWidth = 140; // Max width for the label text
    
    if (isFirstColumn) {
        textAnchor = 'end';
        foreignObjectX = -foreignObjectWidth - 6;
    }

    if (!isFirstColumn && !isLastColumn) {
      // Middle nodes - don't show label to avoid clutter
      return (
        <g transform={`translate(${x},${y})`}>
          <rect height={height} width={width} fill={payload.color || "hsl(var(--muted))"} strokeWidth="0" rx="2" ry="2"/>
        </g>
      );
    }
  
    return (
      <g transform={`translate(${x},${y})`}>
        <rect height={height} width={width} fill={payload.color || "hsl(var(--muted))"} strokeWidth="0" rx="2" ry="2"/>
        <foreignObject x={foreignObjectX} y={-10} width={foreignObjectWidth} height={height + 20}>
            <div
                style={{
                    color: 'hsl(var(--foreground))',
                    fontSize: '12px',
                    textAlign: isFirstColumn ? 'right' : 'left',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    wordBreak: 'break-word',
                    lineHeight: '1.2'
                }}
            >
                {nodeLabel}
            </div>
        </foreignObject>
      </g>
    );
};


interface GoalPerformanceSankeyProps {
  studentSessions: SessionData[];
  activeStudentGoals: Goal[];
  selectedGoalId?: string;
}

const GoalPerformanceSankey: React.FC<GoalPerformanceSankeyProps> = ({ studentSessions, activeStudentGoals, selectedGoalId }) => {
  const sankeyData = useMemo(() => {
    if (studentSessions.length === 0 || activeStudentGoals.length === 0) return { nodes: [], links: [] };
    const goalsForSankey = selectedGoalId ? activeStudentGoals.filter(g => g.id === selectedGoalId) : activeStudentGoals;
    return transformDataForSankeyChart(studentSessions, goalsForSankey);
  }, [studentSessions, activeStudentGoals, selectedGoalId]);

  if (sankeyData.links.length === 0) {
    return null;
  }

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Workflow className="h-6 w-6 text-primary"/>Goal Performance Flow</CardTitle>
        <CardDescription>Flow of opportunities from Goal to Outcome for {selectedGoalId ? `goal: ${activeStudentGoals.find(g => g.id === selectedGoalId)?.name || 'selected goal'}` : 'all active goals'}.</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Sankey 
            data={sankeyData} 
            node={<CustomSankeyNode />} 
            nodePadding={20} 
            margin={{ top: 5, right: 150, bottom: 5, left: 150 }} 
            link={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.5 }}
            iterations={32}
          >
            <RechartsTooltip formatter={(value: any, name: any) => [value.toLocaleString(undefined, {maximumFractionDigits: 1}), name.replace(/([A-Z])/g, ' $1').trim()]} />
          </Sankey>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default GoalPerformanceSankey;
