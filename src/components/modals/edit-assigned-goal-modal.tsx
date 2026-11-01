
'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useStudentData } from '@/hooks/use-student-data';
import type { Goal } from '@/lib/types';
import { AssignedGoalEditSchema } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GOAL_TYPE_FIELDS } from '@/lib/goal-constants';
import TargetDirectionField from './TargetDirectionField';
import { goalTypeLabel } from '@/lib/helpers';
import { automaticBlankValues, findBlanks } from '@/lib/goal-blanks';

type EditAssignedGoalFormData = z.infer<typeof AssignedGoalEditSchema>;

interface EditAssignedGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  goalToEdit: Goal;
}

export default function EditAssignedGoalModal({ isOpen, onClose, studentId, goalToEdit }: EditAssignedGoalModalProps) {
  const { updateStudentGoal, students, loading: dataLoading } = useStudentData();
  const studentName = students.find(s => s.id === studentId)?.name;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const sortedDataCaptureTypes = React.useMemo(() => Object.keys(GOAL_TYPE_FIELDS).sort((a, b) => a.localeCompare(b)), []);


  const form = useForm<EditAssignedGoalFormData>({
    resolver: zodResolver(AssignedGoalEditSchema),
    defaultValues: {
      name: '',
      smartGoal: '',
      sessionTargetValue: undefined,
      isArchived: false,
      dataCaptureType: undefined,
    },
  });

  useEffect(() => {
    if (goalToEdit && isOpen) {
      form.reset({
        name: goalToEdit.name,
        smartGoal: goalToEdit.smartGoal,
        sessionTargetValue: goalToEdit.sessionTargetValue,
        targetDate: goalToEdit.targetDate ?? '',
        taskSteps: (goalToEdit.taskSteps ?? []).join('\n') as unknown as string[],
        baseline: goalToEdit.baseline ?? ('' as unknown as number),
        baselineDate: goalToEdit.baselineDate ?? '',
        masterySessions: goalToEdit.masterySessions ?? ('' as unknown as number),
        blankFills: goalToEdit.blankFills ?? [],
        targetDirection: goalToEdit.targetDirection,
        isArchived: goalToEdit.isArchived || false,
        dataCaptureType: goalToEdit.dataCaptureType || goalToEdit.type,
      });
    }
  }, [goalToEdit, isOpen, form]);

  const onSubmit = async (data: EditAssignedGoalFormData) => {
    if (!goalToEdit) return;
    setIsSubmitting(true);
    try {
      // One fill per blank in the (possibly edited) text; empty ones use the automatic value.
      const blankCount = findBlanks(data.smartGoal).length;
      const blankFills = Array.from({ length: blankCount }, (_, i) => (data.blankFills?.[i] ?? '').trim());
      await updateStudentGoal(studentId, goalToEdit.id, { ...data, blankFills: blankFills.some(Boolean) ? blankFills : undefined });
      toast({ title: 'Success', description: 'Goal updated successfully.' });
      onClose();
    } catch (error) {
      console.error('Error updating assigned goal:', error);
      toast({ title: 'Error', description: 'Failed to update goal.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Assigned Goal: ${goalToEdit?.name}`}
      description={`Changes apply only to ${studentName ?? 'this student'}. The goal template and other students with this goal stay as they are.`}
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
                <FormLabel>Goal Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter goal name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="smartGoal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SMART Goal Text</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe the SMART goal..."
                    {...field}
                    rows={4}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <BlankFills form={form} />

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
                <FormDescription>
                  This determines the type of data entry fields shown for this goal.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {(form.watch('dataCaptureType') || goalToEdit?.type) === 'TASK_ANALYSIS' && (
            <FormField
              control={form.control}
              name="taskSteps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Steps</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={6}
                      placeholder={'One step per line, in order, e.g.\nTurn on water\nWet hands\nGet soap'}
                      value={Array.isArray(field.value) ? field.value.join('\n') : (field.value as unknown as string) ?? ''}
                      onChange={e => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    One step per line, in order. In Data Entry each step is scored Independent, with a prompt level, or
                    Not done; the goal&apos;s measure is the percentage of steps done independently.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <TargetDirectionField control={form.control} goalType={form.watch('dataCaptureType') || goalToEdit?.type} />

          <FormField
            control={form.control}
            name="sessionTargetValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Session Target Value (Optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="e.g., 80 (for 80%)"
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

          <FormField
            control={form.control}
            name="targetDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Date (Optional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={(field.value as string | undefined) ?? ''} className="w-full sm:w-56" />
                </FormControl>
                <FormDescription>
                  When the goal&apos;s criteria should be met by (for example, the IEP&apos;s annual review date). It fills in &quot;[date]&quot; in the goal text and is shown with the target on the progress report.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Progress monitoring: the aim line runs from the baseline to the target at the target date; mastery is
              the target met in a number of sessions in a row. Shown on Reports and the progress report. */}
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="baseline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Baseline (Optional)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="e.g., 40" {...field} value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="baselineDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Baseline Date (Optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={(field.value as string | undefined) ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="masterySessions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mastery: Sessions in a Row</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="20" placeholder="3" {...field} value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <p className="-mt-2 text-sm text-muted-foreground">
            The baseline is where the student started, in the goal&apos;s measure (e.g. 40 for 40%). With a target and a
            target date it draws an aim line on the charts and shows whether the student is on track. The goal counts as
            mastered when the target is met in the set number of sessions in a row (3 if left blank).
          </p>

          <FormField
            control={form.control}
            name="isArchived"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <FormLabel>Archive Goal</FormLabel>
                  <FormDescription>
                    Archived goals are hidden from active lists but data is retained.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />


          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting || dataLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || dataLoading}>
              {isSubmitting || dataLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </GenericModal>
  );
}

/**
 * Fill in the Blanks: a box for each blank ("___") in the goal text, labelled with the words around it. A blank the
 * goal's target or mastery answers shows that value as its placeholder and is filled with it unless something is
 * typed. The goal is shown with its blanks filled; the text itself keeps them.
 */
function BlankFills({ form }: { form: ReturnType<typeof useForm<EditAssignedGoalFormData>> }) {
  const [text, target, mastery, fills] = form.watch(['smartGoal', 'sessionTargetValue', 'masterySessions', 'blankFills']);
  const blanks = findBlanks(text ?? '');
  if (blanks.length === 0) return null;
  const toNumber = (v: unknown) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? undefined : Number(v));
  const automatic = automaticBlankValues(text ?? '', { sessionTargetValue: toNumber(target), masterySessions: toNumber(mastery) });
  const setFill = (index: number, value: string) => {
    const next = Array.from({ length: blanks.length }, (_, i) => (fills ?? [])[i] ?? '');
    next[index] = value;
    form.setValue('blankFills', next, { shouldDirty: true });
  };
  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">Fill in the Blanks</legend>
      <p className="text-xs text-muted-foreground">
        What each blank in the goal text says when the goal is shown. Blanks the target answers fill in on their own
        (shown greyed); type to use something else.
      </p>
      {blanks.map(blank => (
        <div key={blank.index} className="space-y-1">
          <label htmlFor={`goal-blank-${blank.index}`} className="block text-xs text-muted-foreground">
            {blank.before ? `…${blank.before} ` : ''}<span className="font-semibold text-foreground">[blank {blank.index + 1}]</span>{blank.after ? ` ${blank.after}…` : ''}
          </label>
          <Input
            id={`goal-blank-${blank.index}`}
            value={(fills ?? [])[blank.index] ?? ''}
            placeholder={automatic[blank.index] ?? 'Leave empty to keep the blank'}
            onChange={e => setFill(blank.index, e.target.value)}
          />
        </div>
      ))}
    </fieldset>
  );
}
