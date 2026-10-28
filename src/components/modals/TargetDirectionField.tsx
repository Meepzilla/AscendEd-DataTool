'use client';

import React from 'react';
import type { Control } from 'react-hook-form';
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Increase/decrease choice for behavior goals (shown only when `goalType` is a behavior type). Decrease
 * goals are met when the count, minutes or incidents stay at or below the target.
 */
export default function TargetDirectionField({ control, goalType }: { control: Control<any>; goalType?: string }) {
  if (!goalType?.startsWith('BEHAVIOR_')) return null;
  return (
    <FormField
      control={control}
      name="targetDirection"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Goal Direction</FormLabel>
          <Select value={field.value ?? 'decrease'} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger><SelectValue /></SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="decrease">Decrease (target is a maximum)</SelectItem>
              <SelectItem value="increase">Increase (target is a minimum)</SelectItem>
            </SelectContent>
          </Select>
          <FormDescription>
            Behavior targets: occurrences per session (frequency), total minutes (duration), or for ABC data the
            number of incidents (decrease) or % of incidents where the replacement skill was used (increase).
          </FormDescription>
        </FormItem>
      )}
    />
  );
}
