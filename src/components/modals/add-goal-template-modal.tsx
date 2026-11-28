
'use client';

import React, { useState, useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CommMeasureFields from './CommMeasureFields';
import { Textarea } from '@/components/ui/textarea';
import { GoalTextPreview, PlaceholderChips } from '@/components/goal-templates/PlaceholderChips';
import GoalTypeSelect from '@/components/goal-templates/GoalTypeSelect';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentData } from '@/hooks/use-student-data';
import type { GoalType } from '@/lib/types';
import { GoalTemplateSchema } from '@/lib/schemas';
import { GOAL_TYPES, GOAL_TYPE_FIELDS } from '@/lib/goal-constants';
import TargetDirectionField from '@/components/goal-templates/TargetDirectionField';
import GasLevelDescriptionsField from '@/components/goal-templates/GasLevelDescriptionsField';
import { goalTypeLabel } from '@/lib/helpers';
import { goalMeasureInfo } from '@/lib/goal-measures';
import { withFieldsForCaptureType } from '@/lib/goal-type-fields';

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
    // zod 4 types a preprocessed field's input as unknown; the form holds values of the output's types.
    resolver: zodResolver(GoalTemplateSchema) as Resolver<AddGoalTemplateFormData>,
    defaultValues: {
      name: '',
      type: Object.keys(GOAL_TYPES)[0] as GoalType, 
      dataCaptureType: Object.keys(GOAL_TYPE_FIELDS)[0] as GoalType,
      customType: undefined,
      smartGoalPrompt: '',
      generatedSmartGoal: '',
      gasLevelDescriptions: [],
      sessionTargetValue: undefined,
      sessionTargetUses: undefined,
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
        customType: undefined,
        smartGoalPrompt: addGoalTemplateInitialPrompt || '',
        generatedSmartGoal: '',
        gasLevelDescriptions: Array(5).fill(''),
        sessionTargetValue: undefined,
        sessionTargetUses: undefined,
      });
    }
  }, [isAddGoalTemplateModalOpen, addGoalTemplateInitialPrompt, form, sortedGoalTypes]);


  const onSubmit = async (data: AddGoalTemplateFormData) => {
    setIsSubmitting(true);
    const descriptions = Array.from({ length: 5 }, (_, i) => (data.gasLevelDescriptions?.[i] ?? '').trim());
    const gasLevelDescriptions = descriptions.some(Boolean) ? descriptions : undefined;
    try {
      // A direction or custom type the chosen data capture method can't use is left out (goal-type-fields.ts).
      const newTemplate = await addGoalTemplate(withFieldsForCaptureType({ ...data, generatedSmartGoal: data.generatedSmartGoal ?? '', gasLevelDescriptions }));
      if (newTemplate) {
        closeAddGoalTemplateModal();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCustomType = form.watch('type') === 'CUSTOM';

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

          <div className={isCustomType ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clinical Goal Category</FormLabel>
                  <FormControl>
                    <GoalTypeSelect
                      type={field.value}
                      customType={form.watch('customType')}
                      onChange={(nextType, nextCustom) => {
                        field.onChange(nextType);
                        form.setValue('customType', nextCustom, { shouldDirty: true, shouldValidate: true });
                        if (nextType === 'CUSTOM' && nextCustom) {
                          form.setValue('dataCaptureType', 'CUSTOM', { shouldDirty: true });
                          if (nextCustom.defaultTarget !== undefined) {
                            form.setValue('sessionTargetValue', nextCustom.defaultTarget, { shouldDirty: true });
                          }
                          form.setValue('targetDirection', nextCustom.direction, { shouldDirty: true });
                        } else if (form.getValues('dataCaptureType') === 'CUSTOM') {
                          form.setValue('dataCaptureType', nextType, { shouldDirty: true });
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isCustomType && (
              <FormField
                control={form.control}
                name="dataCaptureType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Capture Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
            )}
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
                    id="new-template-goal-text"
                    placeholder="The full SMART goal: specific, measurable, achievable, relevant and time-bound. e.g. By [date], [student] will … in [opportunities] opportunities."
                    {...field}
                    rows={4}
                    className="bg-muted/30"
                  />
                </FormControl>
                <PlaceholderChips textareaId="new-template-goal-text" value={field.value ?? ''}
                  onChange={v => form.setValue('generatedSmartGoal', v, { shouldDirty: true, shouldValidate: true })} />
                <GoalTextPreview
                  label="As shown for a student (the target date, name and IEP dates come from each student's goal)"
                  goal={{
                    smartGoal: field.value ?? '',
                    sessionTargetValue: form.watch('sessionTargetValue') === undefined || String(form.watch('sessionTargetValue')) === '' ? undefined : Number(form.watch('sessionTargetValue')),
                    type: form.watch('type'), dataCaptureType: form.watch('dataCaptureType'), targetDirection: form.watch('targetDirection'),
                    customType: form.watch('customType'),
                    targetDate: undefined, masterySessions: undefined, blankFills: undefined,
                  }} />
                <FormMessage />
              </FormItem>
            )}
          />

          <TargetDirectionField control={form.control} goalType={form.watch('dataCaptureType') || form.watch('type')} />

          {(form.watch('dataCaptureType') || form.watch('type')) === 'GOAL_ATTAINMENT_SCALE' && (
            <GasLevelDescriptionsField
              values={form.watch('gasLevelDescriptions') ?? []}
              onChange={next => form.setValue('gasLevelDescriptions', next, { shouldDirty: true })}
            />
          )}

          {(() => {
            const targetInfo = goalMeasureInfo({
              type: form.watch('dataCaptureType') || form.watch('type'),
              targetDirection: form.watch('targetDirection'),
              customType: form.watch('customType'),
              commMeasure: form.watch('commMeasure'),
            });
            return (
          <FormField
            control={form.control}
            name="sessionTargetValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Session Target Value (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder={targetInfo.min !== undefined && targetInfo.max !== undefined ? `e.g., 0 (${targetInfo.min} to ${targetInfo.max})` : 'e.g., 80 (for 80% accuracy)'} 
                    {...field} 
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} // '' (not undefined, which react-hook-form replaces with the starting value) = no target
                    step="any" // decimals allowed (an MLU of 3.5, 2.5 minutes); without this the browser refuses them
                    min={targetInfo.min ?? 0}
                    max={targetInfo.max ?? 1000}
                  />
                </FormControl>
                <FormDescription>
                  Target percentage (0-100) for accuracy/fluency goals, a rating for qualitative goals (e.g. 4 out of 5), level (-2 to +2) for GAS goals, or a count/duration/seconds target.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
            );
          })()}

          {/* Communication Functions goals: measured by different functions or by total uses (see CommMeasureFields). */}
          {(form.watch('dataCaptureType') || form.watch('type')) === 'COMMUNICATION_FUNCTIONS' && <CommMeasureFields control={form.control} />}

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
