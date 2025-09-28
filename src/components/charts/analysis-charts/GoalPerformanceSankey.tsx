
'use client';

import React, { useMemo } from 'react';
import type { Goal, SessionData, PromptType, GoalType, TrialStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sankey, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Workflow } from 'lucide-react';

interface SankeyNode { name: string; color?: string; }
interface SankeyLink { source: number; target: number; value: number; }
interface SankeyData { nodes: SankeyNode[]; links: SankeyLink[]; }

const transformDataForSankeyChart = (sessions: SessionData[], studentActiveGoals: Goal[]): SankeyData => {
  const rawNodes: SankeyNode[] = [];
  const nodeMap: Record<string, number> = {};

  const addRawNode = (name: string, color?: string): void => {
    if (nodeMap[name] === undefined) {
      nodeMap[name] = rawNodes.length;
      rawNodes.push({ name, color });
    } else if (color && !rawNodes[nodeMap[name]].color) {
      rawNodes[nodeMap[name]].color = color;
    }
  };

  const aggregatedGoalStats: Record<string, { opportunities: number; correct: number; incorrect: number; approximate: number; name: string; type: GoalType; }> = {};

  sessions.forEach(session => {
    session.goals.forEach(goalDataEntry => {
      const originalGoal = studentActiveGoals.find(g => g.id === goalDataEntry.goalId);
      if (!originalGoal || originalGoal.isArchived) return;

      if (!aggregatedGoalStats[originalGoal.id]) {
        aggregatedGoalStats[originalGoal.id] = { opportunities: 0, correct: 0, incorrect: 0, approximate: 0, name: originalGoal.name, type: originalGoal.type };
      }

      let currentCorrect = 0, currentIncorrect = 0, currentApproximate = 0;
      switch (originalGoal.type) {
        case 'ARTICULATION': 
            currentCorrect = Number(goalDataEntry.data.correct) || 0; 
            currentIncorrect = Number(goalDataEntry.data.incorrect) || 0; 
            currentApproximate = Number(goalDataEntry.data.approximate) || 0;
            break;
        case 'LANGUAGE_COMPREHENSION': 
            currentCorrect = Number(goalDataEntry.data.questionsCorrect) || 0; 
            currentIncorrect = Number(goalDataEntry.data.questionsIncorrect) || 0; 
            currentApproximate = Number(goalDataEntry.data.approximate) || 0;
            break;
        case 'LANGUAGE_EXPRESSION': 
            currentCorrect = Number(goalDataEntry.data.successfulResponses) || 0; 
            currentIncorrect = Number(goalDataEntry.data.unsuccessfulResponses) || 0; 
            currentApproximate = Number(goalDataEntry.data.approximate) || 0;
            break;
        case 'PHONOLOGICAL_PROCESSES': 
            currentCorrect = Number(goalDataEntry.data.correctProductions) || 0; 
            currentIncorrect = Number(goalDataEntry.data.incorrectProductions) || 0;
            currentApproximate = Number(goalDataEntry.data.approximate) || 0;
            break;
        case 'FLUENCY_SYLLABLE_STUTTER': 
            const totalSyllables = Number(goalDataEntry.data.totalSyllables) || 0; 
            const stutteredSyllables = Number(goalDataEntry.data.stutteredSyllables) || 0; 
            currentCorrect = Math.max(0, totalSyllables - stutteredSyllables); 
            currentIncorrect = stutteredSyllables; 
            break;
        case 'FEEDING_SWALLOWING': 
            currentCorrect = Number(goalDataEntry.data.trialsAccepted) || 0; 
            currentIncorrect = Number(goalDataEntry.data.trialsRefused) || 0; 
            break;
        case 'SEQUENCED_TRIALS': 
            currentCorrect = Number(goalDataEntry.data.successfulAttempts) || 0; 
            currentIncorrect = Number(goalDataEntry.data.failedAttempts) || 0; 
            currentApproximate = Number(goalDataEntry.data.approximate) || 0;
            break;
        case 'DISCRETE_TRIALS':
            if (Array.isArray(goalDataEntry.data.trials)) {
                currentCorrect = goalDataEntry.data.trials.filter((t: TrialStatus) => t === 'correct').length;
                currentIncorrect = goalDataEntry.data.trials.filter((t: TrialStatus) => t === 'incorrect').length;
                currentApproximate = goalDataEntry.data.trials.filter((t: TrialStatus) => t === 'approximate').length;
            }
            break;
        default: return;
      }
      aggregatedGoalStats[originalGoal.id].opportunities += (currentCorrect + currentIncorrect + currentApproximate);
      aggregatedGoalStats[originalGoal.id].correct += currentCorrect;
      aggregatedGoalStats[originalGoal.id].incorrect += currentIncorrect;
      aggregatedGoalStats[originalGoal.id].approximate += currentApproximate;
    });
  });

  const rawLinks: { source: string; target: string; value: number }[] = [];
  
  const correctOutcomeNodeName = "Correct", incorrectOutcomeNodeName = "Incorrect", approximateOutcomeNodeName = "Approximate";
  addRawNode(correctOutcomeNodeName, 'hsl(var(--chart-2))');
  addRawNode(incorrectOutcomeNodeName, 'hsl(var(--chart-5))');
  addRawNode(approximateOutcomeNodeName, 'hsl(var(--chart-4))');

  const goalTypeNodeNames: Set<string> = new Set();
  Object.values(aggregatedGoalStats).forEach(stats => {
    if (stats.opportunities > 0) {
      goalTypeNodeNames.add(stats.type);
      addRawNode(stats.name, 'hsl(var(--primary))');
    }
  });
  goalTypeNodeNames.forEach(type => addRawNode(type, 'hsl(var(--chart-1))'));

  Object.values(aggregatedGoalStats).forEach(stats => {
    if (stats.opportunities <= 0) return;
    rawLinks.push({ source: stats.type, target: stats.name, value: stats.opportunities });
    if (stats.correct > 0) rawLinks.push({ source: stats.name, target: correctOutcomeNodeName, value: stats.correct });
    if (stats.incorrect > 0) rawLinks.push({ source: stats.name, target: incorrectOutcomeNodeName, value: stats.incorrect });
    if (stats.approximate > 0) rawLinks.push({ source: stats.name, target: approximateOutcomeNodeName, value: stats.approximate });
  });

  const linkedNodeNames = new Set<string>();
  rawLinks.forEach(link => { linkedNodeNames.add(link.source); linkedNodeNames.add(link.target); });
  const finalNodes: SankeyNode[] = rawNodes.filter(node => linkedNodeNames.has(node.name));
  const finalNodeMap: Record<string, number> = {};
  finalNodes.forEach((node, index) => { finalNodeMap[node.name] = index; });
  const finalLinks: SankeyLink[] = rawLinks.filter(link => finalNodeMap[link.source] !== undefined && finalNodeMap[link.target] !== undefined).map(link => ({ source: finalNodeMap[link.source], target: finalNodeMap[link.target], value: link.value }));

  return { nodes: finalNodes, links: finalLinks };
};

