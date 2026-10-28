'use client';

import React, { useEffect, useState } from 'react';
import { ZoomOut } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DISPLAY_SCALE_OPTIONS, TABLET_DEFAULT_SCALE, getCurrentDisplayScale, setDisplayScale } from '@/lib/display-scale';

/** Settings row for the app-wide zoom level ("Display Size"). Changes apply immediately. */
export default function DisplaySizeSetting() {
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    setScale(getCurrentDisplayScale());
  }, []);

  const choose = (value: number) => {
    setDisplayScale(value);
    setScale(value);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label className="text-base font-medium">Display Size</Label>
        <p className="text-sm text-muted-foreground">
          Zoom the whole app out to fit more on screen. Tablets start at {Math.round(TABLET_DEFAULT_SCALE * 100)}%. This setting is
          saved on this device only.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ZoomOut className="h-5 w-5 text-muted-foreground" />
        <div className="flex gap-1" role="radiogroup" aria-label="Display size">
          {DISPLAY_SCALE_OPTIONS.map(option => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={scale === option ? 'default' : 'outline'}
              role="radio"
              aria-checked={scale === option}
              onClick={() => choose(option)}
            >
              {Math.round(option * 100)}%
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
