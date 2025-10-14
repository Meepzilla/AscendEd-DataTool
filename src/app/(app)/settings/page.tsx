
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Settings, Wifi, WifiOff } from 'lucide-react';

const FIREBASE_ENABLED_KEY = 'firebase_enabled';

export default function SettingsPage() {
  const [isFirebaseEnabled, setIsFirebaseEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSetting = window.localStorage.getItem(FIREBASE_ENABLED_KEY);
      // Default to false if no setting is found
      setIsFirebaseEnabled(storedSetting === null ? false : JSON.parse(storedSetting));
      setIsLoading(false);
    }
  }, []);

  const handleToggleFirebase = (enabled: boolean) => {
    setIsFirebaseEnabled(enabled);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(FIREBASE_ENABLED_KEY, JSON.stringify(enabled));
      toast({
        title: "Settings Updated",
        description: `Firebase has been ${enabled ? 'enabled' : 'disabled'}. Please reload the application for the changes to take full effect.`,
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
              <CardTitle className="text-3xl font-bold">Application Settings</CardTitle>
              <CardDescription>
                Manage application behavior and connectivity.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connectivity</CardTitle>
          <CardDescription>
            Control the application's connection to backend services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="firebase-switch" className="text-base font-medium">
                Enable Firebase Backend
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, your data is synced to the cloud. When disabled, the app runs in local-only mode, storing data in your browser.
              </p>
            </div>
            <div className="flex items-center gap-2">
                {isFirebaseEnabled ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
                <Switch
                    id="firebase-switch"
                    checked={isFirebaseEnabled}
                    onCheckedChange={handleToggleFirebase}
                />
            </div>
          </div>
           <div className="flex items-center justify-end gap-4 p-4 border-t">
              <p className="text-sm text-muted-foreground">A page reload is required to apply connectivity changes.</p>
              <Button onClick={handleReload}>Reload Now</Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