const CustomSankeyNode = ({ x, y, width, height, index, payload, containerWidth }: any) => {
    if (!payload || typeof payload.name === 'undefined') return null;
  
    const nodeName = String(payload.name);
    const nodeValue = payload.value !== undefined ? ` (${payload.value.toLocaleString()})` : '';
    const nodeLabel = `${nodeName}${nodeValue}`;
    const textFill = 'hsl(var(--foreground))';
  
    // Use depth for reliable column detection
    const isFirstColumn = payload.depth === 0;
    // The last column nodes have no source links in a simple left-to-right Sankey.
    const isLastColumn = payload.sourceLinks.length === 0 && payload.targetLinks.length > 0;
  
    let textAnchor = 'middle';
    let textX = width / 2;
  
    if (isFirstColumn) {
        textAnchor = 'end';
        textX = -6;
    } else if (isLastColumn) {
        textAnchor = 'start';
        textX = width + 6;
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
        <CardDescription>Flow of opportunities from Goal Type to Specific Goal, then to Correct/Approximate/Incorrect outcomes for {selectedGoalId ? `goal: ${activeStudentGoals.find(g => g.id === selectedGoalId)?.name || 'selected goal'}` : 'all active goals'}.</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Sankey data={sankeyData} node={<CustomSankeyNode />} nodePadding={20} margin={{ top: 5, right: 120, bottom: 5, left: 120 }} linkCurviness={0.5} iterations={32}>
            <RechartsTooltip formatter={(value: any, name: any) => [value.toLocaleString(), name.replace(/([A-Z])/g, ' $1').trim()]} />
          </Sankey>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default GoalPerformanceSankey;
