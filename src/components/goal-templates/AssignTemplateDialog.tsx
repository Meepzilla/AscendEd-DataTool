'use client';

import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStudentData } from '@/hooks/use-student-data';
import { useToast } from '@/hooks/use-toast';
import { hasTemplateGoal } from '@/lib/goal-templates';
import type { GoalTemplate } from '@/lib/types';

/** Gives one goal template to one or more students, from the Goals page. */
export default function AssignTemplateDialog({ template, onClose }: { template: GoalTemplate | null; onClose: () => void }) {
  const { students, assignTemplateToStudents } = useStudentData();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => setSelected(new Set()), [template]);

  const activeStudents = students.filter(s => !s.isArchived).sort((a, b) => a.name.localeCompare(b.name));
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleAssign = async () => {
    if (!template) return;
    const { assigned } = await assignTemplateToStudents(template, [...selected]);
    const names = activeStudents.filter(s => selected.has(s.id)).map(s => s.name).join(', ');
    toast({ title: 'Goal assigned', description: `"${template.name}" was given to ${assigned} student${assigned === 1 ? '' : 's'}: ${names}.` });
    onClose();
  };

  return (
    <Dialog open={!!template} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Students</DialogTitle>
          <DialogDescription className="break-words">{template?.name}</DialogDescription>
        </DialogHeader>
        {activeStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a student first.</p>
        ) : (
          <ScrollArea className="max-h-[50vh] border rounded-md [&_[data-radix-scroll-area-viewport]>div]:!block">
            <ul className="p-1">
              {activeStudents.map(student => {
                const has = !!template && hasTemplateGoal(student, template);
                return (
                  <li key={student.id}>
                    <label className={`flex items-center gap-3 rounded-md px-2 py-2.5 ${has ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'}`}>
                      <Checkbox checked={has || selected.has(student.id)} disabled={has} onCheckedChange={() => toggle(student.id)} />
                      <span className="flex-1 text-sm">{student.name}</span>
                      {has && <span className="text-xs text-muted-foreground">Already has this goal</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAssign} disabled={selected.size === 0}>
            <UserPlus className="mr-2 h-4 w-4" />
            Assign{selected.size > 0 ? ` to ${selected.size}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
