'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import type { Goal, TrialStatus } from '@/lib/types';

// What every goal type's inputs get from the goal card (goal-data-input.tsx), and the small layout pieces they share.

export interface GoalInputContext {
  goal: Goal;
  data: Record<string, any>;
  /** The type the goal's data is entered as (its data capture type, else its type). */
  captureType: string;
  isArchived?: boolean;
  isLocked: boolean;
  isFocused?: boolean;
  /** Sets a field (and the fields that follow it); an object sets the goal's whole data. */
  handleChange: (field: string, value: any) => void;
  /** Runs a button's change unless the goal is archived (nothing) or locked (confetti for the student). */
  handleInteraction: (e: React.SyntheticEvent<HTMLButtonElement>, callback: () => void) => void;
  /** The result line: accuracy, % fluent, story score or functions used. */
  calculateAccuracy: () => string;
  handleTrialClick: (index: number, e: React.MouseEvent<HTMLButtonElement>) => void;
  handleFillNextTrial: (status: TrialStatus, e: React.MouseEvent<HTMLButtonElement>) => void;
  handleClearTrials: (e: React.MouseEvent<HTMLButtonElement>) => void;
  handleUndoLastTrial: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const FormItem: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`space-y-0.5 ${className}`}>{children}</div>
);
export const FormLabel: React.FC<{ children: React.ReactNode; htmlFor?: string }> = ({ children, htmlFor }) => (
  <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{children}</Label>
);
