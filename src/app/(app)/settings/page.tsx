
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import BackupRestoreCard from '@/components/settings/BackupRestoreCard';
import CommFunctionsCard from '@/components/settings/CommFunctionsCard';
import PasscodeCard from '@/components/settings/PasscodeCard';
import DeleteDataCard from '@/components/settings/DeleteDataCard';
import ImportStudentsCard from '@/components/settings/ImportStudentsCard';
import InterfaceSettingsCard from '@/components/settings/InterfaceSettingsCard';
import AbcListsCard from '@/components/settings/AbcListsCard';
import BuiltInGoalsCard from '@/components/settings/BuiltInGoalsCard';
import CustomGoalTypesCard from '@/components/settings/CustomGoalTypesCard';

export default function SettingsPage() {
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

      <ImportStudentsCard />

      <PasscodeCard />

      <InterfaceSettingsCard />

      <CustomGoalTypesCard />

      <AbcListsCard />

      <CommFunctionsCard />

      <BuiltInGoalsCard />

      <DeleteDataCard />

      {/* Which version this device is running (it updates when the app is reopened after a new release). */}
      <p className="text-center text-xs text-muted-foreground">
        AscendEd version {process.env.NEXT_PUBLIC_APP_VERSION}
        {process.env.NEXT_PUBLIC_BUILD_TIME && ` · built ${new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString()}`}
      </p>
    </div>
  );
}
