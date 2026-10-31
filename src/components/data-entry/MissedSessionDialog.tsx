'use client';

import React, { useState } from 'react';
import { CalendarX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { MISSED_REASONS, MISSED_REASON_LABELS, type MissedReason } from '@/lib/attendance';

// A student card's "Missed" button: records that the session didn't take place, and why, on the session date and
// times set above. Data already entered on the card is kept (it isn't part of the missed session).

interface Props {
  studentName: string;
  disabled?: boolean;
  onRecord: (reason: MissedReason, note: string) => Promise<boolean>;
}

export default function MissedSessionDialog({ studentName, disabled, onRecord }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<MissedReason>('student-absent');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const close = () => { setOpen(false); setReason('student-absent'); setNote(''); };
  const save = async () => {
    setSaving(true);
    const ok = await onRecord(reason, note.trim());
    setSaving(false);
    if (ok) close();
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={disabled}
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        title="Record a missed session"
        aria-label={`Record a missed session for ${studentName}`}
      >
        <CalendarX className="h-5 w-5 text-muted-foreground" />
      </Button>
      <Dialog open={open} onOpenChange={o => { if (!o) close(); }}>
        <DialogContent className="sm:max-w-md" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Missed session: {studentName}</DialogTitle>
            <DialogDescription>
              Records that the session on the date and times set above didn&apos;t take place. It counts toward
              attendance, not progress. Anything entered on the card stays.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={v => setReason(v as MissedReason)} aria-label="Reason" className="gap-2">
            {MISSED_REASONS.map(r => (
              <div key={r} className="flex items-center gap-2">
                <RadioGroupItem value={r} id={`missed-${r}`} />
                <Label htmlFor={`missed-${r}`} className="font-normal">{MISSED_REASON_LABELS[r]}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className="space-y-1">
            <Label htmlFor="missed-note">Note (optional)</Label>
            <Textarea id="missed-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g., make-up session scheduled Friday" className="min-h-[64px]" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={close}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving}>Record Missed Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
