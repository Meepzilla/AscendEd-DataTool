
'use client';

import React from 'react';
import type { Goal, SessionGoalData, PromptType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { PROMPT_TYPES, PROMPT_COLORS, PROMPT_ABBREVIATIONS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GoalDataInputComponentProps {
  goal: Goal;
  data: SessionGoalData['data']; // Current data for this goal
  onChange: (data: SessionGoalData['data']) => void;
  isFocused?: boolean;
}

export default function GoalDataInputComponent({ goal, data, onChange, isFocused }: GoalDataInputComponentProps) {
  
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const renderInputFields = () => {
    switch (goal.type) {
      case 'ARTICULATION':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Target Sound/Word</FormLabel>
                <Input
                  type="text"
                  value={data.targetSound || ''}
                  onChange={(e) => handleChange('targetSound', e.target.value)}
                  placeholder="e.g., /s/, 'sun'"
                />
              </FormItem>
              <FormItem>
                <FormLabel>Word List (optional)</FormLabel>
                <Input
                  type="text"
                  value={data.wordList || ''}
                  onChange={(e) => handleChange('wordList', e.target.value)}
                  placeholder="e.g., cat, car, cup"
                />
              </FormItem>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Correct</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.correct ?? 0}
                  onChange={(e) => handleChange('correct', parseInt(e.target.value) || 0)}
                />
              </FormItem>
              <FormItem>
                <FormLabel>Incorrect</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.incorrect ?? 0}
                  onChange={(e) => handleChange('incorrect', parseInt(e.target.value) || 0)}
                />
              </FormItem>
            </div>
          </>
        );
      case 'FLUENCY_SYLLABLE_STUTTER':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Total Syllables</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.totalSyllables ?? 0}
                  onChange={(e) => handleChange('totalSyllables', parseInt(e.target.value) || 0)}
                />
              </FormItem>
              <FormItem>
                <FormLabel>Stuttered Syllables</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.stutteredSyllables ?? 0}
                  onChange={(e) => handleChange('stutteredSyllables', parseInt(e.target.value) || 0)}
                />
              </FormItem>
            </div>
             <FormItem>
              <FormLabel>Observation Notes (Type of stutter, context, etc.)</FormLabel>
              <Textarea
                value={data.observationNotes || ''}
                onChange={(e) => handleChange('observationNotes', e.target.value)}
                placeholder="e.g., Repetitions on initial sounds, blocks during reading passage."
                rows={2}
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
                rows={3}
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
              <div className="text-center text-sm font-medium mt-1">{data.rating ?? 3}</div>
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
              />
            </FormItem>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Questions Correct</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.questionsCorrect ?? 0}
                  onChange={(e) => handleChange('questionsCorrect', parseInt(e.target.value) || 0)}
                />
              </FormItem>
              <FormItem>
                <FormLabel>Questions Incorrect</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.questionsIncorrect ?? 0}
                  onChange={(e) => handleChange('questionsIncorrect', parseInt(e.target.value) || 0)}
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
              />
            </FormItem>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Successful Responses</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.successfulResponses ?? 0}
                  onChange={(e) => handleChange('successfulResponses', parseInt(e.target.value) || 0)}
                />
              </FormItem>
              <FormItem>
                <FormLabel>Unsuccessful Responses</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.unsuccessfulResponses ?? 0}
                  onChange={(e) => handleChange('unsuccessfulResponses', parseInt(e.target.value) || 0)}
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
              />
            </FormItem>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Correct Productions</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.correctProductions ?? 0}
                  onChange={(e) => handleChange('correctProductions', parseInt(e.target.value) || 0)}
                />
              </FormItem>
              <FormItem>
                <FormLabel>Incorrect Productions</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.incorrectProductions ?? 0}
                  onChange={(e) => handleChange('incorrectProductions', parseInt(e.target.value) || 0)}
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
                />
              </FormItem>
          </>
        );
      default:
        return <p className="text-muted-foreground">No specific data fields for this goal type.</p>;
    }
  };

  const currentPromptLevel = data.promptLevel || ('Independent' as PromptType);
  const promptColor = PROMPT_COLORS[currentPromptLevel] || '#8B5CF6'; // Default to Independent color

  return (
    <Card className={cn(
        "border-border bg-card/50 transition-all duration-150 ease-in-out",
        isFocused && "ring-2 ring-primary ring-offset-2 shadow-lg"
      )}>
      <CardHeader className="p-3 bg-muted/30 rounded-t-lg">
        <CardTitle className="text-base font-semibold flex justify-between items-center">
          <span className="truncate pr-2">{goal.name}</span>
          <Badge variant="outline">{goal.type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {goal.type !== 'QUALITATIVE_OBSERVATION' && goal.type !== 'FLUENCY_SYLLABLE_STUTTER' && (
          <FormItem>
            <FormLabel>Prompt Level</FormLabel>
            <Badge 
              style={{ backgroundColor: promptColor, color: 'white' }}
              className="text-sm px-3 py-1"
            >
              {currentPromptLevel}
            </Badge>
          </FormItem>
        )}
        {renderInputFields()}
      </CardContent>
    </Card>
  );
}

// Simple wrapper for form items to reduce repetition
const FormItem: React.FC<{children: React.ReactNode, className?: string}> = ({ children, className }) => (
  <div className={`space-y-1 ${className}`}>{children}</div>
);
const FormLabel: React.FC<{children: React.ReactNode, htmlFor?: string}> = ({ children, htmlFor }) => (
  <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{children}</Label>
);
