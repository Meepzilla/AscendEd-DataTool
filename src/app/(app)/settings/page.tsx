
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Settings, PanelLeft } from 'lucide-react';
import BackupRestoreCard from '@/components/settings/BackupRestoreCard';
import PasscodeCard from '@/components/settings/PasscodeCard';
import DeleteDataCard from '@/components/settings/DeleteDataCard';
import DisplaySizeSetting from '@/components/settings/DisplaySizeSetting';
import MenuPositionSetting from '@/components/settings/MenuPositionSetting';
import SingleKeyShortcutsSetting from '@/components/settings/SingleKeyShortcutsSetting';
import AbcListsCard from '@/components/settings/AbcListsCard';

const SIDEBAR_ENABLED_KEY = 'sidebar_enabled';

export default function SettingsPage() {
  const [isSidebarEnabled, setIsSidebarEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSidebarSetting = window.localStorage.getItem(SIDEBAR_ENABLED_KEY);
      setIsSidebarEnabled(storedSidebarSetting === null ? true : JSON.parse(storedSidebarSetting));
      
      setIsLoading(false);
    }
  }, []);

  const handleToggleSidebar = (enabled: boolean) => {
    setIsSidebarEnabled(enabled);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SIDEBAR_ENABLED_KEY, JSON.stringify(enabled));
      toast({
        title: "Settings Updated",
        description: `Student Sidebar has been ${enabled ? 'enabled' : 'disabled'}. Please reload the application to apply the change.`,
      });
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Settings className="h-10 w-10 text-primary" />
            <div>
              <CardTitle role="heading" aria-level={1} className="text-3xl font-bold">Application Settings</CardTitle>
              <CardDescription>
                Manage application behavior. How student data is stored and protected:{' '}
                <Link href="/privacy" className="underline hover:text-primary">Privacy Notice</Link>.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <BackupRestoreCard />

      <PasscodeCard />

      <Card>
        <CardHeader>
          <CardTitle>Interface</CardTitle>
          <CardDescription>
            Control the application's user interface elements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DisplaySizeSetting />
          <MenuPositionSetting />
          <SingleKeyShortcutsSetting />
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
                <Switch
                    id="sidebar-switch"
                    checked={isSidebarEnabled}
                    onCheckedChange={handleToggleSidebar}
                />
            </div>
          </div>
           <div className="flex items-center justify-end gap-4 p-4 border-t">
              <p className="text-sm text-muted-foreground">A page reload is required to apply changes.</p>
              <Button onClick={handleReload}>Reload Now</Button>
            </div>
        </CardContent>
      </Card>

      <AbcListsCard />

      <DeleteDataCard />

      {/* Which version this device is running (it updates when the app is reopened after a new release). */}
      <p className="text-center text-xs text-muted-foreground">
        AscendEd version {process.env.NEXT_PUBLIC_APP_VERSION}
        {process.env.NEXT_PUBLIC_BUILD_TIME && ` · built ${new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString()}`}
      </p>
    </div>
  );
}
