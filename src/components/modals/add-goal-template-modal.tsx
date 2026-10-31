
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
import { GOAL_TYPES, GOAL_TYPE_FIELDS } from '@/lib/goal-constants';
import TargetDirectionField from './TargetDirectionField';
import { goalTypeLabel } from '@/lib/helpers';

type AddGoalTemplateFormData = z.infer<typeof GoalTemplateSchema>;

export default function AddGoalTemplateModal() {
  const { 
    isAddGoalTemplateModalOpen, 
    addGoalTemplateInitialPrompt,
    closeAddGoalTemplateModal, 
    addGoalTemplate, 
    loading: dataLoading 
  } = useStudentData();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddGoalTemplateFormData>({
    resolver: zodResolver(GoalTemplateSchema),
    defaultValues: {
      name: '',
      type: Object.keys(GOAL_TYPES)[0] as GoalType, 
      dataCaptureType: Object.keys(GOAL_TYPE_FIELDS)[0] as GoalType,
      smartGoalPrompt: '',
      generatedSmartGoal: '',
      sessionTargetValue: undefined,
    },
  });
  
  const sortedGoalTypes = React.useMemo(() => Object.entries(GOAL_TYPES).sort(([, a], [, b]) => a.localeCompare(b)), []);
  const sortedDataCaptureTypes = React.useMemo(() => Object.keys(GOAL_TYPE_FIELDS).sort((a, b) => a.localeCompare(b)), []);


  useEffect(() => {
    if (isAddGoalTemplateModalOpen) {
      const defaultType = sortedGoalTypes[0] ? (sortedGoalTypes[0][1] as GoalType) : undefined;
      form.reset({
        name: '',
        type: defaultType,
        dataCaptureType: defaultType,
        smartGoalPrompt: addGoalTemplateInitialPrompt || '',
        generatedSmartGoal: '',
        sessionTargetValue: undefined,
      });
    }
  }, [isAddGoalTemplateModalOpen, addGoalTemplateInitialPrompt, form, sortedGoalTypes]);


  const onSubmit = async (data: AddGoalTemplateFormData) => {
    setIsSubmitting(true);
    const newTemplate = await addGoalTemplate({ ...data, generatedSmartGoal: data.generatedSmartGoal ?? '' });
    setIsSubmitting(false);
    if (newTemplate) {
      closeAddGoalTemplateModal();
    }
  };

  return (
    <GenericModal
      isOpen={isAddGoalTemplateModalOpen}
      onClose={closeAddGoalTemplateModal}
      title="Add New Goal Template"
      description="Create a reusable template for common student goals."
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clinical Goal Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a goal category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sortedGoalTypes.map(([key, value]) => (
                        <SelectItem key={key} value={value}>
                          {goalTypeLabel(value)}
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
              name="dataCaptureType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Capture Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a data capture method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sortedDataCaptureTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {goalTypeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="smartGoalPrompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Goal Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="E.g., Student will produce /r/ in words with 80% accuracy."
                    {...field}
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          

          <FormField
            control={form.control}
            name="generatedSmartGoal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Final SMART Goal</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="The full SMART goal: specific, measurable, achievable, relevant and time-bound."
                    {...field}
                    rows={4}
                    className="bg-muted/30"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <TargetDirectionField control={form.control} goalType={form.watch('dataCaptureType') || form.watch('type')} />

          <FormField
            control={form.control}
            name="sessionTargetValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Session Target Value (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="e.g., 80 (for 80% accuracy)" 
                    {...field} 
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} // '' (not undefined, which react-hook-form replaces with the starting value) = no target
                    min="0"
                    max="100"
                  />
                </FormControl>
                <FormDescription>
                  Target percentage (0-100) for accuracy/fluency goals, a rating for qualitative goals (e.g. 4 out of 5), or the number of different functions for communication functions goals.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeAddGoalTemplateModal} disabled={isSubmitting || dataLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || dataLoading}>
              {isSubmitting || dataLoading ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </form>
      </Form>
    </GenericModal>
  );
}
