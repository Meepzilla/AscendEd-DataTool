
'use client';

import React from 'react';
import type { Goal, SessionGoalData, PromptType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { PROMPT_TYPES, PROMPT_COLORS, PROMPT_ABBREVIATIONS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
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
    onChange(field, { ...data, [field]: value });
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
                <Input
                  type="number"
                  min="0"
                  value={data.correct ?? 0}
                  onChange={(e) => handleChange('correct', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </FormItem>
              <FormItem>
                <FormLabel>Incorrect</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.incorrect ?? 0}
                  onChange={(e) => handleChange('incorrect', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
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
                <Input
                  type="number"
                  min="0"
                  value={data.totalSyllables ?? 0}
                  onChange={(e) => handleChange('totalSyllables', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </FormItem>
              <FormItem>
                <FormLabel>Stuttered Syllables</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.stutteredSyllables ?? 0}
                  onChange={(e) => handleChange('stutteredSyllables', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
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
                defaultValue={[data.rating ?? 3]}
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
                placeholder={"e.g., WH-questions, 2-step directions"}
                className="h-8 text-sm"
              />
            </FormItem>
            <div className="grid grid-cols-2 gap-1">
              <FormItem>
                <FormLabel>Questions Correct</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.questionsCorrect ?? 0}
                  onChange={(e) => handleChange('questionsCorrect', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </FormItem>
              <FormItem>
                <FormLabel>Questions Incorrect</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.questionsIncorrect ?? 0}
                  onChange={(e) => handleChange('questionsIncorrect', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </FormItem>
            </div>
             <FormItem>
                <FormLabel>Questions Attempted (Optional)</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.questionsAttempted ?? ((data.questionsCorrect ?? 0) + (data.questionsIncorrect ?? 0))}
                  onChange={(e) => handleChange('questionsAttempted', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </FormItem>
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
                placeholder={"e.g., Past tense verbs, describing objects"}
                className="h-8 text-sm"
              />
            </FormItem>
            <div className="grid grid-cols-2 gap-1">
              <FormItem>
                <FormLabel>Successful Responses</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.successfulResponses ?? 0}
                  onChange={(e) => handleChange('successfulResponses', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </FormItem>
              <FormItem>
                <FormLabel>Unsuccessful Responses</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.unsuccessfulResponses ?? 0}
                  onChange={(e) => handleChange('unsuccessfulResponses', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </FormItem>
            </div>
            <FormItem>
              <FormLabel>Opportunities (Optional)</FormLabel>
              <Input
                  type="number"
                  min="0"
                  value={data.opportunities ?? ((data.successfulResponses ?? 0) + (data.unsuccessfulResponses ?? 0))}
                  onChange={(e) => handleChange('opportunities', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
            </FormItem>
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
                <Input
                  type="number"
                  min="0"
                  value={data.correctProductions ?? 0}
                  onChange={(e) => handleChange('correctProductions', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </FormItem>
              <FormItem>
                <FormLabel>Incorrect Productions</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.incorrectProductions ?? 0}
                  onChange={(e) => handleChange('incorrectProductions', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </FormItem>
            </div>
            <FormItem>
                <FormLabel>Opportunities (Optional)</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.opportunities ?? ((data.correctProductions ?? 0) + (data.incorrectProductions ?? 0))}
                  onChange={(e) => handleChange('opportunities', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </FormItem>
          </>
        );
      default:
        return <p className="text-muted-foreground text-xs">No specific data fields for this goal type.</p>;
    }
  };

  const showPromptCounters = goal.type !== 'QUALITATIVE_OBSERVATION' && goal.type !== 'FLUENCY_SYLLABLE_STUTTER';

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
            <div className="flex-grow">
                <CardTitle className="text-sm font-semibold flex items-center">
                  <span className="truncate pr-1">{goal.name}</span>
                  <Badge variant="outline" className="ml-auto mr-1 whitespace-nowrap text-xs px-1.5 py-0.5">
                    {goal.type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
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
        {showPromptCounters && (
          <FormItem>
            <FormLabel>Prompt Counts</FormLabel>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {PROMPT_TYPES.map(pt => (
                <Badge key={pt} variant="outline" className="px-1.5 py-0.5 text-xs" style={{ borderColor: PROMPT_COLORS[pt], color: PROMPT_COLORS[pt] }}>
                  {PROMPT_ABBREVIATIONS[pt]}: {Number(data[pt] || 0)}
                </Badge>
              ))}
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

