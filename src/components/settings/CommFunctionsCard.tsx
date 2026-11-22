'use client';

import React, { useState } from 'react';
import { ArrowUp, Eye, Plus, RotateCcw, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCommFunctions } from '@/hooks/use-comm-functions';
import {
  MAX_COMM_FUNCTIONS, MAX_COMM_FUNCTION_LABEL, isCommFunctionsDamaged, newCommFunctionKey, saveCommFunctions,
} from '@/lib/comm-functions';
import { DEFAULT_COMM_FUNCTIONS, type CommFunction } from '@/lib/goal-constants/communication';

// Settings → Communication Functions: the functions tallied by Communication Functions goals in Data Entry. Like the
// ABC lists, they can be added, reordered and removed, and reset to the defaults. A removed function is hidden rather
// than deleted, so sessions that used it keep their counts and names in Reports; it can be shown again.

export default function CommFunctionsCard() {
  const list = useCommFunctions();
  const { toast } = useToast();
  const [newLabel, setNewLabel] = useState('');
  const shown = list.filter(f => !f.hidden);
  const hidden = list.filter(f => f.hidden);
  const trimmed = newLabel.trim();
  const duplicate = shown.some(f => f.label.toLowerCase() === trimmed.toLowerCase());
  const full = list.length >= MAX_COMM_FUNCTIONS && !hidden.some(f => f.label.toLowerCase() === trimmed.toLowerCase());

  const save = (next: CommFunction[] | null, done?: string) => {
    try {
      saveCommFunctions(next);
      if (done) toast({ title: done });
    } catch (error) {
      toast({ title: "Couldn't save", description: error instanceof Error ? error.message : 'The communication functions could not be saved.', variant: 'destructive' });
    }
  };

  const add = () => {
    if (!trimmed || duplicate) return;
    // A hidden function with this name comes back (keeping its past data) instead of a second one being made.
    const existing = hidden.find(f => f.label.toLowerCase() === trimmed.toLowerCase());
    if (existing) save(list.map(f => (f === existing ? { ...f, hidden: false } : f)));
    else if (full) return;
    else save([...list, { key: newCommFunctionKey(trimmed, list), label: trimmed }]);
    setNewLabel('');
  };
  // Moves a shown function above the shown one before it (hidden ones keep their places).
  const moveUp = (fn: CommFunction) => {
    const index = shown.indexOf(fn);
    if (index <= 0) return;
    const reordered = [...shown];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    save([...reordered, ...hidden]);
  };
  const setHidden = (fn: CommFunction, value: boolean) => save(list.map(f => (f === fn ? { ...f, hidden: value || undefined } : f)));

  const isDefault = JSON.stringify(list) === JSON.stringify(DEFAULT_COMM_FUNCTIONS);

  return (
    <Card id="communication-functions">
      <CardHeader>
        <CardTitle>Communication Functions</CardTitle>
        <CardDescription>
          The functions tallied by Communication Functions goals in Data Entry (spontaneous, emerging and prompted).
          Removing a function hides it from Data Entry; sessions that already used it keep their counts and names in
          Reports, and it can be shown again below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isCommFunctionsDamaged() && (
          <p className="text-sm text-destructive">The saved communication functions could not be read, so the defaults are shown and changes won&apos;t be saved. Restore a backup in Settings to replace them.</p>
        )}
        <ul className="space-y-1">
          {shown.map((fn, index) => (
            <li key={fn.key} className="flex items-center gap-1 rounded border px-2 py-1 text-sm">
              <span className="flex-grow min-w-0 break-words">{fn.label}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 min-h-11 min-w-11 shrink-0" title="Move up" aria-label={`Move ${fn.label} up`}
                disabled={index === 0} onClick={() => moveUp(fn)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 min-h-11 min-w-11 shrink-0" title="Remove" aria-label={`Remove ${fn.label}`}
                disabled={shown.length <= 1} onClick={() => setHidden(fn, true)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={MAX_COMM_FUNCTION_LABEL}
            placeholder="Add a function, e.g. Sharing information" aria-label="Add a communication function" className="h-9 text-sm" />
          <Button type="submit" size="sm" variant="outline" className="h-9 min-h-11 shrink-0" disabled={!trimmed || duplicate || full}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </form>
        {trimmed && duplicate && <p className="text-xs text-destructive">That function is already in the list.</p>}
        {trimmed && !duplicate && full && <p className="text-xs text-destructive">The list holds at most {MAX_COMM_FUNCTIONS} functions, removed ones included.</p>}

        {hidden.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Removed (kept for past sessions)</p>
            <ul className="space-y-1">
              {hidden.map(fn => (
                <li key={fn.key} className="flex items-center gap-1 rounded border border-dashed px-2 py-1 text-sm text-muted-foreground">
                  <span className="flex-grow min-w-0 break-words">{fn.label}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 min-h-11 shrink-0" onClick={() => setHidden(fn, false)} aria-label={`Show ${fn.label} again`}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> Show again
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button type="button" variant="outline" size="sm" disabled={isDefault}
          onClick={() => save(null, 'Communication functions reset')}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset to defaults
        </Button>
        {!isDefault && hidden.length + shown.length > DEFAULT_COMM_FUNCTIONS.length && (
          <p className="text-xs text-muted-foreground">Resetting removes the functions you added from Data Entry; sessions that used them keep their counts.</p>
        )}
      </CardContent>
    </Card>
  );
}
