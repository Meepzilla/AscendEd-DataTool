'use client';

import React, { useState } from 'react';
import { UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useStudentData } from '@/hooks/use-student-data';
import { useStudentGroups, type StudentGroup } from '@/lib/student-groups';
import ManageGroupsDialog from './ManageGroupsDialog';

// Data Entry's Load Group button: a menu of saved groups (loading one puts its students in the slots) and
// Manage Groups.

export default function LoadGroupMenu({ onLoad, disabled }: { onLoad: (group: StudentGroup) => void; disabled?: boolean }) {
  const { currentUser } = useStudentData();
  const { groups } = useStudentGroups(currentUser?.uid);
  const [managing, setManaging] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="lg" disabled={disabled} aria-label="Load Group" title="Load a saved group of students into the slots">
            <UsersRound className="mr-2 h-5 w-5" />
            <span className="hidden sm:inline">Load&nbsp;</span>Group
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-64">
          <DropdownMenuLabel>Load a group</DropdownMenuLabel>
          {groups.length === 0 ? (
            <DropdownMenuItem disabled>No groups yet</DropdownMenuItem>
          ) : groups.map(g => (
            <DropdownMenuItem key={g.id} onSelect={() => onLoad(g)}>
              <span className="flex-1 truncate">{g.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{g.studentIds.length}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setManaging(true)}>Manage Groups…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ManageGroupsDialog open={managing} onOpenChange={setManaging} />
    </>
  );
}
