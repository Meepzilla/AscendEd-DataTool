'use client';

import React from 'react';
import { PLACEHOLDERS } from '@/lib/goal-placeholders';
import { goalStatement } from '@/lib/helpers';
import type { StudentIep } from '@/lib/types';

// Goal text editors: buttons that insert a placeholder ("[student]", "[date]"…) where the cursor is in the goal
// text, and a preview of the text as it will be shown (goal-placeholders.ts, goalStatement).

interface ChipsProps {
  /** The id of the goal text box. */
  textareaId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function PlaceholderChips({ textareaId, value, onChange, disabled }: ChipsProps) {
  const insert = (token: string) => {
    const box = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    const text = value ?? '';
    // At the cursor (or over the selection) when the box has it, otherwise at the end.
    const start = box && document.activeElement === box ? box.selectionStart : text.length;
    const end = box && document.activeElement === box ? box.selectionEnd : text.length;
    const before = text.slice(0, start);
    const spaced = (before && !/\s$/.test(before) ? ' ' : '') + token;
    onChange(before + spaced + text.slice(end));
    const caret = before.length + spaced.length;
    requestAnimationFrame(() => {
      if (!box) return;
      box.focus();
      box.setSelectionRange(caret, caret);
    });
  };
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">
        Insert a placeholder; it is filled in from the student and the goal wherever the goal is shown:
      </p>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Insert a placeholder into the goal text">
        {PLACEHOLDERS.map(p => (
          <button
            key={p.key}
            type="button"
            disabled={disabled}
            title={p.description}
            aria-label={`Insert ${p.token}: ${p.description}`}
            // Keep the cursor in the text box while the button is pressed.
            onMouseDown={e => e.preventDefault()}
            onClick={() => insert(p.token)}
            className="rounded-full border px-2 py-0.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {p.token}
          </button>
        ))}
      </div>
    </div>
  );
}

interface PreviewProps {
  goal: Parameters<typeof goalStatement>[0];
  studentName?: string;
  studentIep?: StudentIep;
  /** Shown above the text. */
  label?: string;
}

/** The goal text as it will be shown, when that differs from what was typed (placeholders, blanks, the name). */
export function GoalTextPreview({ goal, studentName, studentIep, label }: PreviewProps) {
  const shown = goalStatement(goal, studentName, studentIep);
  if (!shown || shown === goal.smartGoal) return null;
  return (
    <div className="rounded-md border border-dashed p-3 text-sm" aria-live="polite">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label ?? 'As shown on the profile, Data Entry and reports'}</p>
      <p>{shown}</p>
    </div>
  );
}
