'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Archive } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import GoalTextPopover from '@/components/forms/GoalTextPopover';
import { useStudentData } from '@/hooks/use-student-data';
import { findDuplicateGroups, hasTemplateGoal } from '@/lib/goal-templates';
import { goalTypeLabel } from '@/lib/helpers';
import type { GoalTemplate } from '@/lib/types';

// Groups the user marked "Not duplicates" (per device), by their template ids.
const DISMISSED_KEY = 'ascended_duplicates_dismissed_v1_';
const groupKey = (group: GoalTemplate[]) => group.map(t => t.id).sort().join('|');

function readDismissed(userId?: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY + (userId || 'guest')) || '[]'));
  } catch {
    return new Set();
  }
}

/**
 * Lists goal templates that look like duplicates, side by side. For each group the user picks the one to
 * keep and archives the rest (archived templates are hidden from goal lists and can be restored; goals
 * already given to students are copies and are not affected), or marks the group as not duplicates.
 */
export default function DuplicateFinderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { goalTemplates, students, archiveGoalTemplates, currentUser } = useStudentData();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [keep, setKeep] = useState<Record<string, string>>({});

  useEffect(() => { if (open) setDismissed(readDismissed(currentUser?.uid)); }, [open, currentUser?.uid]);

  const usage = (template: GoalTemplate) => students.filter(s => hasTemplateGoal(s, template)).length;

  const groups = useMemo(
    () => (open ? findDuplicateGroups(goalTemplates).filter(g => !dismissed.has(groupKey(g))) : []),
    [open, goalTemplates, dismissed]
  );

  // Suggested template to keep: the one most students have, then your own over a built-in one.
  const suggested = (group: GoalTemplate[]) =>
    [...group].sort((a, b) => usage(b) - usage(a) || Number(!!a.isDefault) - Number(!!b.isDefault))[0].id;

  const dismiss = (group: GoalTemplate[]) => {
    const next = new Set(dismissed).add(groupKey(group));
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY + (currentUser?.uid || 'guest'), JSON.stringify([...next])); } catch { /* not remembered */ }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Find Duplicate Goals</DialogTitle>
          <DialogDescription>
            Goals with the same or nearly the same wording. Choose the one to keep in each group and archive the others.
            Archived goals are hidden from goal lists and can be restored with Show Archived; students who already
            have one keep it.
          </DialogDescription>
        </DialogHeader>

        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No duplicate goals found.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{groups.length} group{groups.length === 1 ? '' : 's'} found.</p>
            {groups.map(group => {
              const key = groupKey(group);
              const keepId = keep[key] && group.some(t => t.id === keep[key]) ? keep[key] : suggested(group);
              const others = group.filter(t => t.id !== keepId);
              return (
                <div key={key} className="rounded-md border p-3 space-y-3">
                  <RadioGroup value={keepId} onValueChange={id => setKeep(prev => ({ ...prev, [key]: id }))} className="gap-2">
                    {group.map(template => {
                      const used = usage(template);
                      return (
                        <label key={template.id} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/40 cursor-pointer">
                          <RadioGroupItem value={template.id} className="mt-1" aria-label={`Keep ${template.name}`} />
                          <div className="min-w-0 flex-1 space-y-1">
                            <GoalTextPopover name={template.name} smartGoal={template.generatedSmartGoal} description={template.smartGoalPrompt} className="text-sm font-medium break-words" />
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant="secondary">{goalTypeLabel(template.type)}</Badge>
                              {template.category && <Badge variant="outline">{template.category}</Badge>}
                              <Badge variant="outline">{template.isDefault ? 'Built-in' : 'Yours'}</Badge>
                              {used > 0 && <span className="text-xs text-muted-foreground">Used by {used} student{used === 1 ? '' : 's'}</span>}
                            </div>
                          </div>
                          {template.id === keepId && <span className="text-xs font-medium text-primary shrink-0">Keep</span>}
                        </label>
                      );
                    })}
                  </RadioGroup>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => dismiss(group)}>Not Duplicates</Button>
                    <Button size="sm" onClick={() => archiveGoalTemplates(others.map(t => t.id))}>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive {others.length === 1 ? 'the Other' : `the Other ${others.length}`}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
