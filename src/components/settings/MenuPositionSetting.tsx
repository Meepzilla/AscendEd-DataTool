'use client';

import React, { useEffect, useState } from 'react';
import { PanelTop, PanelBottom } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { type MenuPosition, getMenuPosition, setMenuPosition } from '@/lib/menu-position';

/** Settings row for where the menu bar sits: the top or the bottom of the screen. Changes apply immediately. */
export default function MenuPositionSetting() {
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    setPosition(getMenuPosition());
  }, []);

  const choose = (value: MenuPosition) => {
    setMenuPosition(value);
    setPosition(value);
  };

  const options: { value: MenuPosition; label: string; Icon: typeof PanelTop }[] = [
    { value: 'top', label: 'Top', Icon: PanelTop },
    { value: 'bottom', label: 'Bottom', Icon: PanelBottom },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label className="text-base font-medium">Menu Bar Position</Label>
        <p className="text-sm text-muted-foreground">
          Show the menu bar at the top or the bottom of the screen. The bottom is easier to reach when holding a
          tablet. This setting is saved on this device only.
        </p>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label="Menu bar position">
        {options.map(({ value, label, Icon }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={position === value ? 'default' : 'outline'}
            role="radio"
            aria-checked={position === value}
            onClick={() => choose(value)}
          >
            <Icon className="mr-1 h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
