
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
  
  const aggregatedStats: Record<string, {
    name: string;
    type: GoalType;
    prompts: Record<PromptType, { correct: number; incorrect: number; approximate: number }>;
  }> = {};

  sessions.forEach(session => {
    session.goals.forEach(goalDataEntry => {
      const originalGoal = studentActiveGoals.find(g => g.id === goalDataEntry.goalId);
      if (!originalGoal || originalGoal.isArchived) return;
      
      if (!aggregatedStats[originalGoal.id]) {
        aggregatedStats[originalGoal.id] = {
          name: originalGoal.name,
          type: originalGoal.type,
          prompts: Object.fromEntries(PROMPT_TYPES.map(p => [p, { correct: 0, incorrect: 0, approximate: 0 }])) as Record<PromptType, { correct: number; incorrect: number; approximate: number }>,
        };
      }

      let currentCorrect = 0, currentIncorrect = 0, currentApproximate = 0;
      // Simplified outcome calculation logic
      switch (originalGoal.type) {
        case 'ARTICULATION': case 'LANGUAGE_COMPREHENSION': case 'LANGUAGE_EXPRESSION': case 'PHONOLOGICAL_PROCESSES':
            currentCorrect = Number(goalDataEntry.data.correct || goalDataEntry.data.questionsCorrect || goalDataEntry.data.successfulResponses || goalDataEntry.data.correctProductions) || 0;
            currentIncorrect = Number(goalDataEntry.data.incorrect || goalDataEntry.data.questionsIncorrect || goalDataEntry.data.unsuccessfulResponses || goalDataEntry.data.incorrectProductions) || 0;
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
        case 'DISCRETE_TRIALS': case 'SEQUENCED_TRIALS':
            if (Array.isArray(goalDataEntry.data.trials)) {
                currentCorrect = goalDataEntry.data.trials.filter((t: TrialStatus) => t === 'correct').length;
                currentIncorrect = goalDataEntry.data.trials.filter((t: TrialStatus) => t === 'incorrect').length;
                currentApproximate = goalDataEntry.data.trials.filter((t: TrialStatus) => t === 'approximate').length;
            }
            break;
      }
      
      const totalOpportunities = currentCorrect + currentIncorrect + currentApproximate;
      if (totalOpportunities === 0) return;

      // Distribute outcomes across used prompts
      const goalPrompts = goalDataEntry.data;
      const usedPrompts = PROMPT_TYPES.filter(p => goalPrompts[p] > 0);
      const totalPromptCount = usedPrompts.reduce((sum, p) => sum + goalPrompts[p], 0);

      if (totalPromptCount > 0) {
        usedPrompts.forEach(prompt => {
            const promptWeight = goalPrompts[prompt] / totalPromptCount;
            aggregatedStats[originalGoal.id].prompts[prompt].correct += currentCorrect * promptWeight;
            aggregatedStats[originalGoal.id].prompts[prompt].incorrect += currentIncorrect * promptWeight;
            aggregatedStats[originalGoal.id].prompts[prompt].approximate += currentApproximate * promptWeight;
        });
      } else { // If no prompts, assume 'Independent'
          aggregatedStats[originalGoal.id].prompts['Independent'].correct += currentCorrect;
          aggregatedStats[originalGoal.id].prompts['Independent'].incorrect += currentIncorrect;
          aggregatedStats[originalGoal.id].prompts['Independent'].approximate += currentApproximate;
      }
    });
  });

  const rawLinks: { source: string; target: string; value: number }[] = [];
  
  // Define outcome nodes
  const correctNode = "Correct", incorrectNode = "Incorrect", approximateNode = "Approximate";
  addRawNode(correctNode, 'hsl(var(--chart-2))');
  addRawNode(incorrectNode, 'hsl(var(--chart-5))');
  addRawNode(approximateNode, 'hsl(var(--chart-4))');

  const goalTypeNodeNames: Set<string> = new Set();
  const promptNodeNames: Set<string> = new Set();

  Object.values(aggregatedStats).forEach(goalStats => {
    goalTypeNodeNames.add(goalStats.type);
    addRawNode(goalStats.name, 'hsl(var(--primary))');
    
    let totalGoalOpportunities = 0;
    PROMPT_TYPES.forEach(prompt => {
      const { correct, incorrect, approximate } = goalStats.prompts[prompt];
      const totalPromptValue = correct + incorrect + approximate;
      if (totalPromptValue > 0) {
        promptNodeNames.add(prompt);
        totalGoalOpportunities += totalPromptValue;
        rawLinks.push({ source: goalStats.name, target: prompt, value: totalPromptValue });
        if (correct > 0) rawLinks.push({ source: prompt, target: correctNode, value: correct });
        if (incorrect > 0) rawLinks.push({ source: prompt, target: incorrectNode, value: incorrect });
        if (approximate > 0) rawLinks.push({ source: prompt, target: approximateNode, value: approximate });
      }
    });

    if (totalGoalOpportunities > 0) {
      rawLinks.push({ source: goalStats.type, target: goalStats.name, value: totalGoalOpportunities });
    }
  });

  goalTypeNodeNames.forEach(type => addRawNode(type, 'hsl(var(--chart-1))'));
  promptNodeNames.forEach(prompt => addRawNode(prompt, 'hsl(var(--chart-3))'));
  
  const linkedNodeNames = new Set<string>();
  rawLinks.forEach(link => { linkedNodeNames.add(link.source); linkedNodeNames.add(link.target); });
  const finalNodes: SankeyNode[] = rawNodes.filter(node => linkedNodeNames.has(node.name));
  const finalNodeMap: Record<string, number> = {};
  finalNodes.forEach((node, index) => { finalNodeMap[node.name] = index; });
  const finalLinks: SankeyLink[] = rawLinks
    .filter(link => finalNodeMap[link.source] !== undefined && finalNodeMap[link.target] !== undefined && link.value > 0.1)
    .map(link => ({ source: finalNodeMap[link.source], target: finalNodeMap[link.target], value: link.value }));

  return { nodes: finalNodes, links: finalLinks };
};

const CustomSankeyNode = ({ x, y, width, height, index, payload, containerWidth }: any) => {
    if (!payload || typeof payload.name === 'undefined') return null;
  
    const nodeName = String(payload.name);
    const nodeValue = payload.value !== undefined ? ` (${payload.value.toLocaleString(undefined, {maximumFractionDigits: 1})})` : '';
    const nodeLabel = `${nodeName}${nodeValue}`;
    const textFill = 'hsl(var(--foreground))';
  
    const isFirstColumn = payload.depth === 0;
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
        <CardDescription>Flow of opportunities from Goal Type to Goal, to Prompt, then to Outcome for {selectedGoalId ? `goal: ${activeStudentGoals.find(g => g.id === selectedGoalId)?.name || 'selected goal'}` : 'all active goals'}.</CardDescription>
      </CardHeader>
      <CardContent className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Sankey 
            data={sankeyData} 
            node={<CustomSankeyNode />} 
            nodePadding={20} 
            margin={{ top: 5, right: 120, bottom: 5, left: 120 }} 
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
