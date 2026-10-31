'use client';

import React from 'react';
import { Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/helpers';
import { mergeSessions, mergedMinutes } from '@/lib/session-merge';
import type { SessionData } from '@/lib/types';

// Sessions → Merge Selected: what the merged session will be (time span and minutes before and after) before
// the parts are combined.

interface Props {
  sessions: SessionData[];
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function MergeSessionsDialog({ sessions, open, onCancel, onConfirm }: Props) {
  if (sessions.length < 2) return null;
  const merged = mergeSessions(sessions);
  const minutes = mergedMinutes(sessions);
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Merge className="h-5 w-5 text-primary" aria-hidden />Merge {sessions.length} sessions?</DialogTitle>
          <DialogDescription>
            For records of one session saved in parts. They become one session for {merged.studentName} on {formatDate(merged.date)}.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 rounded-md border p-3 text-sm">
          {[...sessions].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')).map(s => (
            <li key={s.sessionId} className="flex justify-between gap-3">
              <span>{s.time}{s.endTime ? `–${s.endTime}` : ''}</span>
              <span className="truncate text-muted-foreground">{s.activity || 'No activity'}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1 text-sm">
          <p><span className="font-semibold">Merged session:</span> {merged.time}{merged.endTime ? `–${merged.endTime}` : ''}</p>
          <p>
            <span className="font-semibold">Service minutes:</span> {minutes.after} min
            {minutes.before !== minutes.after && <span className="text-muted-foreground"> (instead of {minutes.before} min counted separately)</span>}
          </p>
          <p className="text-muted-foreground">
            Counts and trials are added together, each task analysis step keeps its latest score, ratings keep the latest,
            and notes are joined. This can&apos;t be undone except by restoring a backup.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>Merge Sessions</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
