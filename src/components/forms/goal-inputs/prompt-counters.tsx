'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLongPress, longPressStyle } from '@/hooks/use-long-press';
import { PROMPT_TYPES, PROMPT_COLORS, PROMPT_ABBREVIATIONS, PROMPT_HOTKEY_MAP } from '@/lib/promptConstants';
import { applyGoalHotkey, removeCorrect } from '@/lib/data-entry-hotkeys';
import type { GoalType, PromptType } from '@/lib/types';
import { FormItem, FormLabel } from './shared';

// The Prompt Levels buttons under a goal's inputs (for goal types that tally prompts).

interface Props {
  captureType: GoalType;
  data: Record<string, any>;
  onChange: (field: string, data: Record<string, any>) => void;
  isArchived?: boolean;
  interact: (e: React.SyntheticEvent<HTMLButtonElement>, callback: () => void) => void;
}

export default function PromptLevelCounters({ captureType, data, onChange, isArchived, interact }: Props) {
  const { toast } = useToast();
  return (
    <FormItem>
      <FormLabel>Prompt Levels</FormLabel>
      <div className="grid grid-cols-3 gap-1.5 mt-0.5">
        {PROMPT_TYPES.map(pt => {
          const hotkey = Object.keys(PROMPT_HOTKEY_MAP).find(k => PROMPT_HOTKEY_MAP[k as keyof typeof PROMPT_HOTKEY_MAP] === pt);
          const count = Number(data[pt] || 0);
          return (
            <PromptCounterButton
              key={pt}
              promptType={pt}
              count={count}
              hotkey={hotkey}
              disabled={isArchived}
              // Independent also records a correct response, the same as its hotkey.
              onIncrement={(e) => interact(e, () => {
                if (pt !== 'Independent') return onChange(pt, { ...data, [pt]: count + 1 });
                const next = applyGoalHotkey(captureType, 'I', data);
                if (next) return onChange(pt, next);
                if (captureType === 'DISCRETE_TRIALS' || captureType === 'SEQUENCED_TRIALS') {
                  toast({ title: 'All Trials Filled', description: 'Every trial is scored, so there is no trial to mark correct.' });
                  return;
                }
                onChange(pt, { ...data, [pt]: count + 1 });
              })}
              // Removing an Independent prompt also takes back the correct response it added.
              onDecrement={(e) => interact(e, () => {
                if (count === 0) return;
                const lowered = { ...data, [pt]: count - 1 };
                onChange(pt, pt === 'Independent' ? removeCorrect(captureType, lowered) : lowered);
              })}
            />
          );
        })}
      </div>
    </FormItem>
  );
}

interface PromptCounterButtonProps {
  promptType: PromptType;
  count: number;
  hotkey?: string;
  disabled?: boolean;
  onIncrement: (e: React.SyntheticEvent<HTMLButtonElement>) => void;
  onDecrement: (e: React.SyntheticEvent<HTMLButtonElement>) => void;
}

// Tap/click adds one prompt; press and hold (touch) or right-click (mouse) removes one.
function PromptCounterButton({ promptType, count, hotkey, disabled, onIncrement, onDecrement }: PromptCounterButtonProps) {
  const longPressHandlers = useLongPress<HTMLButtonElement>(onDecrement);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="px-2 py-1.5 h-auto text-xs justify-center w-full touch-manipulation"
      style={{
        borderColor: PROMPT_COLORS[promptType],
        color: PROMPT_COLORS[promptType],
        ...longPressStyle,
      }}
      onClick={onIncrement}
      {...longPressHandlers}
      title={`Tap or click to add a ${promptType} prompt. Press and hold, or right-click, to remove one.${hotkey ? ` Hotkey: ${hotkey}` : ''}`}
      disabled={disabled}
    >
      {PROMPT_ABBREVIATIONS[promptType]}: {count}
    </Button>
  );
}
