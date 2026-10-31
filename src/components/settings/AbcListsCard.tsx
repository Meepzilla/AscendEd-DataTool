'use client';

import React, { useState } from 'react';
import { Plus, RotateCcw, X, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAbcLists } from '@/hooks/use-abc-lists';
import { DEFAULT_ABC_LISTS, saveAbcLists, type AbcLists } from '@/lib/abc-lists';
import { ABC_REPLACEMENT_BEHAVIOR, BEHAVIOR_FUNCTIONS, type BehaviorFunction } from '@/lib/goal-constants';

const NO_FUNCTION = 'none';
const MAX_ITEM_LENGTH = 60;

/** An editable list: rows with move-up and remove, and a field to add an item. */
const ListEditor: React.FC<{
  title: string;
  description: string;
  items: string[];
  onChange: (items: string[]) => void;
  renderExtra?: (index: number) => React.ReactNode;
  onAdd?: (item: string) => void;
}> = ({ title, description, items, onChange, renderExtra, onAdd }) => {
  const [newItem, setNewItem] = useState('');
  const trimmed = newItem.trim();
  const isDuplicate = items.some(i => i.toLowerCase() === trimmed.toLowerCase()) || trimmed.toLowerCase() === ABC_REPLACEMENT_BEHAVIOR.toLowerCase();
  const add = () => {
    if (!trimmed || isDuplicate) return;
    if (onAdd) onAdd(trimmed);
    else onChange([...items, trimmed]);
    setNewItem('');
  };
  const move = (index: number) => {
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    return next;
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={item} className="flex items-center gap-1 rounded border px-2 py-1 text-sm">
            <span className="flex-grow min-w-0 break-words">{item}</span>
            {renderExtra?.(index)}
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Move up" aria-label={`Move ${item} up`}
              disabled={index === 0} onClick={() => onChange(move(index))}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Remove" aria-label={`Remove ${item}`}
              disabled={items.length <= 1} onClick={() => onChange(items.filter((_, i) => i !== index))}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} maxLength={MAX_ITEM_LENGTH} placeholder="Add an item" aria-label={`Add to ${title}`} className="h-8 text-sm" />
        <Button type="submit" size="sm" variant="outline" className="h-8 shrink-0" disabled={!trimmed || isDuplicate}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      </form>
      {trimmed && isDuplicate && <p className="text-xs text-destructive">That item is already in the list.</p>}
    </div>
  );
};

export default function AbcListsCard() {
  const lists = useAbcLists();
  const { toast } = useToast();
  const save = (next: AbcLists) => saveAbcLists(next);

  const consequenceLabels = lists.consequences.map(c => c.label);
  const setConsequenceLabels = (labels: string[]) =>
    save({ ...lists, consequences: labels.map(label => lists.consequences.find(c => c.label === label) ?? { label, fn: null }) });
  const setFunction = (index: number, fn: BehaviorFunction | null) =>
    save({ ...lists, consequences: lists.consequences.map((c, i) => (i === index ? { ...c, fn } : c)) });

  const isDefault = JSON.stringify(lists) === JSON.stringify(DEFAULT_ABC_LISTS);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ABC Data Lists</CardTitle>
        <CardDescription>
          The choices shown when recording ABC behavior data. Changes apply to new incidents; incidents already
          recorded keep what was chosen. &quot;{ABC_REPLACEMENT_BEHAVIOR}&quot; is always offered first as the behavior.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <ListEditor
            title="A: Antecedents"
            description="What happened right before the behavior."
            items={lists.antecedents}
            onChange={(antecedents) => save({ ...lists, antecedents })}
          />
          <ListEditor
            title="B: Behaviors"
            description="Problem behaviors to record."
            items={lists.behaviors}
            onChange={(behaviors) => save({ ...lists, behaviors })}
          />
          <ListEditor
            title="C: Consequences"
            description="What happened right after. Each can suggest a behavior function for the ABC summary."
            items={consequenceLabels}
            onChange={setConsequenceLabels}
            onAdd={(label) => save({ ...lists, consequences: [...lists.consequences, { label, fn: null }] })}
            renderExtra={(index) => (
              <Select
                value={lists.consequences[index].fn ?? NO_FUNCTION}
                onValueChange={(v) => setFunction(index, v === NO_FUNCTION ? null : (v as BehaviorFunction))}
              >
                <SelectTrigger className="h-7 w-auto min-w-[6.5rem] gap-1 text-xs shrink-0" aria-label={`Function for ${lists.consequences[index].label}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FUNCTION}>No function</SelectItem>
                  {BEHAVIOR_FUNCTIONS.map(fn => <SelectItem key={fn} value={fn}>{fn}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={isDefault}
            onClick={() => {
              saveAbcLists(null);
              toast({ title: 'ABC lists reset', description: 'The default antecedents, behaviors and consequences are back.' });
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
