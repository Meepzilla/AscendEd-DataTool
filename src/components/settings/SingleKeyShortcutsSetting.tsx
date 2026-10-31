'use client';

import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { setSingleKeyShortcutsEnabled, singleKeyShortcutsEnabled } from '@/lib/data-entry-hotkeys';

/** Settings row to turn Data Entry's single-key shortcuts (C, N, A, S, 1–4...) on or off. */
export default function SingleKeyShortcutsSetting() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(singleKeyShortcutsEnabled());
  }, []);

  return (
    <div className="flex flex-row items-center justify-between gap-3 rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label htmlFor="single-key-switch" className="text-base font-medium">Single-Key Shortcuts in Data Entry</Label>
        <p className="text-sm text-muted-foreground">
          Record data with one key (for example C for correct, A for the next student). Turn off if you use speech
          input or a switch device, or to avoid recording by accident; the Alt and Ctrl/Cmd shortcuts keep working.
          Saved on this device only.
        </p>
      </div>
      <Switch
        id="single-key-switch"
        checked={enabled}
        onCheckedChange={value => { setSingleKeyShortcutsEnabled(value); setEnabled(value); }}
      />
    </div>
  );
}
