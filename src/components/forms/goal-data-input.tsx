
'use client';

import React from 'react';
import type { Goal, SessionGoalData, PromptType, GoalType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { PROMPT_TYPES, PROMPT_COLORS, PROMPT_ABBREVIATIONS, PROMPT_HOTKEY_MAP } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, ArrowUp, ArrowDown, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GoalDataInputComponentProps {
  goal: Goal;
  data: SessionGoalData['data'];
  onChange: (updatedFieldName: string, newData: SessionGoalData['data']) => void;
  isFocused?: boolean;
  id: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export default function GoalDataInputComponent({
  goal,
  data,
  onChange,
  isFocused,
  id,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: GoalDataInputComponentProps) {

  const handleChange = (field: string, value: any) => {
    // If 'value' is an object, it's assumed to be the complete new data state for this goal.
    // Otherwise, it's a single field update.
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      onChange(field, value);
    } else {
      onChange(field, { ...data, [field]: value });
    }
  };

  const calculateAccuracy = (): string => {
    let correct = 0;
    let totalOpportunities = 0;
    const type = goal.type;

    switch (type) {
      case 'ARTICULATION':
        correct = Number(data.correct || 0);
        totalOpportunities = correct + Number(data.incorrect || 0);
        break;
      case 'LANGUAGE_COMPREHENSION':
        correct = Number(data.questionsCorrect || 0);
        totalOpportunities = (data.questionsAttempted !== undefined && Number(data.questionsAttempted || 0) > 0)
          ? Number(data.questionsAttempted || 0)
          : (correct + Number(data.questionsIncorrect || 0));
        if (data.questionsAttempted !== undefined && correct > totalOpportunities && totalOpportunities > 0) correct = totalOpportunities; // Ensure correct isn't more than attempted if attempted is specified
        break;
      case 'LANGUAGE_EXPRESSION':
        correct = Number(data.successfulResponses || 0);
        totalOpportunities = (data.opportunities !== undefined && Number(data.opportunities || 0) > 0 && (Number(data.successfulResponses || 0) + Number(data.unsuccessfulResponses || 0) <= Number(data.opportunities || 0)))
          ? Number(data.opportunities || 0)
          : (correct + Number(data.unsuccessfulResponses || 0));
        if (data.opportunities !== undefined && correct > totalOpportunities && totalOpportunities > 0) correct = totalOpportunities;
        break;
      case 'PHONOLOGICAL_PROCESSES':
        correct = Number(data.correctProductions || 0);
        totalOpportunities = (data.opportunities !== undefined && Number(data.opportunities || 0) > 0 && (Number(data.correctProductions || 0) + Number(data.incorrectProductions || 0) <= Number(data.opportunities || 0)))
          ? Number(data.opportunities || 0)
          : (correct + Number(data.incorrectProductions || 0));
        if (data.opportunities !== undefined && correct > totalOpportunities && totalOpportunities > 0) correct = totalOpportunities;
        break;
      case 'FLUENCY_SYLLABLE_STUTTER':
        const totalSyllables = Number(data.totalSyllables || 0);
        const stutteredSyllables = Number(data.stutteredSyllables || 0);
        correct = Math.max(0, totalSyllables - stutteredSyllables);
        totalOpportunities = totalSyllables;
        break;
      default:
        return 'N/A';
    }

    if (totalOpportunities === 0) return 'N/A (0%)';
    const percentage = (correct / totalOpportunities) * 100;
    return `${percentage.toFixed(1)}%`;
  };


  const renderInputFields = () => {
    switch (goal.type) {
      case 'ARTICULATION':
        return (
          <>
            <div className="grid grid-cols-2 gap-1">
              <FormItem>
                <FormLabel>Target Sound/Word</FormLabel>
                <Input
                  type="text"
                  value={data.targetSound || ''}
                  onChange={(e) => handleChange('targetSound', e.target.value)}
                  placeholder="e.g., /s/, 'sun'"
                  className="h-8 text-sm"
                />
              </FormItem>
              <FormItem>
                <FormLabel>Word List (optional)</FormLabel>
                <Input
                  type="text"
                  value={data.wordList || ''}
                  onChange={(e) => handleChange('wordList', e.target.value)}
                  placeholder="e.g., cat, car, cup"
                  className="h-8 text-sm"
                />
              </FormItem>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <FormItem>
                <FormLabel>Correct</FormLabel>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('correct', Math.max(0, (Number(data.correct) || 0) - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.correct ?? 0} onChange={(e) => handleChange('correct', parseInt(e.target.value) || 0)} className="h-8 text-sm text-center w-16" />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('correct', (Number(data.correct) || 0) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
              <FormItem>
                <FormLabel>Incorrect</FormLabel>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('incorrect', Math.max(0, (Number(data.incorrect) || 0) - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.incorrect ?? 0} onChange={(e) => handleChange('incorrect', parseInt(e.target.value) || 0)} className="h-8 text-sm text-center w-16" />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('incorrect', (Number(data.incorrect) || 0) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
            </div>
          </>
        );
      case 'FLUENCY_SYLLABLE_STUTTER':
        return (
          <>
            <div className="grid grid-cols-2 gap-1">
              <FormItem>
                <FormLabel>Total Syllables</FormLabel>
                 <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('totalSyllables', Math.max(0, (Number(data.totalSyllables) || 0) - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.totalSyllables ?? 0} onChange={(e) => handleChange('totalSyllables', parseInt(e.target.value) || 0)} className="h-8 text-sm text-center w-16" />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('totalSyllables', (Number(data.totalSyllables) || 0) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
              <FormItem>
                <FormLabel>Stuttered Syllables</FormLabel>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('stutteredSyllables', Math.max(0, (Number(data.stutteredSyllables) || 0) - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.stutteredSyllables ?? 0} onChange={(e) => handleChange('stutteredSyllables', parseInt(e.target.value) || 0)} className="h-8 text-sm text-center w-16" />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('stutteredSyllables', (Number(data.stutteredSyllables) || 0) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
            </div>
             <FormItem>
              <FormLabel>Observation Notes (Type of stutter, context, etc.)</FormLabel>
              <Textarea
                value={data.observationNotes || ''}
                onChange={(e) => handleChange('observationNotes', e.target.value)}
                placeholder="e.g., Repetitions on initial sounds..."
                rows={1}
                className="text-sm"
              />
            </FormItem>
          </>
        );
      case 'QUALITATIVE_OBSERVATION':
        return (
          <>
            <FormItem>
              <FormLabel>Observation Notes</FormLabel>
              <Textarea
                value={data.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Describe observed behaviors, participation, etc."
                rows={1}
                className="text-sm"
              />
            </FormItem>
            <FormItem>
              <FormLabel>Rating (1-5)</FormLabel>
              <Slider
                value={[data.rating ?? 3]}
                min={1} max={5} step={1}
                onValueChange={(value) => handleChange('rating', value[0])}
                className="pt-2"
              />
              <div className="text-center text-xs font-medium mt-1">{data.rating ?? 3}</div>
            </FormItem>
          </>
        );
      case 'LANGUAGE_COMPREHENSION':
        return (
          <>
             <FormItem>
              <FormLabel>Details / Target Skill</FormLabel>
              <Input
                type="text"
                value={data.details || ''}
                onChange={(e) => handleChange('details', e.target.value)}
                placeholder="e.g., WH-questions, 2-step directions"
                className="h-8 text-sm"
              />
            </FormItem>
            <div className="grid grid-cols-2 gap-1">
              <FormItem>
                <FormLabel>Questions Correct</FormLabel>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('questionsCorrect', Math.max(0, (Number(data.questionsCorrect) || 0) - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.questionsCorrect ?? 0} onChange={(e) => handleChange('questionsCorrect', parseInt(e.target.value) || 0)} className="h-8 text-sm text-center w-16" />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('questionsCorrect', (Number(data.questionsCorrect) || 0) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
              <FormItem>
                <FormLabel>Questions Incorrect</FormLabel>
                 <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('questionsIncorrect', Math.max(0, (Number(data.questionsIncorrect) || 0) - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.questionsIncorrect ?? 0} onChange={(e) => handleChange('questionsIncorrect', parseInt(e.target.value) || 0)} className="h-8 text-sm text-center w-16" />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('questionsIncorrect', (Number(data.questionsIncorrect) || 0) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <FormItem>
                <FormLabel>Accuracy</FormLabel>
                <p className="text-sm font-semibold text-primary h-8 flex items-center pt-0.5">
                  {calculateAccuracy()}
                </p>
              </FormItem>
              <FormItem>
                <FormLabel>Questions Attempted (Optional)</FormLabel>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('questionsAttempted', Math.max(0, (Number(data.questionsAttempted ?? ((data.questionsCorrect ?? 0) + (data.questionsIncorrect ?? 0))) || 0) - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.questionsAttempted ?? ((data.questionsCorrect ?? 0) + (data.questionsIncorrect ?? 0))} onChange={(e) => handleChange('questionsAttempted', parseInt(e.target.value) || 0)} className="h-8 text-sm text-center w-16" />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('questionsAttempted', (Number(data.questionsAttempted ?? ((data.questionsCorrect ?? 0) + (data.questionsIncorrect ?? 0))) || 0) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
            </div>
          </>
        );
      case 'LANGUAGE_EXPRESSION':
         return (
          <>
             <FormItem>
              <FormLabel>Details / Target Skill</FormLabel>
              <Input
                type="text"
                value={data.details || ''}
                onChange={(e) => handleChange('details', e.target.value)}
                placeholder="e.g., Past tense verbs, describing objects"
                className="h-8 text-sm"
              />
            </FormItem>
            <div className="grid grid-cols-2 gap-1">
              <FormItem>
                <FormLabel>Successful Responses</FormLabel>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('successfulResponses', Math.max(0, (Number(data.successfulResponses) || 0) - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.successfulResponses ?? 0} onChange={(e) => handleChange('successfulResponses', parseInt(e.target.value) || 0)} className="h-8 text-sm text-center w-16" />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('successfulResponses', (Number(data.successfulResponses) || 0) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
              <FormItem>
                <FormLabel>Unsuccessful Responses</FormLabel>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('unsuccessfulResponses', Math.max(0, (Number(data.unsuccessfulResponses) || 0) - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.unsuccessfulResponses ?? 0} onChange={(e) => handleChange('unsuccessfulResponses', parseInt(e.target.value) || 0)} className="h-8 text-sm text-center w-16" />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('unsuccessfulResponses', (Number(data.unsuccessfulResponses) || 0) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
            </div>
          </>
        );
      case 'PHONOLOGICAL_PROCESSES':
        return (
          <>
             <FormItem>
              <FormLabel>Target Process</FormLabel>
              <Input
                type="text"
                value={data.targetProcess || ''}
                onChange={(e) => handleChange('targetProcess', e.target.value)}
                placeholder="e.g., Fronting, Stopping"
                className="h-8 text-sm"
              />
            </FormItem>
            <div className="grid grid-cols-2 gap-1">
              <FormItem>
                <FormLabel>Correct Productions</FormLabel>
                 <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('correctProductions', Math.max(0, (Number(data.correctProductions) || 0) - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.correctProductions ?? 0} onChange={(e) => handleChange('correctProductions', parseInt(e.target.value) || 0)} className="h-8 text-sm text-center w-16" />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('correctProductions', (Number(data.correctProductions) || 0) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
              <FormItem>
                <FormLabel>Incorrect Productions</FormLabel>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('incorrectProductions', Math.max(0, (Number(data.incorrectProductions) || 0) - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                  <Input type="number" min="0" value={data.incorrectProductions ?? 0} onChange={(e) => handleChange('incorrectProductions', parseInt(e.target.value) || 0)} className="h-8 text-sm text-center w-16" />
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleChange('incorrectProductions', (Number(data.incorrectProductions) || 0) + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </FormItem>
            </div>
          </>
        );
      default:
        return <p className="text-muted-foreground text-xs">No specific data fields for this goal type.</p>;
    }
  };

  const showPromptCounters = goal.type !== 'QUALITATIVE_OBSERVATION' && goal.type !== 'FLUENCY_SYLLABLE_STUTTER';
  const showAccuracyDisplay = goal.type !== 'QUALITATIVE_OBSERVATION';


  return (
    <Card
      id={id}
      className={cn(
        "border-border bg-card/50 transition-all duration-150 ease-in-out",
        isFocused && "ring-2 ring-primary ring-offset-2 shadow-lg"
      )}>
      <CardHeader className="p-2 bg-muted/30 rounded-t-lg">
        <div className="flex justify-between items-start">
            <div className="flex flex-col items-center space-y-0.5 shrink-0 mr-1">
                {onMoveUp && (
                    <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={onMoveUp} disabled={!canMoveUp} title="Move goal up">
                        <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                )}
                {onMoveDown && (
                     <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={onMoveDown} disabled={!canMoveDown} title="Move goal down">
                        <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>
            <div className="flex-grow min-w-0">
                <CardTitle className="text-sm font-semibold">
                    <div className="flex justify-between items-start">
                        <span className="whitespace-normal break-words mr-1">{goal.name}</span>
                        <Badge variant="outline" className="whitespace-nowrap text-xs px-1.5 py-0.5 shrink-0">
                            {goal.type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                    </div>
                </CardTitle>
                {goal.sessionTargetValue !== undefined && (
                <div className="text-xs text-muted-foreground flex items-center gap-0.5 pt-0.5">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    Target: {goal.sessionTargetValue}{goal.type !== 'QUALITATIVE_OBSERVATION' ? '%' : ''}
                </div>
                )}
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 space-y-1.5">
        {renderInputFields()}

        {showAccuracyDisplay && goal.type !== 'LANGUAGE_COMPREHENSION' && (
          <div className="mt-1.5">
            <FormLabel>Accuracy</FormLabel>
            <p className="text-sm font-semibold text-primary h-8 flex items-center">
              {calculateAccuracy()}
            </p>
          </div>
        )}

        {showPromptCounters && (
          <FormItem>
            <FormLabel>Prompt Levels</FormLabel>
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {PROMPT_TYPES.map(pt => {
                const hotkey = Object.keys(PROMPT_HOTKEY_MAP).find(k => PROMPT_HOTKEY_MAP[k] === pt);
                return (
                    <Button
                        key={pt}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="px-2 py-1 h-auto text-xs min-w-[60px] justify-center"
                        style={{
                        borderColor: PROMPT_COLORS[pt],
                        color: PROMPT_COLORS[pt],
                        }}
                        onClick={() => {
                            const currentCount = Number(data[pt] || 0);
                            const newCount = currentCount + 1;
                            let updatedData = { ...data, [pt]: newCount };
                            if (pt === 'Independent') {
                                switch(goal.type) {
                                    case 'ARTICULATION': updatedData.correct = newCount; break;
                                    case 'LANGUAGE_COMPREHENSION': updatedData.questionsCorrect = newCount; break;
                                    case 'LANGUAGE_EXPRESSION': updatedData.successfulResponses = newCount; break;
                                    case 'PHONOLOGICAL_PROCESSES': updatedData.correctProductions = newCount; break;
                                }
                            }
                            onChange(pt, updatedData);
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            const currentCount = Number(data[pt] || 0);
                            const newCount = Math.max(0, currentCount - 1);
                            let updatedData = { ...data, [pt]: newCount };
                             if (pt === 'Independent') {
                                switch(goal.type) {
                                    case 'ARTICULATION': updatedData.correct = newCount; break;
                                    case 'LANGUAGE_COMPREHENSION': updatedData.questionsCorrect = newCount; break;
                                    case 'LANGUAGE_EXPRESSION': updatedData.successfulResponses = newCount; break;
                                    case 'PHONOLOGICAL_PROCESSES': updatedData.correctProductions = newCount; break;
                                }
                            }
                            onChange(pt, updatedData);
                        }}
                        title={`Click to increment ${pt}, Right-click to decrement. ${hotkey ? `Hotkeys: ${hotkey} / Alt+${hotkey}` : ''}`}
                    >
                        {PROMPT_ABBREVIATIONS[pt]}: {Number(data[pt] || 0)}
                    </Button>
                );
            })}
            </div>
          </FormItem>
        )}
      </CardContent>
    </Card>
  );
}

const FormItem: React.FC<{children: React.ReactNode, className?: string}> = ({ children, className }) => (
  <div className={`space-y-0.5 ${className}`}>{children}</div>
);
const FormLabel: React.FC<{children: React.ReactNode, htmlFor?: string}> = ({ children, htmlFor }) => (
  <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{children}</Label>
);

