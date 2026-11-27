'use client';

import React, { Suspense, useState } from 'react';
import { UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useStudentData } from '@/hooks/use-student-data';
import type { StudentGroup } from '@/lib/student-groups';
import { useStudentGroups } from '@/hooks/use-student-groups';
import { LazyBoundary, retryableLazy } from '@/components/ui/lazy-boundary';

const ManageGroupsDialog = retryableLazy(() => import('./ManageGroupsDialog'));

// Data Entry's Load Group button: a menu of saved groups (loading one puts its students in the slots) and
// Manage Groups.

export default function LoadGroupMenu({ onLoad, disabled, size = 'lg', className }: { onLoad: (group: StudentGroup) => void; disabled?: boolean; size?: 'sm' | 'lg'; className?: string }) {
  const { currentUser } = useStudentData();
  const { groups } = useStudentGroups(currentUser?.uid);
  const [managing, setManaging] = useState(false);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} className={className} disabled={disabled} aria-label="Load Group" title="Load a saved group of students into the slots">
            <UsersRound className={size === 'sm' ? 'mr-2 h-4 w-4' : 'mr-2 h-5 w-5'} />
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
      {managing && (
        <LazyBoundary label="Manage Groups dialog" floating onDismiss={() => setManaging(false)}>
          <Suspense fallback={null}>
            <ManageGroupsDialog open={managing} onOpenChange={setManaging} />
          </Suspense>
        </LazyBoundary>
      )}
    </>
  );
}
