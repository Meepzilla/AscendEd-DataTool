'use client';

import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStudentData } from '@/hooks/use-student-data';
import { useStudentGroups, type StudentGroup } from '@/lib/student-groups';

// Students → Groups (and Data Entry → Load Group → Manage Groups): create, rename, change and delete saved
// groups of students, e.g. a class or a small group, to load into Data Entry together.

export default function ManageGroupsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { students, currentUser } = useStudentData();
  const { groups, saveGroup, deleteGroup } = useStudentGroups(currentUser?.uid);
  const [editing, setEditing] = useState<{ id?: string; name: string; studentIds: Set<string> } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StudentGroup | null>(null);
  const activeStudents = useMemo(() => students.filter(s => !s.isArchived).sort((a, b) => a.name.localeCompare(b.name)), [students]);
  const nameOf = (id: string) => students.find(s => s.id === id && !s.isArchived)?.name;

  const close = (o: boolean) => { if (!o) { setEditing(null); setConfirmDelete(null); } onOpenChange(o); };
  const toggle = (id: string, on: boolean) => setEditing(prev => {
    if (!prev) return prev;
    const next = new Set(prev.studentIds);
    if (on) next.add(id); else next.delete(id);
    return { ...prev, studentIds: next };
  });
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim() || editing.studentIds.size === 0) return;
    // Keeps the group's order, adding new students in alphabetical order.
    const original = groups.find(g => g.id === editing.id)?.studentIds ?? [];
    const ids = [...original.filter(id => editing.studentIds.has(id)), ...activeStudents.map(s => s.id).filter(id => editing.studentIds.has(id) && !original.includes(id))];
    saveGroup({ id: editing.id, name: editing.name, studentIds: ids });
    setEditing(null);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" aria-hidden />Student Groups</DialogTitle>
          <DialogDescription>
            Save a class or small group to load all its students into Data Entry at once (Data Entry → Load Group).
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="group-name">Group name</Label>
              <Input id="group-name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g., Room 12, Tuesday 10:00 group" autoFocus />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Students ({editing.studentIds.size} selected)</legend>
              <ScrollArea className="h-64 rounded-md border">
                <ul className="divide-y">
                  {activeStudents.map(s => (
                    <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox id={`group-student-${s.id}`} checked={editing.studentIds.has(s.id)} onCheckedChange={v => toggle(s.id, v === true)} />
                      <Label htmlFor={`group-student-${s.id}`} className="flex-1 cursor-pointer font-normal">{s.name}</Label>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </fieldset>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Back</Button>
              <Button type="submit" disabled={!editing.name.trim() || editing.studentIds.size === 0}>Save Group</Button>
            </DialogFooter>
          </form>
        ) : confirmDelete ? (
          <div className="space-y-4">
            <p className="text-sm">Delete the group <strong>{confirmDelete.name}</strong>? The students and their data aren&apos;t affected.</p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { deleteGroup(confirmDelete.id); setConfirmDelete(null); }}>Delete Group</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No groups yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {groups.map(g => {
                  const names = g.studentIds.map(nameOf).filter(Boolean);
                  return (
                    <li key={g.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{g.name}</p>
                        <p className="truncate text-xs text-muted-foreground" title={names.join(', ')}>
                          {names.length} student{names.length === 1 ? '' : 's'}: {names.join(', ') || '—'}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit group ${g.name}`} title="Edit group"
                        onClick={() => setEditing({ id: g.id, name: g.name, studentIds: new Set(g.studentIds.filter(id => nameOf(id))) })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Delete group ${g.name}`} title="Delete group" onClick={() => setConfirmDelete(g)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" onClick={() => close(false)}>Close</Button>
              <Button onClick={() => setEditing({ name: '', studentIds: new Set() })} disabled={activeStudents.length === 0}>
                <Plus className="mr-2 h-4 w-4" />New Group
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
