
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentData } from '@/hooks/use-student-data';
import { GoalTemplateSchema, GoalType, type GoalTemplate } from '@/lib/types';
import { GOAL_TYPES } from '@/lib/constants';
import { generateSmartGoal } from '@/ai/flows/smart-goal-generation';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type EditGoalTemplateFormData = z.infer<typeof GoalTemplateSchema>;

interface EditGoalTemplateModalProps {
  templateToEdit: GoalTemplate | null;
}

export default function EditGoalTemplateModal({ templateToEdit }: EditGoalTemplateModalProps) {
  const {
    goalTemplates, 
    closeEditGoalTemplateModal,
    updateGoalTemplate,
    loading: dataLoading
  } = useStudentData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const { toast } = useToast();

  const currentTemplate = goalTemplates.find(t => t.id === templateToEdit?.id) || null;

  const form = useForm<EditGoalTemplateFormData>({
    resolver: zodResolver(GoalTemplateSchema),
    defaultValues: {
      name: '',
      type: Object.keys(GOAL_TYPES)[0] as GoalType,
      smartGoalPrompt: '',
      generatedSmartGoal: '',
      sessionTargetValue: undefined,
    },
  });

  useEffect(() => {
    if (currentTemplate) {
      form.reset({
        name: currentTemplate.name,
        type: currentTemplate.type,
        smartGoalPrompt: currentTemplate.smartGoalPrompt,
        generatedSmartGoal: currentTemplate.generatedSmartGoal,
        sessionTargetValue: currentTemplate.sessionTargetValue,
      });
    }
  }, [currentTemplate, form]);

  const handleGenerateSmartGoal = async () => {
    const promptValue = form.getValues('smartGoalPrompt');
    if (!promptValue.trim()) {
      form.setError('smartGoalPrompt', { type: 'manual', message: 'Prompt cannot be empty for AI generation.' });
      return;
    }
    setIsAiGenerating(true);
    try {
      const result = await generateSmartGoal({ goalPrompt: promptValue });
      if (result.smartGoal) {
        form.setValue('generatedSmartGoal', result.smartGoal, { shouldValidate: true });
        toast({ title: "AI Success", description: "SMART goal re-generated!" });
      } else {
        toast({ title: "AI Info", description: "AI did not return a goal. Please refine your prompt.", variant: "default" });
      }
    } catch (error) {
      console.error("Error generating SMART goal:", error);
      toast({ title: "AI Error", description: "Failed to generate SMART goal. Check console for details.", variant: "destructive" });
      form.setValue('generatedSmartGoal', "Error generating goal. Please try again or write manually.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const onSubmit = async (data: EditGoalTemplateFormData) => {
    if (!currentTemplate) return;
    setIsSubmitting(true);
    await updateGoalTemplate(currentTemplate.id, data);
    setIsSubmitting(false);
  };

  if (!currentTemplate) return null;

  return (
    <GenericModal
      isOpen={!!currentTemplate}
      onClose={closeEditGoalTemplateModal}
      title={`Edit Goal Template: ${currentTemplate.name}`}
      size="lg"
    >
      <Form {...form}>
        <form 
          onSubmit={form.handleSubmit(onSubmit)} 
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit(onSubmit)();
            }
          }}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Initial /s/ sound production" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Goal Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a goal type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(GOAL_TYPES).map(([key, value]) => (
                      <SelectItem key={key} value={value}>
                        {value.replace(/_/g, ' ').toLocaleLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="smartGoalPrompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SMART Goal Prompt (for AI)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the goal for the AI to make it SMART."
                    {...field}
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="button" variant="outline" onClick={handleGenerateSmartGoal} disabled={isAiGenerating || dataLoading}>
            {isAiGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
            )}
            {form.getValues('generatedSmartGoal') ? 'Re-generate' : 'Generate'} SMART Goal with AI
          </Button>

          <FormField
            control={form.control}
            name="generatedSmartGoal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Final SMART Goal</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="The generated or manually entered SMART goal will appear here."
                    {...field}
                    rows={4}
                    className="bg-muted/30"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sessionTargetValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Session Target Value (Optional)</FormLabel>
                <FormControl>
                   <Input
                    type="number"
                    placeholder="e.g., 10"
                    {...field}
                    value={field.value ?? ''} 
                    onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>
                  Update the numerical target for this goal within a single session.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeEditGoalTemplateModal} disabled={isSubmitting || dataLoading || isAiGenerating}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || dataLoading || isAiGenerating}>
              {isSubmitting || dataLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </GenericModal>
  );
}
