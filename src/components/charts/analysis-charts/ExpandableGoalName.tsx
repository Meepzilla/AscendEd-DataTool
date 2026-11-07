'use client';

import React, { useState } from 'react';
import type { Goal, StudentIep } from '@/lib/types';
import { goalStatement } from '@/lib/helpers';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * A goal name that opens to show the full goal text. Used for the goal titles on the report page
 * (the per-goal cards and the GAS summary table), where only the name fits. The text is the goal
 * as it is shown elsewhere: blanks filled, the target and mastery from the goal's settings, the
 * student's name in place of [student].
 */
export default function ExpandableGoalName({ goal, studentName, studentIep }: {
  goal: Goal;
  studentName?: string;
  studentIep?: StudentIep;
}) {
  const [open, setOpen] = useState(false);
  const fullText = goalStatement(goal, studentName, studentIep);
  return (
    <span className="block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex items-start gap-1 text-left hover:underline"
      >
        <span>{goal.name}</span>
        {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />}
      </button>
      {open && (
        <span className="mt-1 block text-sm font-normal normal-case leading-snug text-muted-foreground">
          {fullText}
        </span>
      )}
    </span>
  );
}
