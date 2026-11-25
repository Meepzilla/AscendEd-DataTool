'use client';

import React from 'react';
import type { GoalChange } from '@/lib/goal-changes';

/**
 * The editor's changes, listed old to new above the Save button. Renders nothing when
 * nothing changed, so an untouched editor looks the same as before.
 */
export default function GoalChangeSummary({ changes }: { changes: GoalChange[] }) {
  if (changes.length === 0) return null;
  return (
    <div className="rounded-md border p-3" aria-live="polite">
      <p className="mb-2 text-sm font-medium">
        Changes ({changes.length}) — saving applies these
      </p>
      <ul className="space-y-1 text-sm">
        {changes.map(change => (
          <li key={change.label} className="flex flex-wrap gap-x-1">
            <span className="font-medium">{change.label}:</span>
            <span className="text-muted-foreground line-through decoration-muted-foreground/60">{change.from}</span>
            <span aria-hidden="true">→</span>
            <span>{change.to}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
