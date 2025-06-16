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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROMPT_TYPES } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';

interface GoalDataInputComponentProps {
  goal: Goal;
  data: SessionGoalData['data']; // Current data for this goal
  onChange: (data: SessionGoalData['data']) => void;
}

export default function GoalDataInputComponent({ goal, data, onChange }: GoalDataInputComponentProps) {
  
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
            <FormItem>
              <FormLabel>Prompt Level</FormLabel>
              <Select value={data.promptLevel || 'Independent'} onValueChange={(value) => handleChange('promptLevel', value as PromptType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select prompt level" />
                </SelectTrigger>
                <SelectContent>
                  {PROMPT_TYPES.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormItem>
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
      case 'LANGUAGE_EXPRESSION':
        const isComprehension = goal.type === 'LANGUAGE_COMPREHENSION';
        return (
          <>
             <FormItem>
              <FormLabel>Details / Target Skill</FormLabel>
              <Input
                type="text"
                value={data.details || ''}
                onChange={(e) => handleChange('details', e.target.value)}
                placeholder={isComprehension ? "e.g., WH-questions, 2-step directions" : "e.g., Past tense verbs, describing objects"}
              />
            </FormItem>
            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>{isComprehension ? 'Questions Attempted' : 'Opportunities'}</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data[isComprehension ? 'questionsAttempted' : 'opportunities'] ?? 0}
                  onChange={(e) => handleChange(isComprehension ? 'questionsAttempted' : 'opportunities', parseInt(e.target.value) || 0)}
                />
              </FormItem>
              <FormItem>
                <FormLabel>{isComprehension ? 'Questions Correct' : 'Successful Responses'}</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data[isComprehension ? 'questionsCorrect' : 'successfulResponses'] ?? 0}
                  onChange={(e) => handleChange(isComprehension ? 'questionsCorrect' : 'successfulResponses', parseInt(e.target.value) || 0)}
                />
              </FormItem>
            </div>
            <FormItem>
              <FormLabel>Prompt Level</FormLabel>
              <Select value={data.promptLevel || 'Independent'} onValueChange={(value) => handleChange('promptLevel', value as PromptType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select prompt level" />
                </SelectTrigger>
                <SelectContent>
                  {PROMPT_TYPES.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                </SelectContent>
              </Select>
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
                <FormLabel>Opportunities</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.opportunities ?? 0}
                  onChange={(e) => handleChange('opportunities', parseInt(e.target.value) || 0)}
                />
              </FormItem>
              <FormItem>
                <FormLabel>Correct Productions</FormLabel>
                <Input
                  type="number"
                  min="0"
                  value={data.correctProductions ?? 0}
                  onChange={(e) => handleChange('correctProductions', parseInt(e.target.value) || 0)}
                />
              </FormItem>
            </div>
            <FormItem>
              <FormLabel>Prompt Level</FormLabel>
              <Select value={data.promptLevel || 'Independent'} onValueChange={(value) => handleChange('promptLevel', value as PromptType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select prompt level" />
                </SelectTrigger>
                <SelectContent>
                  {PROMPT_TYPES.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormItem>
          </>
        );
      default:
        return <p className="text-muted-foreground">No specific data fields for this goal type.</p>;
    }
  };

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="p-3 bg-muted/30 rounded-t-lg">
        <CardTitle className="text-base font-semibold flex justify-between items-center">
          <span>{goal.name}</span>
          <Badge variant="outline">{goal.type.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
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

