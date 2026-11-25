'use client';

import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useCustomGoalTypes } from '@/lib/custom-goal-types';
import { GOAL_TYPES } from '@/lib/goal-constants';
import { CUSTOM_MEASURE_KIND_INFO, cloneCustomGoalType } from '@/lib/goal-types/custom';
import { goalTypeLabel } from '@/lib/helpers';
import type { CustomGoalType, GoalType } from '@/lib/types';

const CustomGoalTypeModal = lazy(() => import('@/components/modals/custom-goal-type-modal'));

const CREATE_NEW_VALUE = '__CREATE_CUSTOM_GOAL_TYPE__';

interface GoalTypeSelectProps {
  id?: string;
  type: GoalType;
  customType?: CustomGoalType;
  onChange: (type: GoalType, customType?: CustomGoalType) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function GoalTypeSelect({
  id,
  type,
  customType,
  onChange,
  disabled,
  placeholder = 'Select a goal type',
}: GoalTypeSelectProps) {
  const { currentUser } = useAuth();
  const { customTypes, saveCustomType } = useCustomGoalTypes(currentUser?.uid);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const builtInTypes = useMemo(
    () => (Object.values(GOAL_TYPES) as GoalType[]).sort((a, b) => goalTypeLabel(a).localeCompare(goalTypeLabel(b))),
    [],
  );

  const availableCustomTypes = useMemo(() => {
    const active = customTypes.filter(t => !t.isArchived);
    if (type === 'CUSTOM' && customType && !active.some(t => t.id === customType.id)) {
      return [customType, ...active];
    }
    return active;
  }, [customTypes, type, customType]);

  const selectValue = type === 'CUSTOM' && customType ? `CUSTOM:${customType.id}` : type;

  const handleValueChange = (val: string) => {
    if (val === CREATE_NEW_VALUE) {
      setIsBuilderOpen(true);
      return;
    }
    if (val.startsWith('CUSTOM:')) {
      const id = val.slice('CUSTOM:'.length);
      const found = availableCustomTypes.find(t => t.id === id);
      if (found) {
        onChange('CUSTOM', cloneCustomGoalType(found));
      }
      return;
    }
    onChange(val as GoalType, undefined);
  };

  return (
    <>
      <Select value={selectValue} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {availableCustomTypes.length > 0 && (
            <>
              <SelectGroup>
                <SelectLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  My Custom Types
                </SelectLabel>
                {availableCustomTypes.map((ct) => (
                  <SelectItem key={`CUSTOM:${ct.id}`} value={`CUSTOM:${ct.id}`}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ct.color }}
                        aria-hidden
                      />
                      <span>{ct.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({CUSTOM_MEASURE_KIND_INFO[ct.kind].shortLabel})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
            </>
          )}
          <SelectGroup>
            {availableCustomTypes.length > 0 && (
              <SelectLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Built-In
              </SelectLabel>
            )}
            {builtInTypes.map((bt) => (
              <SelectItem key={bt} value={bt}>
                {goalTypeLabel(bt)}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value={CREATE_NEW_VALUE} className="text-primary font-medium">
            ＋ Create a new goal type…
          </SelectItem>
        </SelectContent>
      </Select>

      {isBuilderOpen && (
        <Suspense fallback={null}>
          <CustomGoalTypeModal
            isOpen={isBuilderOpen}
            onClose={() => setIsBuilderOpen(false)}
            saveCustomType={saveCustomType}
            onSave={(saved) => {
              onChange('CUSTOM', cloneCustomGoalType(saved));
            }}
          />
        </Suspense>
      )}
    </>
  );
}
