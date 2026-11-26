'use client';

import React, { useEffect, useState } from 'react';
import { Contrast, Flower2, Moon, PanelBottom, PanelLeft, PanelTop, Sun, ZoomOut } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { APP_NAME } from '@/lib/appConstants';
import { DISPLAY_SCALE_OPTIONS, TABLET_DEFAULT_SCALE, getCurrentDisplayScale, setDisplayScale } from '@/lib/display-scale';
import { type Theme, THEMES, getTheme, setTheme } from '@/lib/theme';
import { setSingleKeyShortcutsEnabled, singleKeyShortcutsEnabled } from '@/lib/data-entry-hotkeys';
import { getSchoolYearSetting, schoolYearRange, setSchoolYearSetting } from '@/lib/school-year';
import {
  type MenuPosition,
  SIDEBAR_ENABLED_KEY,
  getMenuPosition,
  getOrganizationName,
  readSidebarEnabled,
  setMenuPosition,
  setOrganizationName,
} from '@/lib/ui-preferences';

const THEME_ICONS: Record<Theme, typeof Moon> = { dark: Moon, light: Sun, contrast: Contrast, pastel: Flower2 };

/** Settings row for the app-wide zoom level ("Display Size"). Changes apply immediately. */
function DisplaySizeSetting() {
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

/** Settings row for the color theme. Changes apply immediately and are saved on this device. */
function ThemeSetting() {
  const [theme, setThemeState] = useState<Theme | null>(null);
  // Whether the last save failed: the theme still applies for this visit, but it won't be kept.
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  const choose = (value: Theme) => {
    setSaveFailed(!setTheme(value));
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
        {saveFailed && (
          <p className="text-sm text-destructive" role="alert">
            The theme could not be saved on this device (storage is full or unavailable), so it applies for this visit only.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Theme">
        {THEMES.map(({ value, label }) => {
          const Icon = THEME_ICONS[value];
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

/** Settings row for where the menu bar sits: the top or the bottom of the screen. Changes apply immediately. */
function MenuPositionSetting() {
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

/** Settings row to turn Data Entry's single-key shortcuts (C, N, A, S, 1–4...) on or off. */
function SingleKeyShortcutsSetting() {
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

/** Settings row for the school or district name shown at the top of printed reports. */
function OrganizationNameSetting() {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(getOrganizationName());
  }, []);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label htmlFor="organization-name" className="text-base font-medium">School or District Name</Label>
        <p className="text-sm text-muted-foreground">
          Shown at the top of printed progress reports in place of &quot;{APP_NAME}&quot;. Leave blank to show {APP_NAME}.
          Saved on this device only.
        </p>
      </div>
      <Input
        id="organization-name"
        value={name}
        onChange={e => { setName(e.target.value); setOrganizationName(e.target.value); }}
        placeholder="e.g., Riverside School District"
        className="w-full sm:w-80"
        autoComplete="organization"
      />
    </div>
  );
}

/** Settings row for the school year's first and last day (month and day, so it repeats each year). */
function SchoolYearSetting() {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  // Whether the last save failed: the dates still apply for this visit, but they won't be kept.
  const [saveFailed, setSaveFailed] = useState(false);

  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  useEffect(() => {
    const { start, end } = schoolYearRange();
    setFirst(ymd(start));
    setLast(ymd(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)));
  }, []);

  // Only the month and day are kept: the dates repeat each school year.
  const save = (nextFirst: string, nextLast: string) => {
    const current = getSchoolYearSetting();
    setSaveFailed(!setSchoolYearSetting({
      start: nextFirst ? nextFirst.slice(5) : current.start,
      end: nextLast ? nextLast.slice(5) : current.end,
    }));
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label className="text-base font-medium">School Year</Label>
        <p className="text-sm text-muted-foreground">
          The first and last day of the school year. Used for school-year attendance and service minutes on student
          profiles, and School year to date on the Progress Report. The month and day repeat each year. Saved on this
          device only.
        </p>
        {saveFailed && (
          <p className="text-sm text-destructive" role="alert">
            The school year could not be saved on this device (storage is full or unavailable), so it applies for this visit only.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3 [&_input]:block [&_input]:w-40 [&_input]:appearance-none">
        <div className="space-y-1">
          <Label htmlFor="school-year-first" className="text-xs">First day</Label>
          <Input id="school-year-first" type="date" value={first} onChange={e => { setFirst(e.target.value); save(e.target.value, last); }} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="school-year-last" className="text-xs">Last day</Label>
          <Input id="school-year-last" type="date" value={last} onChange={e => { setLast(e.target.value); save(first, e.target.value); }} />
        </div>
      </div>
    </div>
  );
}

/** Settings → Interface card grouping all device-local appearance and UI preferences. */
export default function InterfaceSettingsCard() {
  // Null until the stored value is read on mount: initialising to a guessed `true` painted the
  // switch on for one frame when the sidebar was stored off (review finding B4). The switch is
  // rendered only once the real value is known; a same-size placeholder holds its place.
  const [isSidebarEnabled, setIsSidebarEnabled] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedSidebarSetting = window.localStorage.getItem(SIDEBAR_ENABLED_KEY);
      setIsSidebarEnabled(readSidebarEnabled(storedSidebarSetting));
    } catch {
      setIsSidebarEnabled(true);
    }
  }, []);

  const handleToggleSidebar = (enabled: boolean) => {
    setIsSidebarEnabled(enabled);
    try {
      window.localStorage.setItem(SIDEBAR_ENABLED_KEY, JSON.stringify(enabled));
      toast({
        title: "Settings Updated",
        description: `Student Sidebar has been ${enabled ? 'enabled' : 'disabled'}. Please reload the application to apply the change.`,
      });
    } catch {
      toast({
        title: "Setting Could Not Be Saved",
        description: "Device storage is full or unavailable.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interface</CardTitle>
        <CardDescription>
          Control the application&apos;s user interface elements.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DisplaySizeSetting />
        <ThemeSetting />
        <MenuPositionSetting />
        <SingleKeyShortcutsSetting />
        <OrganizationNameSetting />
        <SchoolYearSetting />
        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="sidebar-switch" className="text-base font-medium">
              Enable Student Sidebar
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, the sidebar for student selection and progress is visible. Disable it for more screen space.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PanelLeft className="h-5 w-5 text-muted-foreground" />
            {isSidebarEnabled === null ? (
              <span className="h-6 w-11" aria-hidden />
            ) : (
              <Switch
                id="sidebar-switch"
                checked={isSidebarEnabled}
                onCheckedChange={handleToggleSidebar}
              />
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-4 p-4 border-t">
          <p className="text-sm text-muted-foreground">A page reload is required to apply changes.</p>
          <Button onClick={() => window.location.reload()}>Reload Now</Button>
        </div>
      </CardContent>
    </Card>
  );
}
