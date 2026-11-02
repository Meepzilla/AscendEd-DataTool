'use client';

import React, { useEffect, useState } from 'react';
import { Contrast, Flower2, Moon, Sun } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { type Theme, THEMES, getTheme, setTheme } from '@/lib/theme';

const ICONS: Record<Theme, typeof Moon> = { dark: Moon, light: Sun, contrast: Contrast, pastel: Flower2 };

/** Settings row for the color theme. Changes apply immediately and are saved on this device. */
export default function ThemeSetting() {
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  const choose = (value: Theme) => {
    setTheme(value);
    setThemeState(value);
  };
  const current = THEMES.find(t => t.value === theme);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label className="text-base font-medium">Theme</Label>
        <p className="text-sm text-muted-foreground">
          The app&apos;s colors{current ? `: ${current.description}` : '.'} Printed reports are always black on white. This
          setting is saved on this device only.
        </p>
      </div>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Theme">
        {THEMES.map(({ value, label }) => {
          const Icon = ICONS[value];
          return (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={theme === value ? 'default' : 'outline'}
              role="radio"
              aria-checked={theme === value}
              onClick={() => choose(value)}
            >
              <Icon className="mr-1 h-4 w-4" aria-hidden />
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
