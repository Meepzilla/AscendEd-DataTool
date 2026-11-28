'use client';

import React from 'react';
import { useWatch, type Control, type FieldValues } from 'react-hook-form';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// The Communication Functions settings shared by the goal and template editors: what the goal is measured by
// (different functions, or total uses across all functions), and, for a goal measured by functions, an optional
// minimum of total uses alongside it (a goal worded "at least 5 times for at least 2 different functions").

interface CommMeasureFieldsProps<T extends FieldValues> {
  // The form's own field names commMeasure and sessionTargetUses are used; the editors' forms all have them.
  control: Control<T>;
}

export default function CommMeasureFields<T extends FieldValues>({ control: typedControl }: CommMeasureFieldsProps<T>) {
  const control = typedControl as unknown as Control<FieldValues>;
  const measure = useWatch({ control, name: 'commMeasure' }) as 'functions' | 'uses' | undefined;
  const byUses = measure === 'uses';
  return (
    <>
      <FormField
        control={control}
        name="commMeasure"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Measure Progress By</FormLabel>
            <Select value={field.value === 'uses' ? 'uses' : 'functions'} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="w-full sm:w-80"><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="functions">Different functions used</SelectItem>
                <SelectItem value="uses">Total uses, all functions</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              {byUses
                ? 'Every use without a prompt (spontaneous or emerging) is added up across all the functions, for goals like "at least 5 times" to request, reject, comment and so on. The session target is a number of uses. Prompted uses are recorded but not counted.'
                : 'The number of different functions used without a prompt, for goals like "at least 3 different functions". The session target is a number of functions.'}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      {!byUses && (
        <FormField
          control={control}
          name="sessionTargetUses"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Minimum Total Uses per Session (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="e.g., 5"
                  {...field}
                  value={field.value ?? ''}
                  onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                  min="0"
                  max="1000"
                />
              </FormControl>
              <FormDescription>
                A session counts toward the target only when the student also reaches this many unprompted uses (spontaneous or emerging) in total, across all functions. Leave blank for no minimum.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}
